#!/usr/bin/env node
/**
 * Codex CLI MCP Server for Claude Code
 *
 * Wraps the `codex` binary (`@openai/codex` / OpenAI Codex CLI) as a stdio
 * MCP server. Bypasses the openai-codex plugin's app-server broker, which
 * runs every turn inside a Landlock sandbox (read-only or workspace-write)
 * that sometimes reports `Codex blocked (sandbox restriction, file access denied)`.
 *
 * Defaults to `codex exec --full-auto` (workspace-write + on-request approvals).
 * Pass `bypassSandbox: true` to use `--dangerously-bypass-approvals-and-sandbox`
 * for the rare case the workspace sandbox still blocks a legitimate action.
 *
 * Docs:
 *   https://developers.openai.com/codex/cli/reference
 *   https://developers.openai.com/codex/noninteractive
 *   https://developers.openai.com/codex/concepts/sandboxing
 */
import { createRequireFromLocalFirst, logCall } from "./lib/common.mjs";
import { spawn, execFileSync } from "node:child_process";
const require = createRequireFromLocalFirst(import.meta.url);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// Resolve the `codex` binary once at startup. On Windows, spawn() with
// shell:false needs an absolute path — `codex.cmd` alone fails with EINVAL.
let _codexPath = null;
let _codexPathError = null;

try {
  const lookupCmd = process.platform === "win32" ? "where.exe" : "which";
  const raw = execFileSync(lookupCmd, ["codex"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
  if (!firstLine) throw new Error("empty output from path lookup");
  _codexPath = firstLine;
} catch (err) {
  _codexPathError = `codex CLI not found in PATH: ${err.message}`;
  process.stderr.write(`[mcp-codex] WARNING: ${_codexPathError}\n`);
}

// Auth: the Codex CLI reads ChatGPT subscription credentials from
// `${CODEX_HOME}/auth.json` (default: ~/.codex/auth.json) populated by
// `codex login`. We pass USERPROFILE/HOME/APPDATA so the CLI can locate
// that file; we do NOT pass OPENAI_API_KEY — the user has opted into
// ChatGPT subscription auth, and setting OPENAI_API_KEY would override it.
const CHILD_ENV = (() => {
  const keys = [
    "PATH", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME",
    "SYSTEMROOT", "TEMP", "TMP", "PROGRAMFILES", "PROGRAMDATA", "PATHEXT", "COMSPEC",
    "CODEX_HOME",
  ];
  const env = {};
  for (const k of keys) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("CODEX_")) env[k] = v;
  }
  return env;
})();

function runCodex({
  prompt,
  model,
  cwd,
  bypassSandbox = false,
  sandboxMode,
  effort,
  jsonEvents = false,
  timeoutMs = 600_000,
  addDir,
}) {
  return new Promise((resolve, reject) => {
    if (!_codexPath) {
      reject(new Error(_codexPathError ?? "codex CLI not found in PATH"));
      return;
    }

    const args = ["exec"];
    if (bypassSandbox) {
      args.push("--dangerously-bypass-approvals-and-sandbox");
    } else if (sandboxMode) {
      args.push("--sandbox", sandboxMode);
    } else {
      args.push("--full-auto");
    }
    if (model) args.push("--model", model);
    if (effort) args.push("-c", `model_reasoning_effort="${effort}"`);
    if (jsonEvents) args.push("--json");
    if (Array.isArray(addDir)) for (const d of addDir) args.push("--add-dir", d);
    args.push("--skip-git-repo-check");
    args.push("--", prompt);

    const child = spawn(_codexPath, args, {
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
      reject(new Error(`codex timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`codex exited ${code}: ${stderr.trim() || stdout.trim()}`));
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

const server = new McpServer({ name: "codex", version: "1.0.0" });

server.tool(
  "codex_exec",
  [
    "Run a prompt through the OpenAI Codex CLI (`codex exec`) directly.",
    "Prefer this over the openai-codex plugin's slash commands when the plugin's",
    "Landlock sandbox blocks file access (error: 'Codex blocked (sandbox restriction, file access denied)').",
    "Defaults: --full-auto (workspace-write + on-request approvals).",
    "Set bypassSandbox=true to use --dangerously-bypass-approvals-and-sandbox (YOLO; only in trusted repos).",
    "Default timeout: 600s.",
  ].join(" "),
  {
    prompt: z.string().describe("Task prompt for Codex"),
    model: z.string().optional().describe("Codex model (e.g. gpt-5.3-codex, gpt-5.3-codex-spark). Default: Codex's configured default."),
    cwd: z.string().optional().describe("Working directory. Default: process.cwd()."),
    bypassSandbox: z.boolean().optional().describe("Use --dangerously-bypass-approvals-and-sandbox. Default: false (uses --full-auto)."),
    sandboxMode: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional().describe("Explicit sandbox mode. Overrides the --full-auto default. Ignored if bypassSandbox=true."),
    effort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]).optional().describe("Reasoning effort via -c model_reasoning_effort. Leave unset unless required."),
    jsonEvents: z.boolean().optional().describe("Emit newline-delimited JSON events (--json). Default: false."),
    addDir: z.array(z.string()).optional().describe("Extra writable dirs (--add-dir). Use instead of bypassSandbox when you just need one more directory."),
  },
  async ({ prompt, model, cwd, bypassSandbox, sandboxMode, effort, jsonEvents, addDir }) => {
    if (!_codexPath) {
      return { content: [{ type: "text", text: `Error: ${_codexPathError ?? "codex CLI not found in PATH"}. Install @openai/codex and ensure \`codex\` is on PATH.` }] };
    }

    const startedAt = Date.now();
    let ok = false;
    let lastErr;
    try {
      const text = await runCodex({ prompt, model, cwd, bypassSandbox, sandboxMode, effort, jsonEvents, addDir });
      ok = true;
      logCall({
        mcp: "codex", tool: "codex_exec", model: model ?? null,
        startedAt, endedAt: Date.now(), ok,
      });
      return { content: [{ type: "text", text }] };
    } catch (err) {
      lastErr = err;
      throw err;
    } finally {
      if (!ok) {
        logCall({
          mcp: "codex", tool: "codex_exec", model: model ?? null,
          startedAt, endedAt: Date.now(), ok: false, error: lastErr,
        });
      }
    }
  }
);

server.tool(
  "codex_review",
  [
    "Review a diff or repo state with Codex via direct CLI (read-only sandbox).",
    "Bypasses the openai-codex plugin's app-server broker; use when the plugin's",
    "sandbox blocks the review step. Pass a prompt containing the diff or a path,",
    "or let Codex inspect the current working directory.",
  ].join(" "),
  {
    prompt: z.string().describe("Review instructions + any diff or focus text"),
    model: z.string().optional(),
    cwd: z.string().optional(),
  },
  async ({ prompt, model, cwd }) => {
    if (!_codexPath) {
      return { content: [{ type: "text", text: `Error: ${_codexPathError ?? "codex CLI not found in PATH"}.` }] };
    }
    const startedAt = Date.now();
    let ok = false;
    let lastErr;
    try {
      const text = await runCodex({ prompt, model, cwd, sandboxMode: "read-only" });
      ok = true;
      logCall({ mcp: "codex", tool: "codex_review", model: model ?? null, startedAt, endedAt: Date.now(), ok });
      return { content: [{ type: "text", text }] };
    } catch (err) {
      lastErr = err;
      throw err;
    } finally {
      if (!ok) {
        logCall({ mcp: "codex", tool: "codex_review", model: model ?? null, startedAt, endedAt: Date.now(), ok: false, error: lastErr });
      }
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
