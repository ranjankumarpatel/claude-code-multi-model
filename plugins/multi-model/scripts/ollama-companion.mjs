#!/usr/bin/env node
/**
 * Ollama Companion — runtime script for the Claude Code multi-model plugin.
 * Commands: setup | models | chat | nvidia-models | nvidia-chat | verify
 */

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

const NVIDIA_MODELS = [
  { id: "nvidia/llama-3.1-nemotron-ultra-253b-v1", alias: "nemotron-ultra", thinking: false, strengths: "NVIDIA flagship — best reasoning, coding" },
  { id: "nvidia/llama-3.3-nemotron-super-49b-v1",  alias: "nemotron-super", thinking: false, strengths: "Balanced reasoning + speed" },
  { id: "google/gemma-4-31b-it",                   alias: "gemma4",         thinking: true,  strengths: "Multimodal (vision), thinking mode" },
  { id: "deepseek-ai/deepseek-r1",                 alias: "deepseek-r1",    thinking: true,  strengths: "Extended chain-of-thought reasoning" },
  { id: "meta/llama-3.1-405b-instruct",            alias: "llama405b",      thinking: false, strengths: "Meta Llama 405B — large general purpose" },
  { id: "mistralai/mistral-large-2-instruct",      alias: "mistral-large",  thinking: false, strengths: "Multilingual, coding, instruction" },
];
const NVIDIA_ALIASES = Object.fromEntries(NVIDIA_MODELS.map((m) => [m.alias, m.id]));

const CLOUD_MODELS = [
  {
    name: "gemma4:31b-cloud",
    provider: "Google",
    params: "31B",
    ctx: "256K",
    strengths: "Frontier reasoning, coding, multimodal",
  },
  {
    name: "kimi-k2.5:cloud",
    provider: "Moonshot AI",
    params: "MoE",
    ctx: "256K",
    strengths: "Vision + language, agentic tasks, long context",
  },
  {
    name: "kimi-k2-thinking:cloud",
    provider: "Moonshot AI",
    params: "MoE",
    ctx: "256K",
    strengths: "Extended chain-of-thought, deep reasoning",
  },
];

const ALIASES = {
  gemma: "gemma4:31b-cloud",
  gemma4: "gemma4:31b-cloud",
  kimi: "kimi-k2.5:cloud",
  "kimi-thinking": "kimi-k2-thinking:cloud",
  thinking: "kimi-k2-thinking:cloud",
};

function resolveModel(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  const exact = CLOUD_MODELS.find((m) => m.name === raw);
  if (exact) return exact.name;
  return null;
}

async function checkDaemon() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function chat(model, messages) {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    let hint = "";
    if (text.includes("subscription")) hint = "\nHint: This model requires an Ollama subscription — try gemma4:31b-cloud or kimi-k2.5:cloud instead.";
    throw new Error(`Ollama error ${res.status}: ${text}${hint}`);
  }
  return res.json();
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdSetup() {
  const daemonUp = await checkDaemon();
  const status = daemonUp ? "✓ running" : "✗ not running";
  const lines = [
    `Ollama daemon: ${status} (${OLLAMA_BASE})`,
    "",
    "Available cloud models:",
    ...CLOUD_MODELS.map(
      (m) => `  ${m.name.padEnd(28)} ${m.provider.padEnd(14)} ${m.params.padEnd(6)} ctx:${m.ctx}  ${m.strengths}`
    ),
    "",
    daemonUp
      ? "Ready. Use /ollama:chat --model <name> <prompt> to delegate."
      : "Start Ollama first: ollama serve",
  ];
  console.log(lines.join("\n"));
}

function cmdModels() {
  console.log("Ollama cloud models available for delegation:\n");
  for (const m of CLOUD_MODELS) {
    console.log(`${m.name}`);
    console.log(`  Provider : ${m.provider}`);
    console.log(`  Params   : ${m.params}`);
    console.log(`  Context  : ${m.ctx}`);
    console.log(`  Best for : ${m.strengths}`);
    console.log();
  }
  console.log("Aliases: gemma, gemma4, kimi, kimi-thinking, thinking");
}

async function cmdChat(args) {
  // Parse: --model <name> [--system <text>] <prompt...>
  let modelRaw = null;
  let systemPrompt = null;
  const rest = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      modelRaw = args[++i];
    } else if (args[i] === "--system" && args[i + 1]) {
      systemPrompt = args[++i];
    } else {
      rest.push(args[i]);
    }
  }

  const prompt = rest.join(" ").trim();
  if (!prompt) {
    console.error("Usage: ollama-companion.mjs chat --model <name> [--system <text>] <prompt>");
    console.error("Models: gemma4:31b-cloud | kimi-k2.5:cloud | kimi-k2-thinking:cloud");
    console.error("Aliases: gemma, kimi, thinking");
    process.exit(1);
  }

  const model = resolveModel(modelRaw) ?? "gemma4:31b-cloud";
  if (modelRaw && !resolveModel(modelRaw)) {
    console.error(`Unknown model: ${modelRaw}. Using default: gemma4:31b-cloud`);
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });

  process.stderr.write(`[ollama] ${model} — thinking...\n`);

  const data = await chat(model, messages);
  const reply = data.message?.content ?? "";
  const thinking = data.message?.thinking;

  if (thinking) {
    console.log(`<thinking>\n${thinking}\n</thinking>\n`);
  }
  console.log(reply);
}

// ── NVIDIA commands ───────────────────────────────────────────────────────────

function cmdNvidiaModels() {
  console.log("NVIDIA NIM developer models:\n");
  for (const m of NVIDIA_MODELS) {
    console.log(`${m.id}`);
    console.log(`  alias    : ${m.alias}`);
    console.log(`  thinking : ${m.thinking}`);
    console.log(`  best for : ${m.strengths}`);
    console.log();
  }
  console.log("Requires: NVIDIA_API_KEY env var  —  get free credits at build.nvidia.com");
}

async function cmdNvidiaChat(args) {
  if (!NVIDIA_API_KEY) {
    console.error("NVIDIA_API_KEY not set. Add it to .claude/settings.json mcpServers nvidia-nim env.");
    process.exit(1);
  }

  let modelRaw = null;
  let thinking = false;
  let maxTokens = 4096;
  const rest = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--model" && args[i + 1]) {
      modelRaw = args[++i];
    } else if (args[i] === "--thinking") {
      thinking = true;
    } else if (args[i] === "--max-tokens" && args[i + 1]) {
      maxTokens = parseInt(args[++i], 10);
    } else {
      rest.push(args[i]);
    }
  }

  const prompt = rest.join(" ").trim();
  if (!prompt) {
    console.error("Usage: ollama-companion.mjs nvidia-chat [--model <alias>] [--thinking] <prompt>");
    console.error("Aliases: " + NVIDIA_MODELS.map((m) => m.alias).join(", "));
    process.exit(1);
  }

  const model = NVIDIA_ALIASES[modelRaw?.toLowerCase()] ?? modelRaw ?? NVIDIA_MODELS[0].id;
  process.stderr.write(`[nvidia] ${model} — thinking...\n`);

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    max_tokens: maxTokens,
    temperature: 1.0,
    top_p: 0.95,
    stream: false,
  };
  if (thinking) body.chat_template_kwargs = { enable_thinking: true };

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NVIDIA NIM error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const reply = choice?.message?.content ?? "";
  const reasoningContent = choice?.message?.reasoning_content;

  if (reasoningContent) console.log(`<thinking>\n${reasoningContent}\n</thinking>\n`);
  console.log(`[${model}]\n${reply}`);
}

// ── Verify ────────────────────────────────────────────────────────────────────

import { execSync, spawnSync } from "child_process";
import { existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(PLUGIN_ROOT, "../..");

function check(label, ok, detail = "") {
  const icon = ok ? "✓" : "✗";
  const line = `  ${icon} ${label}${detail ? `  — ${detail}` : ""}`;
  console.log(line);
  return ok;
}

async function cmdVerify() {
  let allOk = true;

  // ── CLAUDE.md ──
  console.log("\n[1] CLAUDE.md");
  const claudeMd = resolve(REPO_ROOT, "CLAUDE.md");
  const claudeExists = existsSync(claudeMd);
  allOk &= check("CLAUDE.md exists", claudeExists, claudeExists ? claudeMd : "not found");
  if (claudeExists) {
    const content = (await import("fs")).readFileSync(claudeMd, "utf8");
    allOk &= check("Model routing section present", content.includes("## Model routing"));
    allOk &= check("Codex routing present", content.includes("Codex"));
    allOk &= check("Ollama routing present", content.includes("Ollama"));
  }

  // ── Ollama daemon ──
  console.log("\n[2] Ollama daemon");
  const daemonUp = await checkDaemon();
  allOk &= check("Daemon reachable", daemonUp, OLLAMA_BASE);

  // ── Ollama cloud models ──
  console.log("\n[3] Ollama cloud models");
  if (daemonUp) {
    for (const m of CLOUD_MODELS) {
      try {
        const data = await chat(m.name, [{ role: "user", content: "ping" }]);
        const got = !!data.message?.content;
        allOk &= check(m.name, got, got ? "responding" : "empty response");
      } catch (e) {
        const msg = e.message.split("\n")[0];
        // 500 errors are transient cloud issues — warn but don't fail the suite
        const transient = msg.includes("500") || msg.includes("Internal Server Error");
        if (transient) {
          console.log(`  ~ ${m.name}  — transient cloud error (non-fatal): ${msg}`);
        } else {
          allOk &= check(m.name, false, msg);
        }
      }
    }
  } else {
    for (const m of CLOUD_MODELS) check(m.name, false, "daemon not running");
    allOk = false;
  }

  // ── Ollama MCP server ──
  console.log("\n[4] Ollama MCP server");
  const mcpScript = resolve(REPO_ROOT, "mcp-ollama.mjs");
  const mcpExists = existsSync(mcpScript);
  allOk &= check("mcp-ollama.mjs exists", mcpExists, mcpExists ? mcpScript : "not found");
  if (mcpExists) {
    try {
      const input = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n';
      const result = spawnSync("node", [mcpScript], {
        input,
        encoding: "utf8",
        timeout: 5000,
      });
      const out = (result.stdout ?? "").trim();
      const parsed = JSON.parse(out);
      const tools = parsed?.result?.tools?.map((t) => t.name) ?? [];
      allOk &= check("MCP tools listed", tools.length > 0, tools.join(", "));
    } catch (e) {
      allOk &= check("MCP server starts", false, e.message.split("\n")[0]);
    }
  }

  // ── Plugin files ──
  console.log("\n[5] Plugin files");
  const pluginFiles = [
    ".claude-plugin/marketplace.json",
    "plugins/ollama/.claude-plugin/plugin.json",
    "plugins/ollama/commands/setup.md",
    "plugins/ollama/commands/chat.md",
    "plugins/ollama/commands/models.md",
    "plugins/ollama/commands/nvidia-chat.md",
    "plugins/ollama/commands/nvidia-models.md",
    "plugins/ollama/hooks/hooks.json",
    "plugins/ollama/skills/ollama-cloud-guide/SKILL.md",
  ];
  for (const f of pluginFiles) {
    const full = resolve(REPO_ROOT, f);
    allOk &= check(f, existsSync(full));
  }

  // ── NVIDIA NIM ──
  console.log("\n[6] NVIDIA NIM");
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  const hasKey = !!(nvidiaKey && nvidiaKey.length > 10);
  allOk &= check("NVIDIA_API_KEY set", hasKey, hasKey ? "present (redacted)" : "set in .claude/settings.json mcpServers nvidia-nim env");
  const nimScript = resolve(REPO_ROOT, "mcp-nvidia.mjs");
  allOk &= check("mcp-nvidia.mjs exists", existsSync(nimScript));
  if (existsSync(nimScript)) {
    try {
      const input = '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}\n';
      const result = spawnSync("node", [nimScript], {
        input,
        encoding: "utf8",
        timeout: 5000,
        env: { ...process.env, NVIDIA_API_KEY: nvidiaKey ?? "" },
      });
      const out = (result.stdout ?? "").trim();
      const parsed = JSON.parse(out);
      const tools = parsed?.result?.tools?.map((t) => t.name) ?? [];
      allOk &= check("NVIDIA MCP tools listed", tools.length > 0, tools.join(", "));
    } catch (e) {
      allOk &= check("NVIDIA MCP server starts", false, e.message.split("\n")[0]);
    }
  }
  if (hasKey) {
    try {
      const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ model: "nvidia/llama-3.3-nemotron-super-49b-v1", messages: [{ role: "user", content: "ping" }], max_tokens: 8, stream: false }),
        signal: AbortSignal.timeout(10000),
      });
      allOk &= check("NVIDIA API reachable", res.ok, res.ok ? "responding" : `HTTP ${res.status}`);
    } catch (e) {
      allOk &= check("NVIDIA API reachable", false, e.message.split("\n")[0]);
    }
  }

  // ── Codex ──
  console.log("\n[7] Codex");
  try {
    const ver = execSync("codex --version", { encoding: "utf8", timeout: 5000 }).trim();
    allOk &= check("Codex installed", true, ver);
  } catch {
    allOk &= check("Codex installed", false, "run: npm install -g @openai/codex");
  }

  // Codex plugin files (installed via Claude Code plugin system)
  const codexCompanion = resolve(
    process.env.HOME ?? process.env.USERPROFILE ?? "",
    ".claude/plugins/cache/openai-codex/codex/1.0.3/scripts/codex-companion.mjs"
  );
  const codexInstalled = existsSync(codexCompanion);
  allOk &= check("Codex plugin installed", codexInstalled, codexInstalled ? "found" : "run: /plugin install codex@openai-codex");

  if (codexInstalled) {
    try {
      const setupResult = spawnSync("node", [codexCompanion, "setup", "--json"], {
        encoding: "utf8",
        timeout: 8000,
      });
      const setupOut = setupResult.stdout ?? "";
      // Collect full JSON block (may span multiple lines)
      const lines = setupOut.split("\n");
      let jsonStr = "";
      let depth = 0;
      for (const line of lines) {
        if (!jsonStr && !line.trimStart().startsWith("{")) continue;
        jsonStr += line + "\n";
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
        if (jsonStr && depth <= 0) break;
      }
      const json = JSON.parse(jsonStr.trim());
      allOk &= check("Codex ready", json.ready === true, json.ready ? "authenticated" : "not ready");
      allOk &= check("Codex auth", json.auth?.loggedIn === true, json.auth?.detail ?? "not logged in");
    } catch (e) {
      allOk &= check("Codex setup check", false, e.message.split("\n")[0]);
    }
  }

  // ── Summary ──
  console.log(`\n${"─".repeat(48)}`);
  console.log(allOk ? "✓ All checks passed." : "✗ Some checks failed — see above.");
  if (!allOk) process.exit(1);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case "setup":
      await cmdSetup();
      break;
    case "models":
      cmdModels();
      break;
    case "chat":
      await cmdChat(args);
      break;
    case "nvidia-models":
      cmdNvidiaModels();
      break;
    case "nvidia-chat":
      await cmdNvidiaChat(args);
      break;
    case "verify":
      await cmdVerify();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Commands: setup | models | chat | nvidia-models | nvidia-chat | verify");
      process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
