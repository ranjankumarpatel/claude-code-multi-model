#!/usr/bin/env node
/**
 * NVIDIA NIM MCP Server — Security & Audit edition
 * Curated models for cybersecurity, code audit, safety moderation, PII, guardrails.
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

const SECURITY_MODELS = [
  {
    id: "deepseek-ai/deepseek-r1",
    alias: "deepseek-r1",
    role: "audit-reasoner",
    strengths: "Deep chain-of-thought — root-cause analysis, threat modeling, exploit reasoning, code audits",
    thinking: true,
  },
  {
    id: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    alias: "nemotron-ultra",
    role: "audit-reasoner",
    strengths: "Flagship reasoning — vulnerability analysis, secure-code review, compliance audits",
    thinking: false,
  },
  {
    id: "qwen/qwen3-coder-480b-a35b-instruct",
    alias: "qwen3-coder",
    role: "code-auditor",
    strengths: "Agentic code auditing — SAST-style review, taint analysis, fix suggestions",
    thinking: false,
  },
  {
    id: "mistralai/devstral-2-123b-instruct-2512",
    alias: "devstral",
    role: "code-auditor",
    strengths: "Repo-scale secure-code review, dependency / IaC audits",
    thinking: false,
  },
  {
    id: "meta/llama-guard-4-12b",
    alias: "llama-guard",
    role: "safety-classifier",
    strengths: "Multimodal (text+image) safety classifier — prompt-injection, jailbreak, policy violations",
    thinking: false,
  },
  {
    id: "nvidia/llama-3_1-nemotron-safety-guard-8b-v3",
    alias: "nemotron-safety",
    role: "safety-classifier",
    strengths: "LLM I/O moderation — harmful content, policy gating, guardrails",
    thinking: false,
  },
  {
    id: "nvidia/nemotron-content-safety-reasoning-4b",
    alias: "nemotron-safety-reason",
    role: "safety-classifier",
    strengths: "Reasoning-based safety classifier with justification — NeMo Guardrails",
    thinking: false,
  },
  {
    id: "ibm/granite-guardian-3_0-8b",
    alias: "granite-guardian",
    role: "risk-classifier",
    strengths: "Enterprise risk classifier — bias, harm, hallucination, jailbreak, function-call risk",
    thinking: false,
  },
  {
    id: "google/shieldgemma-9b",
    alias: "shieldgemma",
    role: "risk-classifier",
    strengths: "Policy-driven safety classifier — harassment, dangerous content, sexual, hate",
    thinking: false,
  },
  {
    id: "nvidia/gliner-pii",
    alias: "gliner-pii",
    role: "pii-detector",
    strengths: "PII detection / redaction in text pipelines — GDPR/HIPAA pre-processing",
    thinking: false,
  },
];

const ALIASES = Object.fromEntries(SECURITY_MODELS.map((m) => [m.alias, m.id]));

function resolveModel(raw) {
  if (!raw) return SECURITY_MODELS[0].id;
  return ALIASES[raw.toLowerCase()] ?? raw;
}

async function nimChat({ model, messages, thinking = false, maxTokens = 4096 }) {
  const body = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature: 0.2,
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

const server = new McpServer({ name: "nvidia-nim-security", version: "1.0.0" });

server.tool(
  "nvidia_security_list_models",
  "List curated NVIDIA NIM models for cybersecurity, code audit, safety, PII, and guardrail tasks",
  {},
  async () => {
    const lines = SECURITY_MODELS.map(
      (m) =>
        `${m.id}\n  alias: ${m.alias}  role: ${m.role}  thinking: ${m.thinking}\n  ${m.strengths}`
    );
    return { content: [{ type: "text", text: lines.join("\n\n") }] };
  }
);

server.tool(
  "nvidia_security_chat",
  [
    "Chat with a NVIDIA NIM security/audit model. OpenAI-compatible API.",
    "Roles: audit-reasoner (deepseek-r1, nemotron-ultra), code-auditor (qwen3-coder, devstral),",
    "safety-classifier (llama-guard, nemotron-safety, nemotron-safety-reason),",
    "risk-classifier (granite-guardian, shieldgemma), pii-detector (gliner-pii).",
    "Use for: authorized pentest reasoning, code-review for CVEs/OWASP, SAST triage, threat modeling,",
    "prompt-injection detection, LLM output moderation, PII scrubbing, compliance audits.",
    "Default: deepseek-r1 (reasoning). Temperature set low (0.2) for auditable, deterministic output.",
  ].join(" "),
  {
    model: z
      .string()
      .optional()
      .describe(
        "Model ID or alias. Aliases: deepseek-r1, nemotron-ultra, qwen3-coder, devstral, llama-guard, nemotron-safety, nemotron-safety-reason, granite-guardian, shieldgemma, gliner-pii. Default: deepseek-r1."
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
      .describe("Enable extended thinking/CoT (best for deepseek-r1 on audit reasoning). Default: false."),
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
