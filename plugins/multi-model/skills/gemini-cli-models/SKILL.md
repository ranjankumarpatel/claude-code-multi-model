---
name: multi-model-gemini-cli-models
description: Deep dive on the 5 Gemini CLI models served by the `mcp__gemini` MCP (Google Gemini CLI). Use when the user mentions gemini, gemini-3, gemini-2.5, google gemini, vertex ai gemini, wants long-context or multimodal work via Google's own CLI, or wants a Google-stack second opinion. No premium cost — uses the user's own Google account. `auto` model is default and recommended. Requires `GEMINI_API_KEY` or Google OAuth (run `gemini` once interactively to cache credentials).
---

# Google Gemini CLI Models — `mcp__gemini`

5 models from Google, reached through the Gemini CLI (`gemini` binary, `@google/gemini-cli` npm package). Call via `mcp__gemini__gemini_chat` with the optional `model` field set to the exact name below.

**Cost**: **No premium cost** — uses the user's own Google account/API key quota.

**Env**: `GEMINI_API_KEY` (or `GOOGLE_API_KEY` / `GOOGLE_APPLICATION_CREDENTIALS`) for automated use. Google OAuth available for interactive setups (run `gemini` once to cache credentials).

**Default approval mode**: `yolo` — all tool calls are auto-accepted for non-interactive agentic use.

**Source-of-truth**: `plugins/multi-model/scripts/mcp-gemini.mjs` + `MODELS.md`.

## Model catalog

| Model | Vendor | Best for |
|---|---|---|
| *(omit / `auto`)* | Google | **Default** — smart routing, CLI picks best Gemini model per task complexity |
| `gemini-3-pro-preview` | Google | Flagship reasoning, deep chain-of-thought, long-context (>256k) |
| `gemini-3-flash-preview` | Google | Fast Gemini 3 tier — latency-sensitive tasks |
| `gemini-2.5-pro` | Google | Stable production — multimodal, long-context |
| `gemini-2.5-flash` | Google | Fast, cheap bulk tasks |

**Recommended default**: omit `model` or pass `auto`. The CLI's smart routing selects the best Gemini model for the task without requiring you to guess the tier.

## When to use Gemini CLI (and when NOT to)

### Use Gemini when

- **Long-context** — 256k+ context window for large codebases, documents, or transcripts.
- **Multimodal** — image, PDF, or mixed-media tasks via Google's native pipeline.
- **Google-stack second opinion** — compare against Claude/GPT on the same prompt, free.
- **`gemini-3-pro-preview`** specifically — Google's flagship reasoning model.
- **Bulk / cheap tasks** — `gemini-2.5-flash` is fast and low-cost.
- **Vertex AI / Google Cloud context** — native integration, no adapter layer.

### Skip Gemini when

- Sonnet/Haiku can handle it via native `Agent` tool (zero network round-trips).
- Task needs NVIDIA-specific models (nemotron-ultra, NIM security) — route to NIM instead.
- Task is security audit / PII / guardrails — route to NVIDIA Security.
- No `GEMINI_API_KEY` and no cached OAuth — the MCP will fail on auth.

## Decision rules

### Auto (default — recommended)

- Omit `model` in the call or pass `"auto"`. The CLI's internal router picks the best Gemini tier.
- No `--model` flag is added to the child process argv, which keeps calls future-proof.

### Deep reasoning / long-context

1. **`gemini-3-pro-preview`** — Google's flagship. Use for complex reasoning, planning, or documents >256k tokens.

### Fast / latency-sensitive

1. **`gemini-3-flash-preview`** — fastest Gemini 3 tier.
2. **`gemini-2.5-flash`** — stable flash tier, cheapest bulk option.

### Stable production

1. **`gemini-2.5-pro`** — production-grade, multimodal, long-context.

### Cross-vendor comparison

- Fan out the same prompt to `mcp__gemini__gemini_chat` + `mcp__copilot__copilot_chat` (gpt-5.3-codex) + Sonnet in parallel, synthesize.

## Invocation pattern

```jsonc
// Default — let CLI route automatically
mcp__gemini__gemini_chat({
  "prompt": "Summarize this 300k-token codebase and suggest refactors",
  "approvalMode": "yolo"
})

// Specific model
mcp__gemini__gemini_chat({
  "prompt": "Analyze this architecture diagram",
  "model": "gemini-3-pro-preview",
  "approvalMode": "yolo"
})

// Bulk / cheap
mcp__gemini__gemini_chat({
  "prompt": "Rename all snake_case variables to camelCase in this file",
  "model": "gemini-2.5-flash",
  "approvalMode": "yolo"
})
```

## Common pitfalls

- **Passing `model: "auto"` explicitly** — the MCP correctly omits `--model` from argv when `auto` or empty is given, so this is safe. Just omitting `model` entirely is cleaner.
- **Missing `GEMINI_API_KEY` and no cached OAuth** — the Gemini CLI will fail on auth. Set `GEMINI_API_KEY` in env or run `gemini` interactively once to cache Google OAuth credentials.
- **Assuming `auto` always picks `gemini-3-pro-preview`** — the CLI's smart routing may pick a faster or cheaper tier for simpler tasks. Specify `gemini-3-pro-preview` explicitly if you need the flagship.
- **Using `approvalMode: "default"` in non-interactive MCP calls** — this will hang waiting for user input. Always use `yolo` (the default) or `auto_edit` for MCP invocations.
- **Not setting `cwd` for file-aware tasks** — if the Gemini CLI needs to read local files, pass `cwd` pointing to the workspace root.
