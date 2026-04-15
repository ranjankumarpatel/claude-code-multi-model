---
description: Delegate a prompt to an Ollama cloud model
argument-hint: '[--model <name>] [--system <text>] <prompt>'
allowed-tools: Bash(node:*)
---

Delegate to Ollama cloud. Raw args: `$ARGUMENTS`

## Models
- `gemma4:31b-cloud` (alias `gemma`) — coding + reasoning, default
- `kimi-k2.5:cloud` (alias `kimi`) — vision, agentic
- `kimi-k2-thinking:cloud` (alias `thinking`) — deep CoT

## Run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" chat $ARGUMENTS
```

Show response verbatim. Preserve `<thinking>` blocks (collapse OK, don't drop).
