#!/usr/bin/env node
/**
 * NVIDIA NIM MCP Server for Claude Code
 * OpenAI-compatible API via https://integrate.api.nvidia.com/v1
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

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const API_KEY = process.env.NVIDIA_API_KEY;

if (!API_KEY) {
  process.stderr.write("NVIDIA_API_KEY env var not set. Set it in .claude/settings.json mcpServers env.\n");
}

const NVIDIA_MODELS = [
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    alias: "qwen3-coder",
    strengths: "Best-in-class agentic coding — 480B MoE, repo-level edits, tool use. Default for code tasks.",
    thinking: false,
  },
  {
    id: "mistralai/devstral-2-123b-instruct-2512",
    alias: "devstral",
    strengths: "Heavy coding / software-engineering agent, repo-scale refactors",
    thinking: false,
  },
  {
    id: "moonshotai/kimi-k2-instruct-0905",
    alias: "kimi-k2-coder",
    strengths: "Long-context coding + agentic tool calling",
    thinking: false,
  },
  {
    id: "deepseek-ai/deepseek-v3_1-terminus",
    alias: "deepseek-coder",
    strengths: "Strong coding + tool-calling, math/logic",
    thinking: false,
  },
  {
    id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    alias: "nemotron-ultra",
    strengths: "NVIDIA flagship — best reasoning, coding, instruction following",
    thinking: false,
  },
  {
    id: "nvidia/llama-3.3-nemotron-super-49b-v1",
    alias: "nemotron-super",
    strengths: "Balanced reasoning + speed, strong coding",
    thinking: false,
  },
  {
    id: "google/gemma-4-31b-it",
    alias: "gemma4",
    strengths: "Multimodal (vision), thinking mode, coding+reasoning",
    thinking: true,
  },
  {
    // NOTE: llama405b may return 404 "not found for account" on some NVIDIA API keys
    // (not provisioned for all tiers). Leave alias in for keys that have access.
    id: "meta/llama-3.1-405b-instruct",
    alias: "llama405b",
    strengths: "Meta Llama 405B — general purpose, large context",
    thinking: false,
  },
  {
    id: "mistralai/mistral-large-2-instruct",
    alias: "mistral-large",
    strengths: "Mistral Large — strong multilingual, coding, instruction",
    thinking: false,
  },
  {
    id: "ibm/granite-guardian-3_0-8b",
    alias: "granite-guardian",
    strengths: "Risk/guardrail classifier — bias, harm, hallucination, jailbreak, function-call risk",
    thinking: false,
  },
  {
    id: "google/shieldgemma-9b",
    alias: "shieldgemma",
    strengths: "Policy-driven safety classifier — harassment, dangerous content, hate",
    thinking: false,
  },
];

const ALIASES = Object.fromEntries(NVIDIA_MODELS.map((m) => [m.alias, m.id]));

function resolveModel(raw) {
  if (!raw) return NVIDIA_MODELS[0].id;
  return ALIASES[raw.toLowerCase()] ?? raw;
}

async function nimChat({ model, messages, thinking = false, maxTokens = 4096 }) {
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 1.0,
    top_p: 0.95,
    stream: false,
  };
  if (thinking) {
    body.chat_template_kwargs = { enable_thinking: true };
  }

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`NVIDIA NIM error ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new McpServer({ name: "nvidia-nim", version: "1.0.0" });

// List models
server.tool(
  "nvidia_list_models",
  "List available NVIDIA NIM developer models",
  {},
  async () => {
    const lines = NVIDIA_MODELS.map(
      (m) => `${m.id}\n  alias: ${m.alias}  thinking: ${m.thinking}\n  ${m.strengths}`
    );
    return { content: [{ type: "text", text: lines.join("\n\n") }] };
  }
);

// Chat
server.tool(
  "nvidia_chat",
  [
    "Chat with a NVIDIA NIM developer model. OpenAI-compatible API.",
    "Models: nemotron-ultra (best reasoning), nemotron-super (balanced), gemma4 (multimodal+thinking),",
    "llama405b (large general), mistral-large (multilingual).",
    "Delegate to NVIDIA when: need frontier-quality outside Anthropic, code generation at scale,",
    "multimodal vision tasks, or deep reasoning with thinking mode.",
  ].join(" "),
  {
    model: z
      .string()
      .optional()
      .describe(
        "Model ID or alias. Aliases: qwen3-coder, devstral, kimi-k2-coder, deepseek-coder, nemotron-ultra, nemotron-super, gemma4, llama405b, mistral-large, granite-guardian, shieldgemma. Default: nemotron-ultra."
      ),
    messages: z
      .array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
      )
      .describe("Conversation messages"),
    thinking: z
      .boolean()
      .optional()
      .describe("Enable extended thinking/CoT (supported by gemma4). Default: false."),
    max_tokens: z.number().optional().describe("Max tokens in response. Default: 4096."),
  },
  async ({ model, messages, thinking = false, max_tokens = 4096 }) => {
    const resolvedModel = resolveModel(model);
    const data = await nimChat({ model: resolvedModel, messages, thinking, maxTokens: max_tokens });
    const choice = data.choices?.[0];
    const reply = choice?.message?.content ?? "";
    const reasoningContent = choice?.message?.reasoning_content;
    const out = reasoningContent
      ? `<thinking>\n${reasoningContent}\n</thinking>\n\n${reply}`
      : reply;
    return { content: [{ type: "text", text: out }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
