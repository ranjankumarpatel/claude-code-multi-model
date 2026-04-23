#!/usr/bin/env node
/**
 * opencode CLI MCP Server for Claude Code
 *
 * Wraps the `opencode` binary (https://opencode.ai) as a stdio MCP server.
 * Uses `opencode run` in non-interactive mode. Auth is delegated to the
 * user's local `opencode providers login` credentials.
 *
 * Docs: https://opencode.ai/docs/
 */
import { createRequireFromLocalFirst, logCall } from "./lib/common.mjs";
import { spawn, execFileSync } from "node:child_process";
const require = createRequireFromLocalFirst(import.meta.url);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

let _opencodePath = null;
let _opencodePathError = null;

try {
  const lookupCmd = process.platform === "win32" ? "where.exe" : "which";
  const raw = execFileSync(lookupCmd, ["opencode"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const preferred = lines.find((l) => /\.(cmd|exe|bat)$/i.test(l)) ?? lines[0];
  if (!preferred) throw new Error("empty output from path lookup");
  _opencodePath = preferred;
} catch (err) {
  _opencodePathError = `opencode CLI not found in PATH: ${err.message}`;
  process.stderr.write(`[mcp-opencode] WARNING: ${_opencodePathError}\n`);
}

// On Windows, .cmd/.bat wrappers can't be spawned with shell:false (EINVAL).
const _needsShell = process.platform === "win32" && _opencodePath && /\.(cmd|bat)$/i.test(_opencodePath);

const CHILD_ENV = (() => {
  const keys = [
    "PATH", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME",
    "SYSTEMROOT", "TEMP", "TMP", "PROGRAMFILES", "PROGRAMDATA", "PATHEXT", "COMSPEC",
    "OPENCODE_SERVER_PASSWORD",
  ];
  const env = {};
  for (const k of keys) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("OPENCODE_")) env[k] = v;
  }
  return env;
})();

function runOpencode({
  prompt,
  model,
  agent,
  variant,
  cwd,
  dangerouslySkipPermissions = true,
  thinking = false,
  format = "default",
  timeoutMs = 600_000,
}) {
  return new Promise((resolve, reject) => {
    if (!_opencodePath) {
      reject(new Error(_opencodePathError ?? "opencode CLI not found in PATH"));
      return;
    }

    const args = ["run"];
    if (model) args.push("--model", model);
    if (agent) args.push("--agent", agent);
    if (variant) args.push("--variant", variant);
    if (cwd) args.push("--dir", cwd);
    if (format) args.push("--format", format);
    if (thinking) args.push("--thinking");
    if (dangerouslySkipPermissions) args.push("--dangerously-skip-permissions");
    args.push("--", prompt);

    const child = spawn(_opencodePath, args, {
      cwd: cwd ?? process.cwd(),
      env: CHILD_ENV,
      shell: _needsShell,
      stdio: ["ignore", "pipe", "pipe"],
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
      reject(new Error(`opencode timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`opencode exited ${code}: ${stderr.trim() || stdout.trim()}`));
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

function listModels() {
  if (!_opencodePath) {
    return { ok: false, text: _opencodePathError ?? "opencode CLI not found in PATH" };
  }
  try {
    const raw = execFileSync(_opencodePath, ["models"], {
      env: CHILD_ENV,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
      shell: _needsShell,
    });
    return { ok: true, text: raw.trim() };
  } catch (err) {
    return { ok: false, text: `opencode models failed: ${err.message}` };
  }
}

// Free-tier allowlist: only these opencode models incur no cost.
// Keep in sync with commands/opencode.md and MODELS.md.
const OPENCODE_FREE_MODELS = [
  "opencode/big-pickle",
  "opencode/ling-2.6-flash-free",
  "opencode/minimax-m2.5-free",
  "opencode/nemotron-3-super-free",
];

const server = new McpServer({ name: "opencode", version: "1.1.0" });

server.tool(
  "opencode_list_models",
  "List the free-tier opencode models this MCP server is allowed to route to. The full opencode models catalog has paid tiers too, but those are blocked here to prevent unexpected billing.",
  {},
  async () => {
    const r = listModels();
    const allowed = OPENCODE_FREE_MODELS.join("\n");
    const body = r.ok
      ? "Free-tier allowlist (enforced by this MCP):\n" + allowed + "\n\n--- full opencode models output (reference only; paid tiers blocked) ---\n" + r.text
      : "Free-tier allowlist:\n" + allowed + "\n\n(couldn't query opencode models: " + r.text + ")";
    return { content: [{ type: "text", text: body }] };
  }
);

server.tool(
  "opencode_run",
  [
    "Run a prompt through the opencode CLI (`opencode run`) non-interactively.",
    "Cross-vendor executor — routes to whichever provider the user has authenticated via `opencode providers login`.",
    "RESTRICTED TO FREE-TIER MODELS ONLY:",
    OPENCODE_FREE_MODELS.map((m) => `  - ${m}`).join("\n"),
    "Paid models from `opencode models` are rejected by this MCP to prevent unexpected billing.",
    "Default model (if omitted): opencode/big-pickle.",
    "Defaults: --dangerously-skip-permissions=true (auto-approves tool use, since this runs headless).",
    "Default timeout: 600s.",
  ].join(" "),
  {
    prompt: z.string().describe("Task prompt for opencode"),
    model: z.string().optional().describe(`Free-tier opencode model. Allowed: ${OPENCODE_FREE_MODELS.join(", ")}. Default: opencode/big-pickle.`),
    agent: z.string().optional().describe("opencode agent to use (see `opencode agent` subcommand)."),
    variant: z.string().optional().describe("Provider-specific reasoning variant (e.g. high, max, minimal)."),
    cwd: z.string().optional().describe("Working directory (passed as --dir). Default: process.cwd()."),
    thinking: z.boolean().optional().describe("Show thinking blocks. Default: false."),
    format: z.enum(["default", "json"]).optional().describe("Output format. Default: 'default' (human-formatted)."),
    dangerouslySkipPermissions: z.boolean().optional().describe("Auto-approve permissions. Default: true (headless use). Set false to make opencode refuse unsafe actions."),
  },
  async ({ prompt, model, agent, variant, cwd, thinking, format, dangerouslySkipPermissions }) => {
    if (!_opencodePath) {
      return { content: [{ type: "text", text: `Error: ${_opencodePathError ?? "opencode CLI not found in PATH"}. Install with \`npm install -g opencode-ai\` and ensure \`opencode\` is on PATH.` }] };
    }

    const chosenModel = model ?? "opencode/big-pickle";
    if (!OPENCODE_FREE_MODELS.includes(chosenModel)) {
      const msg =
        `Model "${chosenModel}" is not on the free-tier allowlist and is blocked to prevent billing. ` +
        `Allowed: ${OPENCODE_FREE_MODELS.join(", ")}.`;
      logCall({
        mcp: "opencode", tool: "opencode_run", model: chosenModel,
        startedAt: Date.now(), endedAt: Date.now(), ok: false, error: msg,
      });
      return { content: [{ type: "text", text: `Error: ${msg}` }] };
    }

    const startedAt = Date.now();
    let ok = false;
    let lastErr;
    try {
      const text = await runOpencode({
        prompt, model: chosenModel, agent, variant, cwd,
        thinking: thinking ?? false,
        format: format ?? "default",
        dangerouslySkipPermissions: dangerouslySkipPermissions ?? true,
      });
      ok = true;
      logCall({
        mcp: "opencode", tool: "opencode_run", model: chosenModel,
        startedAt, endedAt: Date.now(), ok,
      });
      return { content: [{ type: "text", text }] };
    } catch (err) {
      lastErr = err;
      throw err;
    } finally {
      if (!ok) {
        logCall({
          mcp: "opencode", tool: "opencode_run", model: chosenModel,
          startedAt, endedAt: Date.now(), ok: false, error: lastErr,
        });
      }
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
