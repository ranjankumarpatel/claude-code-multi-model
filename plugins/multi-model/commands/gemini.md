---
description: Delegate a prompt to Google Gemini CLI
argument-hint: '[--model <name>] [--approval-mode <mode>] [--cwd <path>] <prompt>'
allowed-tools: mcp__gemini__gemini_chat, mcp__gemini__gemini_list_models
---

Delegate to Google Gemini CLI. Raw args: `$ARGUMENTS`

## Models

| Model | Notes |
|---|---|
| *(omitted / `auto`)* | **Default** — smart routing, CLI picks best Gemini model per task |
| `gemini-3-pro-preview` | Gemini 3 Pro — flagship, deep reasoning, long-context |
| `gemini-3-flash-preview` | Gemini 3 Flash — fast Gemini 3 tier |
| `gemini-2.5-pro` | Gemini 2.5 Pro — stable production tier |
| `gemini-2.5-flash` | Gemini 2.5 Flash — fast, cheap bulk tasks |

**Recommendation**: omit `--model` (or pass `auto`) to let the CLI route intelligently. Only specify a model when you need a particular tier or version.

## Auth

- `GEMINI_API_KEY` env var (preferred for automated/non-interactive use), **or**
- Google OAuth: run `gemini` interactively once to authenticate; credentials are cached.
- `GOOGLE_API_KEY` and `GOOGLE_APPLICATION_CREDENTIALS` are also forwarded if set.

## Approval mode

Default: `yolo` — all tools are auto-accepted for non-interactive agentic calls. Override with `--approval-mode`:
- `default` — prompt for approval on each tool call
- `auto_edit` — auto-accept file edits, prompt for others
- `yolo` — auto-accept all tools (default for MCP use)
- `plan` — plan only, no execution

## Invoke

Parse `$ARGUMENTS` to extract optional `--model <name>`, `--approval-mode <mode>`, and `--cwd <path>` flags; the remainder is the prompt.

Call the MCP tool:
```
mcp__gemini__gemini_chat({
  prompt: "<extracted prompt>",
  model: "<model if --model was given>",          // omit if not specified
  approvalMode: "<mode if --approval-mode given>", // omit if not specified
  cwd: "<path if --cwd was given>"                 // omit if not specified
})
```

Show response verbatim. No premium-request cost — uses the user's own Google account quota.
