#!/usr/bin/env node
/**
 * Ollama MCP Server for Claude Code
 * Supports both local Ollama models and Ollama cloud models.
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

const OLLAMA_BASE = process.env.OLLAMA_HOST ?? "http://localhost:11434";

// Cloud models confirmed working (free tier via Ollama cloud routing)
const CLOUD_MODELS = [
  { name: "gemma4:31b-cloud",      provider: "Google",    params: "31B", ctx: "256K", notes: "Frontier-level, multimodal, coding+reasoning" },
  { name: "kimi-k2.5:cloud",       provider: "Moonshot",  params: "MoE", ctx: "256K", notes: "Native multimodal, vision+language, agentic" },
  { name: "kimi-k2-thinking:cloud",provider: "Moonshot",  params: "MoE", ctx: "256K", notes: "Extended thinking / chain-of-thought" },
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
    throw new Error(`Ollama error ${res.status}: ${text}`);
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
    "Available models: gemma4:31b-cloud (Google, frontier reasoning+coding+multimodal),",
    "kimi-k2.5:cloud (Moonshot, vision+language+agentic),",
    "kimi-k2-thinking:cloud (Moonshot, extended chain-of-thought thinking).",
    "Delegate to gemma4 for coding/reasoning, kimi-k2.5 for multimodal/agentic, kimi-k2-thinking for deep reasoning.",
  ].join(" "),
  {
    model: z
      .enum(["gemma4:31b-cloud", "kimi-k2.5:cloud", "kimi-k2-thinking:cloud"])
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
    const data = await ollamaFetch("/api/chat", { model, messages, stream: false });
    const reply = data.message?.content ?? "";
    const thinking = data.message?.thinking;
    const out = thinking ? `<thinking>\n${thinking}\n</thinking>\n\n${reply}` : reply;
    return { content: [{ type: "text", text: out }] };
  }
);


const transport = new StdioServerTransport();
await server.connect(transport);
