---
description: Delegate a prompt to a NVIDIA NIM frontier model
argument-hint: '[--model <name>] [--thinking] [--max-tokens <n>] <prompt>'
allowed-tools: Bash(node:*)
---

Delegate to NVIDIA NIM. Raw args: `$ARGUMENTS`

## Aliases
| Alias | Model | Best for |
|---|---|---|
| `nemotron-ultra` | llama-3.1-nemotron-ultra-253b-v1 | Reasoning+coding (default) |
| `nemotron-super` | llama-3.3-nemotron-super-49b-v1 | Balanced/fast |
| `gemma4` | google/gemma-4-31b-it | Multimodal, thinking |
| `deepseek-r1` | deepseek-ai/deepseek-r1 | CoT reasoning |
| `llama405b` | meta/llama-3.1-405b-instruct | General large |
| `mistral-large` | mistralai/mistral-large-2-instruct | Multilingual+code |

Flags: `--model`, `--thinking`, `--max-tokens <n>` (default 4096). Requires `NVIDIA_API_KEY`.

## Run

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ollama-companion.mjs" nvidia-chat $ARGUMENTS
```

Prefix output with resolved model ID. Preserve `<thinking>` blocks.
