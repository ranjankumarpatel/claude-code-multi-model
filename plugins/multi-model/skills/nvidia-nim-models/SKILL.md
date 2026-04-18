---
name: multi-model-nvidia-nim-models
description: Deep dive on the 10 NVIDIA NIM frontier models served by the `mcp__nvidia-nim` MCP. Use when the user mentions NVIDIA, NIM, names a NIM-hosted model (nemotron-ultra, nemotron-super, qwen3-coder, devstral, kimi-k2-coder, deepseek-coder, gemma4, llama405b, mistral-large, granite-guardian), asks for best-in-class coding or reasoning, wants multimodal vision, or when routing rubric points to NIM. Requires `NVIDIA_API_KEY`.
---

# NVIDIA NIM Models — `mcp__nvidia-nim`

10 frontier models hosted on NVIDIA NIM. Call via `mcp__nvidia-nim__nvidia_chat` with the `model` alias below.

**Env**: `NVIDIA_API_KEY` (required).

**Source-of-truth**: `plugins/multi-model/scripts/mcp-nvidia.mjs` + `MODELS.md`. Note: `deepseek-r1` reached EOL 2026-01-26 (410 Gone). Use `nemotron-ultra` (reasoning) or `kimi-k2-thinking:cloud` (Ollama) as replacements.

## Model catalog

| Alias | Model ID | Think | Best for |
|---|---|---|---|
| `qwen3-coder` | qwen/qwen3-coder-480b-a35b-instruct | no | **Best agentic coding** — 480B MoE, repo-level edits. **NIM default for code.** |
| `devstral` | mistralai/devstral-2-123b-instruct-2512 | no | Heavy SWE agent, repo-scale refactor |
| `kimi-k2-coder` | moonshotai/kimi-k2-instruct-0905 | no | Long-ctx coding + agentic tool calling |
| `deepseek-coder` | deepseek-ai/deepseek-v3_1-terminus | no | Coding + tool-calling, math/logic |
| `nemotron-ultra` | nvidia/llama-3.1-nemotron-ultra-253b-v1 | no | **NVIDIA flagship** — best reasoning + coding |
| `nemotron-super` | nvidia/llama-3.3-nemotron-super-49b-v1 | no | Balanced reasoning + speed |
| `gemma4` | google/gemma-4-31b-it | **yes** | Multimodal (vision) + thinking mode |
| `llama405b` | meta/llama-3.1-405b-instruct | no | Meta 405B general-purpose, large ctx (may 404 per-tier) |
| `mistral-large` | mistralai/mistral-large-2-instruct | no | Multilingual, coding, instruction following |
| `granite-guardian` | ibm/granite-guardian-3_0-8b | no | Risk/guardrail: bias, harm, hallucination, jailbreak |

## Decision rules

### Code generation / refactor (pick one)

1. **`qwen3-coder`** — default NIM coding pick. 480B MoE, best agentic coding on NIM.
2. **`devstral`** — repo-scale SWE refactor.
3. **`kimi-k2-coder`** — when long context is the dominant constraint.
4. **`deepseek-coder`** — code with math/logic mixed in.

### Deep reasoning

1. **`nemotron-ultra`** — NVIDIA flagship. Best NIM pick for hard reasoning.
2. **`nemotron-super`** — 49B balanced speed/quality.
3. **`gemma4`** w/ thinking mode — when vision is also needed.

### Multimodal / vision

- **`gemma4`** — only multimodal NIM model. Enables thinking mode for visual reasoning.

### Multilingual

- **`mistral-large`** — Mistral 2-instruct, strong non-English coding and text.

### Large general-purpose

- **`llama405b`** — Meta 405B. Caveat: may 404 on some tiers; fall back to `nemotron-ultra`.

### Safety / risk classification

- **`granite-guardian`** — enterprise risk signals (bias, hallucination, jailbreak).
- For full security workflow, prefer `mcp__nvidia-security` instead of NIM.

## Invocation pattern

```jsonc
// Via mcp__nvidia-nim__nvidia_chat
{
  "model": "qwen3-coder",
  "messages": [
    { "role": "user", "content": "Refactor this module..." }
  ]
}
```

Thinking-mode models (`gemma4`) may emit a thinking trace — consume or discard per need.

## Common pitfalls

- **`deepseek-r1` is EOL** — returns 410. Use `nemotron-ultra` or `kimi-k2-thinking:cloud`.
- **`google/shieldgemma-9b` reached EOL 2026-04-15.** Use `llama-guard` (NIM) or `nemotron-safety` (security) instead.
- **`llama405b` 404 on some tiers** — fall back to `nemotron-ultra` on failure.
- **Model alias vs full ID** — MCP accepts the alias column above.
- **Using NIM guardians for full audits** — they classify but don't reason about vulns. Route to `mcp__nvidia-security` for audits.
- **Picking nemotron-super when ultra is available** — super is for latency-critical paths only.
