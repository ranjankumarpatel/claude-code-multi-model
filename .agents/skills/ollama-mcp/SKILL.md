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

| Model | Family | Strengths | Use when |
|---|---|---|---|
| `gemma4:31b-cloud` | Google | 31B, 256K ctx, frontier coding + reasoning, multimodal | Default second-opinion. Coding, refactors, reasoning. Peer to Sonnet. |
| `kimi-k2.5:cloud` | Moonshot | MoE, 256K ctx, native multimodal, agentic tool use | Vision+language, agentic workflows, long-context reading, image understanding. |
| `kimi-k2-thinking:cloud` | Moonshot | MoE, 256K ctx, extended chain-of-thought | Hard reasoning, multi-step proofs, deep debugging. Peer to Opus for reasoning-only. |
| `kimi-k2:1t-cloud` | Moonshot | 1T MoE, 256K ctx, tool calling, coding agent | Large-scale agentic coding, complex multi-tool orchestration. |
| `glm-5.1:cloud` | Z.ai | MoE, 198K ctx, SWE-Bench Pro SOTA | Best agentic coding tasks; top-tier repo-level edits and tool calling. |
| `glm-4.6:cloud` | Z.ai | MoE, 198K ctx, agentic + reasoning | Agentic coding with strong reasoning; second choice after glm-5.1. |
| `qwen3-coder:480b-cloud` | Alibaba | 480B, 256K ctx, long-context coding | Very large context coding tasks, deep repo analysis, agentic. |
| `qwen3-coder-next:cloud` | Alibaba | MoE, 256K ctx, agentic coding | Agentic local-dev style coding; lighter than 480b. |
| `devstral-2:123b-cloud` | Mistral | 123B, 256K ctx, repo edits + tool calling | Repo-level edits, multi-file refactors with tool use. |
| `devstral-small-2:24b-cloud` | Mistral | 24B, 256K ctx, lightweight agentic | Fast agentic coding when full 123B is overkill. |
| `minimax-m2:cloud` | MiniMax | MoE, 200K ctx, high-efficiency agentic | Efficient multi-step agentic tasks and tool calling. |
| `deepseek-v3.2:cloud` | DeepSeek | MoE, 160K ctx, reasoning + agentic | Efficient reasoning + agentic coding; good cost/quality ratio. |
| `gpt-oss:120b-cloud` | OpenAI | 120B, 256K ctx, reasoning + agentic | OpenAI open-weight; reasoning and agentic tasks, cross-vendor compare. |
| `nemotron-3-super:cloud` | NVIDIA | 120B MoE, 128K ctx, agentic + tool use | NVIDIA agentic coding; strong tool calling at 120B scale. |
| `mistral-large-3:675b-cloud` | Mistral | 675B MoE, 256K ctx, multimodal + tools | Production multimodal with vision + tool calling at maximum scale. |

## Decision rules

- **Second opinion requested** → `gemma4:31b-cloud` unless user names another.
- **Image / screenshot / multimodal input** → `kimi-k2.5:cloud` or `mistral-large-3:675b-cloud`.
- **"Think harder", root-cause dive, proof-style** → `kimi-k2-thinking:cloud`.
- **Agentic coding / SWE-Bench style task** → `glm-5.1:cloud` (first choice) or `devstral-2:123b-cloud`.
- **Long-context repo analysis** → `qwen3-coder:480b-cloud`.
- **Fast agentic execution** → `devstral-small-2:24b-cloud` or `minimax-m2:cloud`.
- **Cross-vendor OpenAI comparison** → `gpt-oss:120b-cloud`.
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
