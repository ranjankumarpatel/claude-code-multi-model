#!/usr/bin/env node
/**
 * Google Gemini CLI MCP Server for Claude Code
 * Wraps the `gemini` binary as a stdio MCP server.
 */
import {
  createRequireFromLocalFirst,
  logCall,
  loadYamlModelIds,
} from "./lib/common.mjs";
import { GEMINI_MODELS } from "./lib/gemini-models.mjs";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequireFromLocalFirst(import.meta.url);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// --- Resolve the gemini binary path once at startup.
// spawn() with shell:false on Windows requires an absolute path or the exact
// binary name as it exists on PATH.  We run `where` / `which` once,
// pick the first line, and cache the absolute path for all subsequent calls.
let _geminiPath = null;
let _geminiPathError = null;

try {
  const lookupCmd = process.platform === "win32" ? "where.exe" : "which";
  const raw = execFileSync(lookupCmd, ["gemini"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const firstLine = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
  if (!firstLine) throw new Error("empty output from path lookup");
  _geminiPath = firstLine;
} catch (err) {
  _geminiPathError = `gemini CLI not found in PATH: ${err.message}`;
  process.stderr.write(`[mcp-gemini] WARNING: ${_geminiPathError}\n`);
}

// GEMINI_MODELS now lives in ./lib/gemini-models.mjs (shared with drift checks).
// Drift check runs on boot at the bottom of this file; set GEMINI_STRICT_MODELS=1
// to fail startup on drift (exit 3).

const CHILD_ENV = (() => {
  const keys = [
    "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_APPLICATION_CREDENTIALS",
    "PATH", "APPDATA", "LOCALAPPDATA", "USERPROFILE", "HOME",
    "SYSTEMROOT", "TEMP", "TMP", "PROGRAMFILES", "PROGRAMDATA", "PATHEXT", "COMSPEC",
  ];
  const env = {};
  for (const k of keys) {
    if (process.env[k] !== undefined) env[k] = process.env[k];
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith("GEMINI_") || k.startsWith("GOOGLE_")) env[k] = v;
  }
  return env;
})();

function runGemini({ prompt, model, cwd, approvalMode = "yolo", timeoutMs = 300_000 }) {
  return new Promise((resolve, reject) => {
    // Return a clear error if the binary was not found at startup.
    if (!_geminiPath) {
      reject(new Error(_geminiPathError ?? "gemini CLI not found in PATH"));
      return;
    }

    const args = ["-p", prompt, "-o", "text"];

    // Only add --model if explicitly provided and non-empty.
    // When model is "auto" or omitted, let the CLI use its internal default.
    if (model && model !== "auto") {
      args.push("--model", model);
    }

    // Always pass --approval-mode (default: yolo for non-interactive agentic calls).
    args.push("--approval-mode", approvalMode);

    // Use the absolute path resolved at startup.
    // shell:false prevents shell injection via user-controlled prompt.
    const child = spawn(_geminiPath, args, {
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
      reject(new Error(`gemini timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`gemini exited ${code}: ${stderr.trim()}`));
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

const server = new McpServer({ name: "gemini", version: "1.0.0" });

server.tool(
  "gemini_list_models",
  "List supported Google Gemini CLI model IDs",
  {},
  async () => {
    const lines = GEMINI_MODELS.map((m) => `${m.id}  [${m.vendor}]  ${m.notes}`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.tool(
  "gemini_chat",
  [
    "Run a prompt through the Google Gemini CLI (`gemini` binary).",
    "Use for Gemini-native tasks, long-context work, multimodal, and Google-stack second opinions.",
    "Models: auto (default), gemini-3-pro-preview, gemini-3-flash-preview, gemini-2.5-pro, gemini-2.5-flash.",
    "Default approval mode: yolo (non-interactive, all tools auto-accepted).",
    "Default timeout: 300s.",
    "Auth: GEMINI_API_KEY env var OR Google OAuth (cached from interactive login).",
  ].join(" "),
  {
    prompt: z.string().describe("The prompt to send to Gemini"),
    model: z.string().optional().describe("Gemini model ID (see gemini_list_models). Omit or use 'auto' to let CLI pick the best model."),
    cwd: z.string().optional().describe("Working directory for the Gemini process. Default: process.cwd()."),
    approvalMode: z
      .enum(["default", "auto_edit", "yolo", "plan"])
      .optional()
      .describe("Tool approval mode. Default: yolo (auto-accept all tools for non-interactive agentic use)."),
  },
  async ({ prompt, model, cwd, approvalMode = "yolo" }) => {
    if (!_geminiPath) {
      return { content: [{ type: "text", text: `Error: ${_geminiPathError ?? "gemini CLI not found in PATH"}. Install the Gemini CLI (npm install -g @google/gemini-cli) and ensure it is on PATH.` }] };
    }

    const startedAt = Date.now();
    let ok = false;
    let lastErr;
    try {
      // NOTE: do NOT wrap in retry() — Gemini CLI manages its own retries.
      const text = await runGemini({ prompt, model, cwd, approvalMode });
      ok = true;
      logCall({
        mcp: "gemini", tool: "gemini_chat", model: model ?? null,
        startedAt, endedAt: Date.now(), ok,
      });
      return { content: [{ type: "text", text }] };
    } catch (err) {
      lastErr = err;
      throw err;
    } finally {
      if (!ok) {
        logCall({
          mcp: "gemini", tool: "gemini_chat", model: model ?? null,
          startedAt, endedAt: Date.now(), ok: false, error: lastErr,
        });
      }
    }
  }
);

// ─── Drift check: hand list (GEMINI_MODELS) vs models.yaml gemini: ───
// Default = warn on stderr. Set GEMINI_STRICT_MODELS=1 to fail startup (exit 3).
(function driftCheck() {
  try {
    const yamlPath = path.resolve(fileURLToPath(import.meta.url), "..", "..", "models.yaml");
    const yamlIds = loadYamlModelIds({ yamlPath, require, key: "gemini" });
    if (!yamlIds) {
      process.stderr.write("[mcp-gemini] drift check: models.yaml not parseable — skipping\n");
      return;
    }
    const handIds = GEMINI_MODELS.map((m) => m.id);
    const missingFromHand = yamlIds.filter((id) => !handIds.includes(id));
    const extraInHand = handIds.filter((id) => !yamlIds.includes(id));
    if (missingFromHand.length || extraInHand.length) {
      const msg = [
        "[mcp-gemini] DRIFT DETECTED between GEMINI_MODELS and models.yaml:",
        missingFromHand.length ? `  missing from hand list: ${missingFromHand.join(", ")}` : null,
        extraInHand.length ? `  extra in hand list: ${extraInHand.join(", ")}` : null,
        "  Fix: update GEMINI_MODELS in scripts/lib/gemini-models.mjs OR models.yaml gemini: section.",
        process.env.GEMINI_STRICT_MODELS === "1"
          ? "  GEMINI_STRICT_MODELS=1 → failing startup."
          : "  (Set GEMINI_STRICT_MODELS=1 to fail startup on drift.)",
      ].filter(Boolean).join("\n");
      process.stderr.write(msg + "\n");
      if (process.env.GEMINI_STRICT_MODELS === "1") process.exit(3);
    }
  } catch (e) {
    process.stderr.write(`[mcp-gemini] drift check failed (non-fatal): ${e.message}\n`);
  }
})();

const transport = new StdioServerTransport();
await server.connect(transport);
