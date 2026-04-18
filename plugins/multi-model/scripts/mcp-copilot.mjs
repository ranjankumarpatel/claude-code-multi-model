#!/usr/bin/env node
/**
 * GitHub Copilot CLI MCP Server for Claude Code
 * Wraps the `copilot` binary as a stdio MCP server.
 */
import {
  createRequireFromLocalFirst,
  logCall,
  copilotBudget,
  loadYamlCopilotIds,
} from "./lib/common.mjs";
import { COPILOT_MODELS } from "./lib/copilot-models.mjs";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequireFromLocalFirst(import.meta.url);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// --- Resolve the copilot binary path once at startup (Option A).
// spawn() with shell:false on Windows requires an absolute path or the exact
// binary name as it exists on PATH.  "copilot.cmd" alone fails with EINVAL
// because Node tries to execve it directly.  We run `where` / `which` once,
// pick the first line, and cache the absolute path for all subsequent calls.
let _copilotPath = null;
let _copilotPathError = null;

try {
  const lookupCmd = process.platform === "win32" ? "where.exe" : "which";
  const raw = execFileSync(lookupCmd, ["copilot"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
  if (!firstLine) throw new Error("empty output from path lookup");
  _copilotPath = firstLine;
} catch (err) {
  _copilotPathError = `copilot CLI not found in PATH: ${err.message}`;
  process.stderr.write(`[mcp-copilot] WARNING: ${_copilotPathError}\n`);
}

// COPILOT_MODELS now lives in ./lib/copilot-models.mjs (shared with
// check-copilot-drift.mjs). Drift check runs on boot at the bottom of this
// file; set COPILOT_STRICT_MODELS=1 to fail startup on drift (exit 3).

const CHILD_ENV = (() => {
  const keys = [
    "GH_TOKEN", "GITHUB_TOKEN",
    "PATH", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME",
    "SYSTEMROOT", "TEMP", "TMP", "PROGRAMFILES", "PROGRAMDATA", "PATHEXT", "COMSPEC",
  ];
  const env = {};
  for (const k of keys) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("COPILOT_")) env[k] = v;
  }
  return env;
})();

function runCopilot({ prompt, model, cwd, timeoutMs = 300_000 }) {
  return new Promise((resolve, reject) => {
    // Return a clear error if the binary was not found at startup.
    if (!_copilotPath) {
      reject(new Error(_copilotPathError ?? "copilot CLI not found in PATH"));
      return;
    }

    const args = ["-p", prompt, "--allow-all-tools"];
    if (model) args.push("--model", model);

    // Use the absolute path resolved at startup (Option A).
    // shell:false prevents shell injection via user-controlled prompt.
    const child = spawn(_copilotPath, args, {
      cwd: cwd ?? process.cwd(),
      env: CHILD_ENV,
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000).unref();
      reject(new Error(`copilot timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`copilot exited ${code}: ${stderr.trim()}`));
      } else {
        resolve(stdout);
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const server = new McpServer({ name: "copilot", version: "1.2.0" });

server.tool(
  "copilot_list_models",
  "List supported GitHub Copilot CLI model IDs",
  {},
  async () => {
    const lines = COPILOT_MODELS.map((m) => `${m.id}  [${m.vendor}]  ${m.notes}`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.tool(
  "copilot_chat",
  [
    "Run a prompt through the GitHub Copilot CLI (`copilot` binary).",
    "Use for coding tasks, code generation, and Copilot-specific workflows.",
    "Models: claude-opus-4.6, claude-sonnet-4.6, claude-haiku-4.5, gpt-5.3-codex, gemini-3-pro, gpt-5.",
    "Default timeout: 300s.",
  ].join(" "),
  {
    prompt: z.string().describe("The prompt to send to Copilot"),
    model: z.string().optional().describe("Copilot model ID (see copilot_list_models). Default: Copilot's own default."),
    cwd: z.string().optional().describe("Working directory for the Copilot process. Default: process.cwd()."),
  },
  async ({ prompt, model, cwd }) => {
    if (!_copilotPath) {
      return { content: [{ type: "text", text: `Error: ${_copilotPathError ?? "copilot CLI not found in PATH"}. Install the GitHub Copilot CLI and ensure it is on PATH.` }] };
    }

    // Circuit breaker: check the daily Copilot budget BEFORE spawning.
    const budget = copilotBudget();
    const status = budget.check();
    if (!status.allowed) {
      const msg =
        `Daily Copilot budget exhausted: used ${status.used}/${status.limit}. ` +
        `Set COPILOT_DAILY_LIMIT to adjust.`;
      logCall({
        mcp: "copilot", tool: "copilot_chat", model: model ?? null,
        startedAt: Date.now(), endedAt: Date.now(), ok: false, error: msg,
      });
      return { content: [{ type: "text", text: `Error: ${msg}` }] };
    }

    const startedAt = Date.now();
    let ok = false;
    let lastErr;
    try {
      // NOTE: do NOT wrap in retry() — Copilot calls are premium-cost.
      const text = await runCopilot({ prompt, model, cwd });
      ok = true;
      try { budget.consume(); } catch (_) { /* race: another call exhausted budget */ }
      logCall({
        mcp: "copilot", tool: "copilot_chat", model: model ?? null,
        startedAt, endedAt: Date.now(), ok,
      });
      return { content: [{ type: "text", text }] };
    } catch (err) {
      lastErr = err;
      throw err;
    } finally {
      if (!ok) {
        logCall({
          mcp: "copilot", tool: "copilot_chat", model: model ?? null,
          startedAt, endedAt: Date.now(), ok: false, error: lastErr,
        });
      }
    }
  }
);

// ─── Drift check: hand list (COPILOT_MODELS) vs models.yaml copilot: ───
// Default = warn on stderr. Set COPILOT_STRICT_MODELS=1 to fail startup (exit 3).
(function driftCheck() {
  try {
    const yamlPath = path.resolve(fileURLToPath(import.meta.url), "..", "..", "models.yaml");
    const yamlIds = loadYamlCopilotIds({ yamlPath, require });
    if (!yamlIds) {
      process.stderr.write("[mcp-copilot] drift check: models.yaml not parseable — skipping\n");
      return;
    }
    const handIds = COPILOT_MODELS.map((m) => m.id);
    const missingFromHand = yamlIds.filter((id) => !handIds.includes(id));
    const extraInHand = handIds.filter((id) => !yamlIds.includes(id));
    if (missingFromHand.length || extraInHand.length) {
      const msg = [
        "[mcp-copilot] DRIFT DETECTED between COPILOT_MODELS and models.yaml:",
        missingFromHand.length ? `  missing from hand list: ${missingFromHand.join(", ")}` : null,
        extraInHand.length ? `  extra in hand list: ${extraInHand.join(", ")}` : null,
        "  Fix: update COPILOT_MODELS in scripts/lib/copilot-models.mjs OR models.yaml copilot: section.",
        process.env.COPILOT_STRICT_MODELS === "1"
          ? "  COPILOT_STRICT_MODELS=1 → failing startup."
          : "  (Set COPILOT_STRICT_MODELS=1 to fail startup on drift.)",
      ].filter(Boolean).join("\n");
      process.stderr.write(msg + "\n");
      if (process.env.COPILOT_STRICT_MODELS === "1") process.exit(3);
    }
  } catch (e) {
    process.stderr.write(`[mcp-copilot] drift check failed (non-fatal): ${e.message}\n`);
  }
})();

const transport = new StdioServerTransport();
await server.connect(transport);
