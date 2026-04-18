#!/usr/bin/env node
/**
 * Ollama MCP Server for Claude Code
 * Supports both local Ollama models and Ollama cloud models.
 */
import { createRequireFromLocalFirst, retry, logCall } from "./lib/common.mjs";
const require = createRequireFromLocalFirst(import.meta.url);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? "http://localhost:11434";

// Cloud models confirmed working (free tier via Ollama cloud routing)
const CLOUD_MODELS = [
  // --- Existing frontier models ---
  { name: "gemma4:31b-cloud",           provider: "Google",    params: "31B",  ctx: "256K", notes: "Frontier-level, multimodal, coding+reasoning" },
  { name: "kimi-k2.5:cloud",            provider: "Moonshot",  params: "MoE",  ctx: "256K", notes: "Native multimodal, vision+language, agentic" },
  { name: "kimi-k2-thinking:cloud",     provider: "Moonshot",  params: "MoE",  ctx: "256K", notes: "Extended thinking / chain-of-thought" },

  // --- Agentic coding (tool-calling) additions ---
  { name: "deepseek-v3.2:cloud",        provider: "DeepSeek",  params: "MoE",  ctx: "160K", notes: "Efficient reasoning + agentic coding" },
  { name: "devstral-2:123b-cloud",      provider: "Mistral",   params: "123B", ctx: "256K", notes: "Repo-level edits, tool calling, agentic" },
  { name: "devstral-small-2:24b-cloud", provider: "Mistral",   params: "24B",  ctx: "256K", notes: "Lightweight agentic coding with tool use" },
  { name: "glm-4.6:cloud",              provider: "Z.ai",      params: "MoE",  ctx: "198K", notes: "Agentic + reasoning + coding" },
  { name: "glm-5.1:cloud",              provider: "Z.ai",      params: "MoE",  ctx: "198K", notes: "Frontier agentic, SWE-Bench Pro SOTA" },
  { name: "gpt-oss:120b-cloud",         provider: "OpenAI",    params: "120B", ctx: "256K", notes: "OpenAI open-weight reasoning + agentic" },
  { name: "kimi-k2:1t-cloud",           provider: "Moonshot",  params: "1T",   ctx: "256K", notes: "MoE coding agent, tool calling" },
  { name: "minimax-m2:cloud",           provider: "MiniMax",   params: "MoE",  ctx: "200K", notes: "High-efficiency coding + agentic" },
  { name: "mistral-large-3:675b-cloud", provider: "Mistral",   params: "675B", ctx: "256K", notes: "Multimodal MoE, vision+tools, production" },
  { name: "nemotron-3-super:cloud",     provider: "NVIDIA",    params: "120B", ctx: "128K", notes: "NVIDIA 120B MoE agentic, strong tool use" },
  { name: "qwen3-coder-next:cloud",     provider: "Alibaba",   params: "MoE",  ctx: "256K", notes: "Agentic coding, local-dev focus" },
  { name: "qwen3-coder:480b-cloud",     provider: "Alibaba",   params: "480B", ctx: "256K", notes: "Long-context coding + agentic, 480B" },
];

const CLOUD_MODEL_NAMES = CLOUD_MODELS.map((m) => m.name);

async function ollamaFetch(path, body) {
  const res = await fetch(`${OLLAMA_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Ollama error ${res.status}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}


const server = new McpServer({
  name: "ollama",
  version: "1.1.0",
});

// List cloud models
server.tool(
  "ollama_list_models",
  "List all available Ollama cloud models",
  {},
  async () => {
    const cloud = CLOUD_MODELS.map(
      (m) => `${m.name} — ${m.provider} ${m.params}, ${m.ctx} ctx — ${m.notes}`
    );
    return { content: [{ type: "text", text: cloud.join("\n") }] };
  }
);

// Chat — cloud models only
server.tool(
  "ollama_chat",
  [
    "Chat with an Ollama cloud model.",
    "Models: gemma4:31b-cloud (Google, frontier coding+multimodal),",
    "kimi-k2.5:cloud (Moonshot, vision+agentic), kimi-k2-thinking:cloud (Moonshot, chain-of-thought),",
    "kimi-k2:1t-cloud (Moonshot 1T MoE, coding agent),",
    "glm-5.1:cloud (Z.ai, SWE-Bench SOTA agentic), glm-4.6:cloud (Z.ai, agentic+reasoning),",
    "qwen3-coder:480b-cloud (Alibaba 480B, long-context coding), qwen3-coder-next:cloud (Alibaba, agentic coding),",
    "devstral-2:123b-cloud (Mistral 123B, repo edits+tools), devstral-small-2:24b-cloud (Mistral 24B, lightweight agentic),",
    "minimax-m2:cloud (MiniMax MoE, high-efficiency agentic), deepseek-v3.2:cloud (DeepSeek, efficient reasoning+agentic),",
    "gpt-oss:120b-cloud (OpenAI 120B, reasoning+agentic), nemotron-3-super:cloud (NVIDIA 120B MoE, agentic),",
    "mistral-large-3:675b-cloud (Mistral 675B, multimodal+tools).",
  ].join(" "),
  {
    model: z
      .enum([
        "gemma4:31b-cloud",
        "kimi-k2.5:cloud",
        "kimi-k2-thinking:cloud",
        "kimi-k2:1t-cloud",
        "glm-5.1:cloud",
        "glm-4.6:cloud",
        "qwen3-coder:480b-cloud",
        "qwen3-coder-next:cloud",
        "devstral-2:123b-cloud",
        "devstral-small-2:24b-cloud",
        "minimax-m2:cloud",
        "deepseek-v3.2:cloud",
        "gpt-oss:120b-cloud",
        "nemotron-3-super:cloud",
        "mistral-large-3:675b-cloud",
      ])
      .describe("Cloud model to use"),
    messages: z
      .array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
      )
      .describe("Conversation messages"),
  },
  async ({ model, messages }) => {
    const startedAt = Date.now();
    let ok = false;
    let lastErr;
    try {
      const data = await retry(() =>
        ollamaFetch("/api/chat", { model, messages, stream: false })
      );
      const reply = data.message?.content ?? "";
      const thinking = data.message?.thinking;
      const out = thinking ? `<thinking>\n${thinking}\n</thinking>\n\n${reply}` : reply;
      ok = true;
      const usage = data.prompt_eval_count != null || data.eval_count != null
        ? { in: data.prompt_eval_count ?? null, out: data.eval_count ?? null }
        : { in: null, out: null };
      logCall({
        mcp: "ollama", tool: "ollama_chat", model,
        startedAt, endedAt: Date.now(), ok,
        tokensIn: usage.in, tokensOut: usage.out,
      });
      return { content: [{ type: "text", text: out }] };
    } catch (err) {
      lastErr = err;
      throw err;
    } finally {
      if (!ok) {
        logCall({
          mcp: "ollama", tool: "ollama_chat", model,
          startedAt, endedAt: Date.now(), ok: false, error: lastErr,
        });
      }
    }
  }
);


const transport = new StdioServerTransport();
await server.connect(transport);
