---
name: ollama-mcp
description: Delegate tasks to Ollama cloud models via the `ollama` MCP server. Use when user says "ollama", "gemma", "kimi", asks for a second opinion, wants vision/multimodal, deep chain-of-thought, or long-context agentic work. Auto-triggers for tasks routable to non-Anthropic frontier models listed below.
---

# Ollama Cloud MCP Orchestrator

Pick the right Ollama cloud model and invoke it through the `ollama` MCP server.

## Tools

- `mcp__ollama__ollama_list_models` — list cloud models.
- `mcp__ollama__ollama_chat` — send messages. Args: `model` (enum), `messages` (role/content array).

## Model routing

| Model | Strengths | Use when |
|---|---|---|
| `gemma4:31b-cloud` | 31B, 256K ctx, frontier coding + reasoning, multimodal | Default. Coding, refactors, reasoning, Google-ecosystem context. Peer to Sonnet. |
| `kimi-k2.5:cloud` | MoE, 256K ctx, native multimodal, agentic tool use | Vision+language, agentic workflows, long-context reading, image understanding. |
| `kimi-k2-thinking:cloud` | MoE, 256K ctx, extended chain-of-thought | Hard reasoning, multi-step proofs, deep debugging. Peer to Opus for reasoning-only. |

## Decision rules

- **Second opinion requested** → `gemma4:31b-cloud` unless user names another.
- **Image / screenshot / multimodal input** → `kimi-k2.5:cloud`.
- **"Think harder", root-cause dive, proof-style** → `kimi-k2-thinking:cloud`.
- **Bulk/simple** → prefer Haiku locally. Don't burn cloud quota.
- **Secrets / credentials in prompt** → do not send. Redact first.

## Invocation pattern

```
mcp__ollama__ollama_chat({
  model: "gemma4:31b-cloud",
  messages: [
    { role: "system", content: "You are reviewing a diff." },
    { role: "user", content: "<diff or task>" }
  ]
})
```

Thinking output (from `kimi-k2-thinking`) returned wrapped in `<thinking>…</thinking>` — surface reasoning separately from answer.

## Orchestration pattern

Opus plans → delegate independent chunks to Ollama in parallel with Sonnet/Haiku/Codex → Opus synthesizes. Fire multiple `Agent` / MCP calls in one message when chunks are independent.

## Failure modes

- Daemon unreachable → tell user to run `ollama serve` or check `OLLAMA_HOST`.
- Model not pulled → cloud models need active Ollama cloud auth; surface the error, don't retry blindly.
