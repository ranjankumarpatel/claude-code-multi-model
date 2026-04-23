/**
 * MCP health-check tests for all multi-model MCP servers.
 * Spawns each server as a child process, sends JSON-RPC initialize + tools/list,
 * verifies expected tools are registered, then shuts down.
 *
 * Run:   npm test  (from plugins/multi-model/)
 * Or:    node --test tests/mcp-health.test.mjs
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPTS_DIR = path.resolve(__dirname, "..", "scripts");

const MCP_SERVERS = [
  {
    name: "ollama",
    script: "mcp-ollama.mjs",
    expectedTools: ["ollama_chat", "ollama_list_models"],
  },
  {
    name: "nvidia-nim",
    script: "mcp-nvidia.mjs",
    expectedTools: ["nvidia_chat", "nvidia_list_models"],
  },
  {
    name: "nvidia-security",
    script: "mcp-security-nvidia.mjs",
    expectedTools: ["nvidia_security_chat", "nvidia_security_list_models"],
  },
  {
    name: "copilot",
    script: "mcp-copilot.mjs",
    expectedTools: ["copilot_chat", "copilot_list_models"],
  },
  {
    name: "codex",
    script: "mcp-codex.mjs",
    expectedTools: ["codex_exec", "codex_review"],
  },
  {
    name: "gemini",
    script: "mcp-gemini.mjs",
    expectedTools: ["gemini_chat", "gemini_list_models"],
  },
  {
    name: "opencode",
    script: "mcp-opencode.mjs",
    expectedTools: ["opencode_run", "opencode_list_models"],
  },
];

function jsonRpcMessage(method, id, params = {}) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
}

function parseJsonRpcResponses(raw) {
  const results = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed));
    } catch {
      // partial or non-JSON line — skip
    }
  }
  return results;
}

function spawnMcp(scriptPath, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        MCP_GLOBAL_MODULES:
          process.env.MCP_GLOBAL_MODULES ??
          path.resolve(__dirname, "..", "node_modules"),
      },
      cwd: path.resolve(__dirname, ".."),
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ stdout, stderr, timedOut: true, code: null });
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, timedOut: false, code });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    const initMsg = jsonRpcMessage("initialize", 1, {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "health-check", version: "1.0.0" },
    });
    child.stdin.write(initMsg);

    setTimeout(() => {
      try {
        const listMsg = jsonRpcMessage("tools/list", 2);
        child.stdin.write(listMsg);
      } catch {
        // stdin may have closed if process exited early
      }
    }, 2000);

    setTimeout(() => {
      try {
        child.stdin.end();
      } catch { /* ignore */ }
    }, 4000);
  });
}

describe("MCP server health checks", () => {
  for (const { name, script, expectedTools } of MCP_SERVERS) {
    test(`${name} (${script}) — starts, responds to initialize, registers expected tools`, async () => {
      const scriptPath = path.join(SCRIPTS_DIR, script);

      const { stdout, stderr } = await spawnMcp(scriptPath);

      // Server should have produced some stdout (JSON-RPC responses)
      const responses = parseJsonRpcResponses(stdout);

      // Find initialize response (id: 1)
      const initResp = responses.find((r) => r.id === 1);
      assert.ok(
        initResp,
        `${name}: no initialize response received. stderr: ${stderr.slice(0, 500)}`
      );
      assert.ok(
        initResp.result,
        `${name}: initialize response has no result. Got: ${JSON.stringify(initResp).slice(0, 300)}`
      );
      assert.ok(
        initResp.result.serverInfo || initResp.result.capabilities,
        `${name}: initialize result missing serverInfo or capabilities`
      );

      // Find tools/list response (id: 2)
      const toolsResp = responses.find((r) => r.id === 2);
      assert.ok(
        toolsResp,
        `${name}: no tools/list response received. stderr: ${stderr.slice(0, 500)}`
      );
      assert.ok(
        toolsResp.result,
        `${name}: tools/list response has no result. Got: ${JSON.stringify(toolsResp).slice(0, 300)}`
      );

      const toolNames = (toolsResp.result.tools ?? []).map((t) => t.name);

      for (const expected of expectedTools) {
        assert.ok(
          toolNames.includes(expected),
          `${name}: missing expected tool "${expected}". Found tools: [${toolNames.join(", ")}]`
        );
      }
    });
  }
});

describe("MCP server syntax checks", () => {
  for (const { name, script } of MCP_SERVERS) {
    test(`${name} (${script}) — passes Node syntax check`, async () => {
      const scriptPath = path.join(SCRIPTS_DIR, script);
      const result = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["--check", scriptPath], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (d) => { stderr += d; });
        child.on("close", (code) => resolve({ code, stderr }));
        child.on("error", reject);
      });

      assert.equal(
        result.code,
        0,
        `${name}: syntax check failed (exit ${result.code}). ${result.stderr.slice(0, 500)}`
      );
    });
  }
});
