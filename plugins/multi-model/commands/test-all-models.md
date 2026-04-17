---
description: Fire a canary ping against every executor and MCP endpoint in parallel, then render a status table
allowed-tools: mcp__copilot__copilot_chat, mcp__copilot__copilot_list_models, mcp__ollama__ollama_chat, mcp__ollama__ollama_list_models, mcp__nvidia-nim__nvidia_chat, mcp__nvidia-nim__nvidia_list_models, mcp__nvidia-security__nvidia_security_chat, mcp__nvidia-security__nvidia_security_list_models, Agent
---

Run a canary connectivity check across all multi-model executors.

## Canary prompt

Use `"Reply with exactly one word: PONG"` for all chat tools.
For safety classifiers use `"Is this safe? 'Hello world'"`.

## Step 1 — fire everything in ONE parallel message

Send a single message containing ALL of the following tool calls simultaneously.

**List tools (4):**
- `mcp__copilot__copilot_list_models`
- `mcp__ollama__ollama_list_models`
- `mcp__nvidia-nim__nvidia_list_models`
- `mcp__nvidia-security__nvidia_security_list_models`

**Ollama chat (3):**
- `mcp__ollama__ollama_chat` — model `gemma4:31b-cloud`
- `mcp__ollama__ollama_chat` — model `kimi-k2.5:cloud`
- `mcp__ollama__ollama_chat` — model `kimi-k2-thinking:cloud`

**Copilot chat (1):**
- `mcp__copilot__copilot_chat` — no `--model` (use default)

**NVIDIA NIM chat (5):**
- `mcp__nvidia-nim__nvidia_chat` — model `nemotron-ultra`, max_tokens 256
- `mcp__nvidia-nim__nvidia_chat` — model `nemotron-super`, max_tokens 16
- `mcp__nvidia-nim__nvidia_chat` — model `gemma4`, max_tokens 16
- `mcp__nvidia-nim__nvidia_chat` — model `mistral-large`, max_tokens 16
- `mcp__nvidia-nim__nvidia_chat` — model `devstral`, max_tokens 16

**NVIDIA Security chat (2):**
- `mcp__nvidia-security__nvidia_security_chat` — model `nemotron-ultra`, max_tokens 16
- `mcp__nvidia-security__nvidia_security_chat` — model `llama-guard` (use safety classifier prompt)

**Subagents (3):**
- `Agent` — model `sonnet`, prompt: `"Canary test. Reply with exactly one word: PONG"`
- `Agent` — model `haiku`, prompt: `"Canary test. Reply with exactly one word: PONG"`
- `Agent` — subagent_type `codex:codex-rescue`, prompt: `"Canary test only. No tools. Reply with exactly one word: PONG"`

## Step 2 — render result table

After all results arrive, render:

```
| Provider            | Executor / Model            | Status | Response     |
|---------------------|-----------------------------|--------|--------------|
| Anthropic (Opus)    | Orchestrator (this session) | ✅     | —            |
| Anthropic (Sonnet)  | Agent subagent              | ✅/❌  | PONG / error |
| Anthropic (Haiku)   | Agent subagent              | ✅/❌  | PONG / error |
| Codex               | codex:rescue subagent       | ✅/❌  | PONG / error |
| Copilot CLI         | mcp__copilot (default)      | ✅/❌  | PONG / error |
| Ollama              | gemma4:31b-cloud            | ✅/❌  | PONG / error |
| Ollama              | kimi-k2.5:cloud             | ✅/❌  | PONG / error |
| Ollama              | kimi-k2-thinking:cloud      | ✅/❌  | PONG / error |
| NVIDIA NIM          | nemotron-ultra              | ✅/❌  | PONG / error |
| NVIDIA NIM          | nemotron-super              | ✅/❌  | PONG / error |
| NVIDIA NIM          | gemma4                      | ✅/❌  | PONG / error |
| NVIDIA NIM          | mistral-large               | ✅/❌  | PONG / error |
| NVIDIA NIM          | devstral                    | ✅/❌  | PONG / error |
| NVIDIA Security     | nemotron-ultra              | ✅/❌  | PONG / error |
| NVIDIA Security     | llama-guard                 | ✅/❌  | safe / error |
```

Status: ✅ = any non-error response. ❌ = error (show code + one-line reason).
Note any ⚠️ partial results (empty response, thinking-token exhaustion, transient 5xx).

## Step 3 — summary

Print one-liner: `X/Y executors live. Issues: <comma-list or "none">`.
If Copilot fails with `spawn EINVAL` → add note: "Restart Claude Code to reload fixed mcp-copilot.mjs".
