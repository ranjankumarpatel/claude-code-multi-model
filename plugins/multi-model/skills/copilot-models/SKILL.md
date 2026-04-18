---
name: multi-model-copilot-models
description: Deep dive on the 6 cross-vendor models served by the `mcp__copilot` MCP (GitHub Copilot CLI). Use when the user mentions Copilot, asks for GPT-5.3-Codex / GPT-5 / Gemini 3 Pro / claude-opus-4.6 / claude-sonnet-4.6 / claude-haiku-4.5, wants a cross-vendor second opinion through unified GitHub auth, or needs a model not available via Ollama/NIM. Each call costs 1 premium request — skip for trivial tasks. Requires `GH_TOKEN` or `GITHUB_TOKEN` with Copilot Requests scope.
---

# GitHub Copilot CLI Models — `mcp__copilot`

6 frontier models from multiple vendors, reached through one GitHub auth. Call via `mcp__copilot__copilot_chat` with the `model` field set to the exact name below.

**Cost**: **1 premium request per call.** Gate on non-trivial value.

**Env**: `GH_TOKEN` or `GITHUB_TOKEN` with Copilot Requests scope, active Copilot subscription.

**Source-of-truth**: `plugins/multi-model/scripts/mcp-copilot.mjs` + `MODELS.md`.

## Model catalog

| Model | Vendor | Best for |
|---|---|---|
| `claude-opus-4.6` | Anthropic | Planning, architecture, complex reasoning (cross-auth Opus) |
| `claude-sonnet-4.6` | Anthropic | Balanced coding + reasoning (cross-auth Sonnet) |
| `claude-haiku-4.5` | Anthropic | Fast, lightweight (cross-auth Haiku) |
| `gpt-5.3-codex` | OpenAI | **Code generation + completion — OpenAI's coding flagship** |
| `gemini-3-pro` | Google | Multimodal, long-context (beyond 256k) |
| `gpt-5` | OpenAI | General-purpose frontier |

## When to use Copilot (and when NOT to)

### Use Copilot when

- **GPT-5.3-Codex** specifically — OpenAI's strongest code model, not available elsewhere in this plugin.
- **Gemini 3 Pro** specifically — for >256k context, multimodal, or Google-stack comparison.
- **Cross-vendor second opinion** — compare Claude + GPT + Gemini on the same prompt.
- **GPT-5** general-purpose outputs.

### Skip Copilot when

- Sonnet/Haiku can handle it via native `Agent` tool (no premium cost).
- Task is bulk / trivial (reads, renames, formatting) — route to Haiku.
- Task is agentic coding — `qwen3-coder` (NIM) or `glm-5.1:cloud` (Ollama) are free-tier and competitive.
- User hasn't opted into premium spend.

## Decision rules

### Code generation (pick one)

1. **`gpt-5.3-codex`** — default Copilot coding pick. OpenAI-stack completion quality.
2. **`claude-sonnet-4.6`** — only if you want Sonnet through Copilot auth (e.g., quota-split).

### Long-context / multimodal

1. **`gemini-3-pro`** — >256k context, strong multimodal.

### Cross-vendor comparison

- Fan out the same prompt to `claude-sonnet-4.6` + `gpt-5.3-codex` + `gemini-3-pro` in parallel, synthesize.

### General-purpose frontier

- **`gpt-5`** — OpenAI generalist.

## Invocation pattern

```jsonc
// Via mcp__copilot__copilot_chat
{
  "model": "gpt-5.3-codex",
  "messages": [
    { "role": "user", "content": "..." }
  ]
}
```

## Cost management

- **Log the premium-request cost** in the routing report: `Routing: code gen → gpt-5.3-codex via Copilot (1 premium req).`
- Batch multiple questions into one call where possible.
- For repeated calls, prefer a free-tier executor unless the vendor-specific capability matters.
- `mcp__copilot__copilot_list_models` returns the live model list — check if a model seems missing.

## Common pitfalls

- **Calling Copilot when Sonnet would suffice** — you paid a premium request for nothing.
- **Missing `GH_TOKEN` / `GITHUB_TOKEN`** — the MCP will fail silently on auth; check env.
- **Assuming Copilot Claude models are the same as native Claude** — they're the same weights but route through different billing; quota distinct.
- **Parallelizing 5 Copilot calls for a trivial task** — 5 premium requests. Budget before fanning out.
