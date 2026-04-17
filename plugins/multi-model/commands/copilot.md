---
description: Delegate a prompt to GitHub Copilot CLI
argument-hint: '[--model <name>] [--cwd <path>] <prompt>'
allowed-tools: mcp__copilot__copilot_chat, mcp__copilot__copilot_list_models
---

Delegate to GitHub Copilot. Raw args: `$ARGUMENTS`

## Models
- `claude-sonnet-4.6` (default) — coding + reasoning
- `claude-opus-4.6` — planning, architecture, complex reasoning
- `claude-haiku-4.5` — fast coding, bulk tasks
- `gpt-5.3-codex` — code generation and completion
- `gemini-3-pro` — long-context, vision
- `gpt-5` — general-purpose frontier, reasoning, vision

Requires `npm install -g @github/copilot` and `copilot auth login` (or `GITHUB_TOKEN` PAT with Copilot scope).

## Invoke

Parse `$ARGUMENTS` to extract optional `--model <name>` and `--cwd <path>` flags; the remainder is the prompt.

Call the MCP tool:
```
mcp__copilot__copilot_chat({
  prompt: "<extracted prompt>",
  model: "<model if --model was given>",   // omit if not specified
  cwd: "<path if --cwd was given>"         // omit if not specified
})
```

Show response verbatim. Cost: 1 premium request per prompt (metered from monthly allocation).
