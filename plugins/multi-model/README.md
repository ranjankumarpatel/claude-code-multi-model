# multi-model plugin

Portable Claude Code plugin for multi-model orchestration: delegate to Ollama cloud, NVIDIA NIM, NVIDIA Security NIM, GitHub Copilot CLI, and Codex from any Claude Code project.

## Install

Add to your project's `.claude-plugin/marketplace.json`:

```json
{
  "plugins": [
    { "name": "multi-model", "source": "./plugins/multi-model", "version": "1.2.0" }
  ]
}
```

Or reference this repo directly as a marketplace source.

## Requirements

| Dependency | Notes |
|---|---|
| `node` on PATH | Required for all MCP server scripts |
| `@modelcontextprotocol/sdk` + `zod` globally | Set `MCP_GLOBAL_MODULES` to your global `node_modules` path |
| `OLLAMA_HOST` | Optional. Default: `http://localhost:11434`. Must be running for Ollama cloud models. |
| `NVIDIA_API_KEY` | Required for NVIDIA NIM and NVIDIA Security commands |
| `GH_TOKEN` or `GITHUB_TOKEN` | Required for GitHub Copilot CLI; PAT with `Copilot Requests` scope |
| `npm install -g @github/copilot` | Required for Copilot CLI integration |
| Codex plugin installed | Required for `/multi-model:codex` commands |

## Commands

| Command | Description |
|---|---|
| `/multi-model:delegate` | Auto-route a task — Opus picks models, dispatches in parallel, Codex verifies |
| `/multi-model:ollama` | Delegate a prompt to an Ollama cloud model |
| `/multi-model:nvidia` | Delegate a prompt to a NVIDIA NIM frontier model |
| `/multi-model:nvidia-security` | Security audit / PII / guardrail task via NVIDIA Security NIM |
| `/multi-model:copilot` | Delegate a prompt to GitHub Copilot CLI |
| `/multi-model:codex` | Hand off to Codex for review, rescue, or adversarial verification |
| `/multi-model:models` | List all available delegation models across providers |
| `/multi-model:test-all-models` | Fire canary ping against every executor and MCP endpoint, render status table |

## Skills

| Skill | Trigger |
|---|---|
| `multi-model-orchestrator` | Auto-triggers on any non-trivial task. Opus plans + synthesizes; Sonnet/Haiku/Ollama/NVIDIA/Codex execute in parallel; Codex verifies before merge. |
| `ollama-mcp` | Triggered by "ollama", "gemma", "kimi", second-opinion requests, vision/multimodal tasks, deep chain-of-thought, or long-context agentic work. |
| `nvidia-nim-mcp` | Triggered by "nvidia", "nemotron", "qwen", "devstral", "llama 405", "mistral large", or frontier-quality needs outside Anthropic. Requires `NVIDIA_API_KEY`. |
| `nvidia-security-mcp` | Triggered for security audits, CVE/OWASP/SAST triage, threat modeling, prompt-injection detection, PII scrubbing, compliance review. Requires `NVIDIA_API_KEY`. |
| `copilot-mcp` | Triggered by "copilot", named Copilot models, or cross-vendor second-opinion requests. Requires `GITHUB_TOKEN` or `copilot auth login`. |

## MCP Servers

Four MCP servers are bundled and auto-loaded via `plugin.json`. No project-level `.mcp.json` needed.

| Server | Script | Tools provided |
|---|---|---|
| `ollama` | `scripts/mcp-ollama.mjs` | `ollama_chat`, `ollama_list_models` — Ollama cloud model chat |
| `nvidia-nim` | `scripts/mcp-nvidia.mjs` | `nvidia_chat`, `nvidia_list_models` — NVIDIA NIM general models |
| `nvidia-security` | `scripts/mcp-security-nvidia.mjs` | `nvidia_security_chat`, `nvidia_security_list_models` — NVIDIA Security NIM models |
| `copilot` | `scripts/mcp-copilot.mjs` | `copilot_chat`, `copilot_list_models` — GitHub Copilot CLI models |

## Configuration

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | For NVIDIA commands | API key from [build.nvidia.com](https://build.nvidia.com) |
| `OLLAMA_HOST` | Optional | Ollama server URL. Default: `http://localhost:11434` |
| `GH_TOKEN` / `GITHUB_TOKEN` | For Copilot command | GitHub PAT with `Copilot Requests` scope |
| `MCP_GLOBAL_MODULES` | Optional | Path to global `node_modules` for MCP SDK resolution |

### Ollama cloud models

| Alias / Model | Strengths |
|---|---|
| `gemma4:31b-cloud` (default) | Coding, reasoning, multimodal — peer to Sonnet |
| `kimi-k2.5:cloud` (`kimi`) | Vision+language, agentic, long-context |
| `kimi-k2-thinking:cloud` (`thinking`) | Deep chain-of-thought reasoning |
| `glm-5.1:cloud` | Agentic coding, SWE-Bench SOTA |
| `qwen3-coder:480b-cloud` | Very large context coding tasks |
| `devstral-2:123b-cloud` | Repo-level edits, multi-file refactors |
| `kimi-k2:1t-cloud` | Long-context agentic work |
| `glm-4.6:cloud` | Advanced coding and reasoning |
| `qwen3-coder-next:cloud` | Next-gen long-context coding |
| `devstral-small-2:24b-cloud` | Lightweight code edits |
| `minimax-m2:cloud` | Multimodal agentic tasks |
| `deepseek-v3.2:cloud` | Advanced reasoning and coding |
| `gpt-oss:120b-cloud` | Large open-source alternative |
| `nemotron-3-super:cloud` | NVIDIA reasoning model |
| `mistral-large-3:675b-cloud` | Very large multilingual + vision |

### NVIDIA NIM models

| Alias | Model ID | Best for |
|---|---|---|
| `nemotron-ultra` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | Best reasoning + coding, flagship (default) |
| `nemotron-super` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Balanced speed + quality |
| `gemma4` | `google/gemma-4-31b-it` | Multimodal vision, thinking mode |
| `llama405b` | `meta/llama-3.1-405b-instruct` | Large general purpose |
| `mistral-large` | `mistralai/mistral-large-2-instruct` | Multilingual, coding |

Note: `deepseek-r1` reached EOL 2026-01-26 (410 Gone). Use `nemotron-ultra` or `kimi-k2-thinking:cloud` for deep reasoning.

### NVIDIA Security models

| Alias | Role |
|---|---|
| `nemotron-ultra` (default) | Vulnerability analysis, secure-code review, compliance audits |
| `llama-guard` | Jailbreak / prompt-injection / policy screening |
| `nemotron-safety` | LLM I/O moderation, harmful content gating |
| `nemotron-safety-reason` | Safety classification with justification |
| `granite-guardian` | Bias, harm, hallucination, jailbreak, function-call risk |
| `shieldgemma` | Content-policy moderation |
| `gliner-pii` | PII extraction / redaction (GDPR/HIPAA pre-processing) |

### GitHub Copilot models

| Model | Strengths |
|---|---|
| `claude-sonnet-4.6` (default) | Coding + reasoning |
| `claude-opus-4.6` | Planning, architecture, complex reasoning |
| `claude-haiku-4.5` | Fast coding, bulk tasks |
| `gpt-5.3-codex` | Code generation and completion |
| `gemini-3-pro` | Long-context, vision+language |
| `gpt-5` | General-purpose frontier, reasoning, vision |

Each Copilot prompt costs 1 premium request from your monthly allocation.
