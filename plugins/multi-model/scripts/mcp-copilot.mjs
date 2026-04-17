#!/usr/bin/env node
/**
 * GitHub Copilot CLI MCP Server for Claude Code
 * Wraps the `copilot` binary as a stdio MCP server.
 */
import { createRequire } from "node:module";
const require = createRequire(
  process.env.MCP_GLOBAL_MODULES
    ? `file:///${process.env.MCP_GLOBAL_MODULES.replaceAll("\\", "/")}/`
    : import.meta.url
);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");
import { spawn, execFileSync } from "node:child_process";

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

const COPILOT_MODELS = [
  { id: "claude-opus-4.6",    vendor: "Anthropic", notes: "Anthropic Opus — planning, architecture, complex reasoning" },
  { id: "claude-sonnet-4.6",  vendor: "Anthropic", notes: "Anthropic Sonnet — balanced coding and reasoning" },
  { id: "claude-haiku-4.5",   vendor: "Anthropic", notes: "Anthropic Haiku — fast, lightweight tasks" },
  { id: "gpt-5.3-codex",      vendor: "OpenAI",    notes: "OpenAI Codex — code generation and completion" },
  { id: "gemini-3-pro",       vendor: "Google",    notes: "Google Gemini Pro — multimodal, long-context" },
  { id: "gpt-5",              vendor: "OpenAI",    notes: "OpenAI GPT-5 — general purpose frontier model" },
];

const CHILD_ENV = (() => {
  const keys = [
    "GH_TOKEN", "GITHUB_TOKEN",
    "PATH", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME",
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
      child.kill();
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
    const text = await runCopilot({ prompt, model, cwd });
    return { content: [{ type: "text", text }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
