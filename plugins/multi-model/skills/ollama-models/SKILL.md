---
name: multi-model-ollama-models
description: Deep dive on the 15 Ollama cloud models served by the `mcp__ollama` MCP. Use when the user mentions Ollama, names an Ollama-hosted model (gemma4, kimi, deepseek, devstral, glm, gpt-oss, minimax, mistral-large-3, nemotron-3-super, qwen3-coder), asks for a second-opinion cloud model, wants agentic coding via Ollama, or when routing rubric points to Ollama. Requires `OLLAMA_HOST` (default http://localhost:11434).
---

# Ollama Cloud Models — `mcp__ollama`

15 frontier-class cloud models accessed through a single Ollama-compatible endpoint. Call via `mcp__ollama__ollama_chat` with the `model` field set to the exact model name below.

**Env**: `OLLAMA_HOST` (defaults to `http://localhost:11434`).

**Source-of-truth**: `plugins/multi-model/scripts/mcp-ollama.mjs` + `MODELS.md`.

## Model catalog

| Model | Params | Ctx | Best for | Pick over alternatives when |
|---|---|---|---|---|
| `gemma4:31b-cloud` | 31B | 256K | Frontier-level coding + reasoning + multimodal | Peer to Sonnet; want Google stack; multimodal needed |
| `kimi-k2.5:cloud` | MoE | 256K | Native multimodal, vision+language, agentic | Vision task + long context + tool use |
| `kimi-k2-thinking:cloud` | MoE | 256K | Extended thinking / chain-of-thought | Hard reasoning puzzle, math, multi-step logic |
| `deepseek-v3.2:cloud` | MoE | 160K | Efficient reasoning + agentic coding | Cost-efficient alt to nemotron-ultra |
| `devstral-2:123b-cloud` | 123B | 256K | Repo-level edits, tool calling, SWE agent | Multi-file refactor, test generation |
| `devstral-small-2:24b-cloud` | 24B | 256K | Lightweight agentic coding w/ tool use | Bulk simple edits, fast iterations |
| `glm-4.6:cloud` | MoE | 198K | Agentic + reasoning + coding | Balanced agentic task |
| `glm-5.1:cloud` | MoE | 198K | **SWE-Bench Pro SOTA** — frontier agentic | Hard repo-level engineering task |
| `gpt-oss:120b-cloud` | 120B | 256K | Open-weight reasoning + agentic | OpenAI-lineage quality, open license |
| `kimi-k2:1t-cloud` | 1T MoE | 256K | Coding agent, tool calling | Max-capability agentic coding |
| `minimax-m2:cloud` | MoE | 200K | High-efficiency coding + agentic | Speed-priority agentic task |
| `mistral-large-3:675b-cloud` | 675B | 256K | Multimodal MoE, vision+tools, production | Vision + tools at flagship scale |
| `nemotron-3-super:cloud` | 120B | 128K | NVIDIA 120B MoE, strong tool use | NVIDIA lineage via Ollama |
| `qwen3-coder-next:cloud` | MoE | 256K | Agentic coding, local-dev focus | Local-feeling dev agent experience |
| `qwen3-coder:480b-cloud` | 480B | 256K | Long-context coding + agentic | Large codebase-aware edits |

## Decision rules

### Agentic coding (pick one)

1. **`glm-5.1:cloud`** — SWE-Bench Pro SOTA. Default choice for hard repo engineering.
2. **`qwen3-coder:480b-cloud`** — long-context (repo aware) large-codebase edits.
3. **`devstral-2:123b-cloud`** — SWE agent with strong tool calling.
4. **`kimi-k2:1t-cloud`** — maximum capacity, slowest.
5. **`minimax-m2:cloud`** / **`devstral-small-2:24b-cloud`** — fast/cheap iteration.

### Deep reasoning

1. **`kimi-k2-thinking:cloud`** — extended thinking; best single pick for puzzles.
2. **`gpt-oss:120b-cloud`** — OpenAI-lineage reasoning, open weights.
3. **`deepseek-v3.2:cloud`** — efficient reasoning fallback.

### Multimodal / vision

1. **`kimi-k2.5:cloud`** — native multimodal, agentic.
2. **`mistral-large-3:675b-cloud`** — flagship multimodal.
3. **`gemma4:31b-cloud`** — Google multimodal, smaller.

### Second-opinion / alt-frontier

- For a non-Anthropic second opinion on a Sonnet output, use **`gemma4:31b-cloud`** or **`glm-5.1:cloud`**.

## Invocation pattern

```jsonc
// Via mcp__ollama__ollama_chat
{
  "model": "glm-5.1:cloud",
  "messages": [
    { "role": "system", "content": "You are an expert SWE agent." },
    { "role": "user", "content": "..." }
  ]
}
```

For delegation via the `Agent` tool, pass the user prompt + instruct the subagent to call `mcp__ollama__ollama_chat` with the chosen model.

## Common pitfalls

- **Model name typos** — the `:cloud` suffix is required for cloud variants.
- **`OLLAMA_HOST` unset** — defaults to localhost which won't reach cloud models unless a relay is configured.
- **Picking the 1T model by default** — overkill for most tasks; prefer `glm-5.1:cloud` or `qwen3-coder:480b-cloud`.
- **Using Ollama for security work** — route to `mcp__nvidia-security` instead.
