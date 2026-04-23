---
description: List all available delegation models across providers
allowed-tools: mcp__ollama__ollama_list_models, mcp__nvidia-nim__nvidia_list_models, mcp__nvidia-security__nvidia_security_list_models, mcp__copilot__copilot_list_models, mcp__gemini__gemini_list_models, mcp__opencode__opencode_list_models
---

List available models grouped by provider.

## Anthropic (Claude)
- `claude-opus-4-7` — orchestrator / advisor
- `claude-sonnet-4-6` — reasoning executor
- `claude-haiku-4-5` — bulk / simple executor

## GitHub Copilot CLI (`mcp__copilot__copilot_list_models`)
Call the tool, render list. Cost: 1 premium request per call.

Key models: `gpt-5.3-codex`, `gemini-3-pro`, `gpt-5`, `claude-sonnet-4.6`, `claude-opus-4.6`, `claude-haiku-4.5`.

## Google Gemini CLI (`mcp__gemini__gemini_list_models`)
Call the tool, render list. No premium-request cost (user's Google account quota).

Key models: `auto` (default), `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`.

## opencode CLI (`mcp__opencode__opencode_list_models`)
Call the tool, render list. Free-tier only (paid models rejected by MCP).

Key models: `opencode/big-pickle` (default), `opencode/ling-2.6-flash-free`, `opencode/nemotron-3-super-free`, `opencode/minimax-m2.5-free`.

## Ollama cloud (`mcp__ollama__ollama_list_models`)
Call the tool, render list.

Key models: `gemma4:31b-cloud`, `kimi-k2.5:cloud`, `kimi-k2-thinking:cloud`.

## NVIDIA NIM (`mcp__nvidia-nim__nvidia_list_models`)
Call the tool, render list. Requires `NVIDIA_API_KEY`.

Key models: `nemotron-ultra`, `nemotron-super`, `gemma4`, `llama405b`, `mistral-large`.

## NVIDIA Security (`mcp__nvidia-security__nvidia_security_list_models`)
Call the tool, render list.

Use for: security audit, CVE, OWASP, SAST, PII, prompt-injection, compliance.

## Codex
- `mcp__codex__codex_exec` — rescue / fix (`codex exec --full-auto`)
- `mcp__codex__codex_review` — diff review (read-only)
- Fallback slash commands: `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`
