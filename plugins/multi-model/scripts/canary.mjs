#!/usr/bin/env node
// Daily canary — probes every model in models.yaml (or a fallback list).
//
// Two modes:
//   - STUB (default)                — only verifies creds presence, exits 2
//                                     unless CANARY_STUB_OK=1 (Phase-3 gate).
//   - LIVE  (CANARY_LIVE=1)         — spawns each MCP stdio server, speaks
//                                     minimal MCP JSON-RPC, issues a real
//                                     tools/call "say OK" per model, captures
//                                     latency / errors / 410-Gone EOLs.
//
// Exit precedence (updated):
//   1. any status=EOL         → exit 1
//   2. any status=BOOT_FAIL   → exit 1
//   3. LIVE mode & no OKs and at least one probe attempted (not SKIP) → exit 1
//   4. LIVE mode & at least one OK → exit 0
//   5. else (STUB mode) → exit 2 unless CANARY_STUB_OK=1

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { createRequireFromLocalFirst } from "./lib/common.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..").replaceAll("\\", "/");
const MODELS_YAML = join(PLUGIN_ROOT, "models.yaml").replaceAll("\\", "/");

const TIMEOUT_MS = 30_000;
const KILL_GRACE_MS = 2000;
const BOOT_WAIT_MS = 5000; // upper-bound wait for stderr-only BOOT_FAIL signal
const PROMPT = "say OK";

const FALLBACK_MODELS = [
  { mcp: "nvidia-nim", model: "qwen3-coder", env: "NVIDIA_API_KEY" },
  { mcp: "ollama", model: "glm-5.1:cloud", env: "OLLAMA_HOST" },
  { mcp: "copilot", model: "claude-sonnet-4.6", env: "GH_TOKEN" },
];

// YAML top-level keys (snake_case) → MCP runtime names (kebab-case).
const MCP_NAME_MAP = {
  ollama: "ollama",
  nvidia_nim: "nvidia-nim",
  nvidia_security: "nvidia-security",
  copilot: "copilot",
};

// MCP runtime name → env var required for a live probe. Multi-env MCPs
// accept any of the keys (copilot works with GH_TOKEN OR GITHUB_TOKEN).
const MCP_ENV = {
  "nvidia-nim": ["NVIDIA_API_KEY"],
  "nvidia-security": ["NVIDIA_API_KEY"],
  "ollama": ["OLLAMA_HOST"],
  "copilot": ["GH_TOKEN", "GITHUB_TOKEN"],
};

// MCP runtime name → stdio script under PLUGIN_ROOT/scripts/.
const MCP_SCRIPT = {
  "ollama": "mcp-ollama.mjs",
  "nvidia-nim": "mcp-nvidia.mjs",
  "nvidia-security": "mcp-security-nvidia.mjs",
  "copilot": "mcp-copilot.mjs",
};

// MCP runtime name → chat tool name exposed over MCP.
const MCP_TOOL = {
  "ollama": "ollama_chat",
  "nvidia-nim": "nvidia_chat",
  "nvidia-security": "nvidia_security_chat",
  "copilot": "copilot_chat",
};

function credsPresentFor(mcp) {
  const keys = MCP_ENV[mcp];
  if (!keys || keys.length === 0) return true;
  return keys.some((k) => !!process.env[k]);
}

function firstEnvKey(mcp) {
  const keys = MCP_ENV[mcp];
  if (!keys || keys.length === 0) return null;
  return keys[0];
}

async function loadModels() {
  let yaml;
  try {
    const localRequire = createRequireFromLocalFirst(import.meta.url);
    yaml = localRequire("js-yaml");
  } catch (e) {
    console.log(`SKIP: js-yaml not resolvable (${e.message}) — using fallback list`);
    return FALLBACK_MODELS;
  }
  let raw;
  try {
    raw = await readFile(MODELS_YAML, "utf8");
  } catch (e) {
    console.log(`SKIP: models.yaml not found at ${MODELS_YAML} — using fallback list`);
    return FALLBACK_MODELS;
  }
  let doc;
  try {
    doc = yaml.load(raw);
  } catch (e) {
    console.log(`SKIP: models.yaml parse failed (${e.message}) — using fallback list`);
    return FALLBACK_MODELS;
  }
  const out = [];
  for (const [ymlKey, runtimeName] of Object.entries(MCP_NAME_MAP)) {
    const entries = doc?.[ymlKey];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!entry || typeof entry.id !== "string") continue;
      out.push({
        mcp: runtimeName,
        model: entry.id,
        env: firstEnvKey(runtimeName),
      });
    }
  }
  if (out.length === 0) {
    console.log("SKIP: models.yaml parsed but no entries found — using fallback list");
    return FALLBACK_MODELS;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Live probe: spawn one stdio MCP server per entry, speak JSON-RPC directly.
// ---------------------------------------------------------------------------

/**
 * Spawns the MCP server, performs initialize → initialized → tools/call, races
 * against a wall-clock deadline, and tears the child down cleanly.
 *
 * Resolves with { status, latency, error } matching the row shape.
 */
function livePing(entry) {
  return new Promise((resolve) => {
    const scriptName = MCP_SCRIPT[entry.mcp];
    const toolName = MCP_TOOL[entry.mcp];
    if (!scriptName || !toolName) {
      resolve({
        status: "FAIL",
        latency: 0,
        error: `unknown mcp: ${entry.mcp}`,
      });
      return;
    }

    const scriptPath = `${PLUGIN_ROOT}/scripts/${scriptName}`;
    const start = Date.now();

    // shell:false — do NOT let the command-line touch a shell. The script path
    // is developer-controlled, but we keep this invariant everywhere.
    let child;
    try {
      child = spawn(process.execPath, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
        shell: false,
      });
    } catch (err) {
      resolve({
        status: "BOOT_FAIL",
        latency: Date.now() - start,
        error: `spawn failed: ${String(err?.message ?? err).slice(0, 200)}`,
      });
      return;
    }

    let stderrBuf = "";
    let stdoutBuf = "";
    let settled = false;
    let bootFailed = false;

    const pending = new Map(); // id → { resolve, reject }

    const cleanup = () => {
      try { child.stdout?.removeAllListeners(); } catch {}
      try { child.stderr?.removeAllListeners(); } catch {}
      try { child.removeAllListeners(); } catch {}
    };

    const killChild = () => {
      if (!child || child.killed) return;
      try { child.kill("SIGTERM"); } catch {}
      setTimeout(() => {
        if (child && !child.killed) {
          try { child.kill("SIGKILL"); } catch {}
        }
      }, KILL_GRACE_MS).unref();
    };

    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      killChild();
      resolve(result);
    };

    // Overall per-entry timeout — covers slow boots, slow tool calls, hangs.
    const wallTimer = setTimeout(() => {
      finish({
        status: "TIMEOUT",
        latency: Date.now() - start,
        error: `>${TIMEOUT_MS}ms`,
      });
    }, TIMEOUT_MS);
    wallTimer.unref();

    child.on("error", (err) => {
      // spawn-level error (e.g. ENOENT on node). Treat as BOOT_FAIL.
      finish({
        status: "BOOT_FAIL",
        latency: Date.now() - start,
        error: `child error: ${String(err?.message ?? err).slice(0, 200)}`,
      });
    });

    child.on("exit", (code, signal) => {
      clearTimeout(wallTimer);
      if (settled) return;
      // Exited before we got a response. If stderr has content, surface it.
      const reason =
        stderrBuf.trim().slice(0, 200) ||
        `child exited code=${code} signal=${signal ?? ""}`.trim();
      // If we never got past the MCP handshake, it's a boot failure.
      finish({
        status: bootFailed ? "BOOT_FAIL" : "FAIL",
        latency: Date.now() - start,
        error: reason,
      });
    });

    child.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      stderrBuf += s;
      // Heuristic: "Cannot find module" / "ERR_MODULE_NOT_FOUND" → boot fail.
      if (
        !bootFailed &&
        /(Cannot find module|ERR_MODULE_NOT_FOUND|SyntaxError|ReferenceError)/i
          .test(stderrBuf)
      ) {
        bootFailed = true;
      }
      // Hard cap stderr buffer to avoid unbounded growth.
      if (stderrBuf.length > 8192) stderrBuf = stderrBuf.slice(-8192);
    });

    // Line-delimited JSON-RPC reader.
    child.stdout.on("data", (chunk) => {
      stdoutBuf += chunk.toString();
      let idx;
      while ((idx = stdoutBuf.indexOf("\n")) !== -1) {
        const line = stdoutBuf.slice(0, idx).trim();
        stdoutBuf = stdoutBuf.slice(idx + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          // Non-JSON line on stdout — ignore; MCP servers should only emit JSON.
          continue;
        }
        if (msg && typeof msg.id !== "undefined" && pending.has(msg.id)) {
          const { resolve: r, reject: j } = pending.get(msg.id);
          pending.delete(msg.id);
          if (msg.error) j(msg.error);
          else r(msg.result);
        }
        // We don't handle server→client requests/notifications in the canary.
      }
    });

    const send = (obj) => {
      try {
        child.stdin.write(JSON.stringify(obj) + "\n");
      } catch (err) {
        // stdin write failed — likely child exited. The exit handler will
        // settle; avoid double-resolving here.
      }
    };

    const rpc = (id, method, params) =>
      new Promise((r, j) => {
        pending.set(id, { resolve: r, reject: j });
        send({ jsonrpc: "2.0", id, method, params });
      });

    // --- run the protocol ------------------------------------------------
    (async () => {
      try {
        await rpc(1, "initialize", {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "canary", version: "1.0" },
        });

        // initialized — notification (no id).
        send({ jsonrpc: "2.0", method: "notifications/initialized" });

        // Per-MCP argument shape.
        const args =
          entry.mcp === "copilot"
            ? { model: entry.model, prompt: PROMPT }
            : {
                model: entry.model,
                messages: [{ role: "user", content: PROMPT }],
              };

        const result = await rpc(2, "tools/call", {
          name: toolName,
          arguments: args,
        });

        // MCP "tools/call" error-as-result convention: result.isError === true
        // with a content[].text carrying the message. Surface that as FAIL/EOL.
        if (result && result.isError) {
          const text = extractText(result);
          finish(classifyError(text, Date.now() - start));
          return;
        }

        finish({
          status: "OK",
          latency: Date.now() - start,
          error: "",
        });
      } catch (err) {
        // JSON-RPC error frame or infra error.
        const msg =
          typeof err === "object" && err && "message" in err
            ? String(err.message)
            : String(err);
        finish(classifyError(msg, Date.now() - start));
      }
    })();
  });
}

function extractText(result) {
  try {
    if (Array.isArray(result?.content)) {
      return result.content
        .map((c) => (typeof c?.text === "string" ? c.text : ""))
        .join(" ")
        .trim();
    }
  } catch {}
  return "";
}

function classifyError(rawMsg, latency) {
  const msg = String(rawMsg ?? "").slice(0, 400);
  const trimmed = msg.slice(0, 200);
  if (/\b410\b/.test(msg) || /\bGone\b/i.test(msg)) {
    return { status: "EOL", latency, error: trimmed };
  }
  return { status: "FAIL", latency, error: trimmed };
}

// ---------------------------------------------------------------------------
// STUB / dispatch
// ---------------------------------------------------------------------------

async function stubPing(entry) {
  const start = Date.now();
  if (entry.env && !process.env[entry.env]) {
    return { status: "SKIP", latency: 0, error: `${entry.env} not set` };
  }
  return { status: "STUB", latency: Date.now() - start, error: "" };
}

function pad(s, n) {
  s = String(s ?? "");
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  const live = process.env.CANARY_LIVE === "1";

  if (!live) {
    const credPresent =
      !!process.env.NVIDIA_API_KEY ||
      !!process.env.OLLAMA_HOST ||
      !!process.env.GH_TOKEN ||
      !!process.env.GITHUB_TOKEN;
    if (credPresent) {
      console.log(
        "WARN: creds detected but canary running in STUB mode — models.yaml not verified end-to-end. Set CANARY_LIVE=1 for real probes."
      );
    }
  }

  const entries = await loadModels();
  const rows = [];
  let sawFatal410 = false;
  let sawBootFail = false;
  let anyOK = false;
  let anyProbed = false; // LIVE mode: at least one entry wasn't SKIP

  // Precompute which MCPs have creds, so we can mark all-SKIP in one pass
  // without spawning the server.
  const mcpHasCreds = {};
  for (const mcp of Object.keys(MCP_SCRIPT)) {
    mcpHasCreds[mcp] = credsPresentFor(mcp);
  }

  for (const e of entries) {
    let r;
    if (!live) {
      r = await stubPing(e);
    } else if (!mcpHasCreds[e.mcp]) {
      // Live mode, creds absent for this MCP — SKIP without spawning.
      const need = (MCP_ENV[e.mcp] || []).join(" or ") || "unknown";
      r = { status: "SKIP", latency: 0, error: `${need} not set` };
    } else {
      r = await livePing(e);
    }

    if (typeof r.error === "string" && /\b410\b/.test(r.error)) {
      sawFatal410 = true;
    }
    if (r.status === "EOL") sawFatal410 = true;
    if (r.status === "BOOT_FAIL") sawBootFail = true;
    if (r.status === "OK") anyOK = true;
    if (live && r.status !== "SKIP") anyProbed = true;

    rows.push({ mcp: e.mcp, model: e.model, ...r });
  }

  console.log("");
  console.log(
    pad("MCP", 18) +
      pad("MODEL", 36) +
      pad("STATUS", 12) +
      pad("LATENCY", 10) +
      "ERROR"
  );
  console.log("-".repeat(90));
  for (const r of rows) {
    console.log(
      pad(r.mcp, 18) +
        pad(r.model, 36) +
        pad(r.status, 12) +
        pad(r.latency + "ms", 10) +
        (r.error || "")
    );
  }
  console.log("");
  console.log(`Canary complete: ${rows.length} models probed.`);

  // --- exit precedence -------------------------------------------------
  if (sawFatal410) {
    console.error(
      "FATAL: one or more models returned 410 Gone — mark them EOL in models.yaml and skills."
    );
    process.exit(1);
  }
  if (sawBootFail) {
    console.error(
      "FATAL: one or more MCP servers failed to boot — see BOOT_FAIL rows above."
    );
    process.exit(1);
  }
  if (live) {
    if (!anyOK && anyProbed) {
      console.error(
        "FATAL: live mode but no model answered OK — all probes with creds failed."
      );
      process.exit(1);
    }
    if (anyOK) {
      console.log("Canary passed: at least one live probe returned OK.");
      process.exit(0);
    }
    // Live mode but nothing was probed (all SKIP). Exit 0 — no creds, no signal.
    console.log(
      "Canary: live mode requested but no creds present for any MCP — all SKIP."
    );
    process.exit(0);
  }

  // STUB mode.
  if (process.env.CANARY_STUB_OK === "1") {
    console.log(
      "WARN: STUB mode passing because CANARY_STUB_OK=1 is set — NOT a real health check."
    );
    process.exit(0);
  }
  console.error(
    "FATAL: canary is in STUB mode — live probes not wired. Set CANARY_STUB_OK=1 to acknowledge and pass CI, or set CANARY_LIVE=1 for real probes. CI is intentionally RED in STUB mode."
  );
  process.exit(2);
}

main().catch((e) => {
  console.error("canary failed:", e);
  process.exit(1);
});
