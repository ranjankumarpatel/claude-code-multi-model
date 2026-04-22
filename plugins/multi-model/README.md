# multi-model plugin

Portable Claude Code plugin for multi-model orchestration: delegate to Ollama cloud, NVIDIA NIM, NVIDIA Security, GitHub Copilot CLI, Google Gemini CLI, opencode CLI, and Codex from any Claude Code project.

## Install

Add to your project's `.claude-plugin/marketplace.json`:

```json
{
  "plugins": [
    { "name": "multi-model", "source": "./plugins/multi-model", "version": "1.3.0" }
  ]
}
```

Or reference this repo directly as a marketplace source.

## Requirements

| Dependency | Notes |
|---|---|
| `node` on PATH | Required for all MCP server scripts |
| `npm install` inside the plugin | Installs `@modelcontextprotocol/sdk`, `zod`, `js-yaml` into local `node_modules`. No global install required. |
| `OLLAMA_HOST` | Optional. Default: `http://localhost:11434`. Must be running for Ollama cloud models. |
| `NVIDIA_API_KEY` | Required for NVIDIA NIM and NVIDIA Security commands |
| `GH_TOKEN` or `GITHUB_TOKEN` | Required for GitHub Copilot CLI; PAT with `Copilot Requests` scope |
| `npm install -g @github/copilot` | Required for Copilot CLI integration |
| `GEMINI_API_KEY` or Google OAuth | Required for Gemini CLI. Run `gemini` once interactively for OAuth, or set `GEMINI_API_KEY`. |
| `npm install -g opencode-ai` | Required for opencode CLI. Auth: `opencode providers login`. |
| `npm install -g @openai/codex` | Required for direct `codex` CLI (preferred Codex path). Bypasses openai-codex plugin's Landlock sandbox. |
| `codex login` (ChatGPT subscription) | **Auth source.** Credentials cached in `~/.codex/auth.json`. No `OPENAI_API_KEY` needed. |
| openai-codex plugin installed | Optional fallback for `/codex:*` slash commands when the direct CLI is unavailable. |
| `MCP_GLOBAL_MODULES` | Optional (legacy). Fallback path to a global `node_modules` if plugin-local `node_modules` is missing. |

## Commands

| Command | Description |
|---|---|
| `/multi-model:delegate` | Auto-route a task — Opus picks models, dispatches in parallel, Codex verifies |
| `/multi-model:ollama` | Delegate a prompt to an Ollama cloud model |
| `/multi-model:nvidia` | Delegate a prompt to a NVIDIA NIM frontier model |
| `/multi-model:nvidia-security` | Security audit / PII / guardrail task via NVIDIA Security NIM |
| `/multi-model:copilot` | Delegate a prompt to GitHub Copilot CLI (1 premium request per call) |
| `/multi-model:gemini` | Delegate a prompt to Google Gemini CLI (no premium cost) |
| `/multi-model:opencode` | Delegate a prompt to opencode CLI (free-tier models only) |
| `/multi-model:codex` | Hand off to Codex for review, rescue, or adversarial verification |
| `/multi-model:models` | List all available delegation models across providers |
| `/multi-model:test-all-models` | Fire canary ping against every executor and MCP endpoint, render status table |

## Skills

| Skill | Trigger |
|---|---|
| `multi-model-orchestrator` | Auto-triggers on any non-trivial task. Opus plans + synthesizes; Sonnet/Haiku/Ollama/NVIDIA/Copilot/Gemini/Codex execute in parallel; Codex verifies. |
| `multi-model-advisor` | Triggered by questions about models — "which model for X?", "compare A vs B", "recommend", "tradeoffs". Does not dispatch work. |
| `multi-model-ollama-models` | Triggered by "ollama", "gemma", "kimi", "deepseek", "devstral", "glm", "qwen3-coder", second-opinion, vision/multimodal, deep CoT, or long-context agentic work. |
| `multi-model-nvidia-nim-models` | Triggered by "nvidia", "nemotron", "qwen3-coder", "devstral", "gemma4", "llama405b", or frontier coding/reasoning needs. Requires `NVIDIA_API_KEY`. |
| `multi-model-nvidia-security-models` | Triggered for security audits, CVE/OWASP/SAST triage, threat modeling, prompt-injection detection, PII scrubbing, compliance review. Requires `NVIDIA_API_KEY`. |
| `multi-model-copilot-models` | Triggered by "copilot", "gpt-5.3-codex", "gemini-3-pro", or cross-vendor second-opinion requests. Requires `GITHUB_TOKEN`. |
| `multi-model-gemini-cli-models` | Triggered by "gemini", Google-stack tasks, long-context, or multimodal work via Google's own CLI. No premium cost. |

## MCP Servers

Seven MCP servers are bundled and auto-loaded via `plugin.json`. No project-level `.mcp.json` needed.

| Server | Script | Tools provided |
|---|---|---|
| `ollama` | `scripts/mcp-ollama.mjs` | `ollama_chat`, `ollama_list_models` — 15 Ollama cloud models |
| `nvidia-nim` | `scripts/mcp-nvidia.mjs` | `nvidia_chat`, `nvidia_list_models` — 10 NVIDIA NIM frontier models |
| `nvidia-security` | `scripts/mcp-security-nvidia.mjs` | `nvidia_security_chat`, `nvidia_security_list_models` — 8 security/audit/guardrail models |
| `copilot` | `scripts/mcp-copilot.mjs` | `copilot_chat`, `copilot_list_models` — 6 cross-vendor models via GitHub Copilot |
| `gemini` | `scripts/mcp-gemini.mjs` | `gemini_chat`, `gemini_list_models` — 5 Google Gemini models (no premium cost) |
| `opencode` | `scripts/mcp-opencode.mjs` | `opencode_run`, `opencode_list_models` — 4 free-tier cross-vendor models |
| `codex` | `scripts/mcp-codex.mjs` | `codex_exec`, `codex_review` — direct `codex exec` CLI (bypasses openai-codex plugin sandbox) |

## Configuration

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | For NVIDIA commands | API key from [build.nvidia.com](https://build.nvidia.com) |
| `OLLAMA_HOST` | Optional | Ollama server URL. Default: `http://localhost:11434` |
| `GH_TOKEN` / `GITHUB_TOKEN` | For Copilot command | GitHub PAT with `Copilot Requests` scope |
| `GEMINI_API_KEY` | For Gemini command | Google AI API key. Alt: `GOOGLE_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, or Google OAuth. |
| `OPENCODE_SERVER_PASSWORD` | Optional | opencode server auth. Alt: `opencode providers login` for interactive auth. |
| `MCP_GLOBAL_MODULES` | Optional (legacy) | Fallback path to a global `node_modules`. Prefer `npm install` inside the plugin. |

### Models

44 models across 6 providers (Ollama cloud, NVIDIA NIM, NVIDIA Security, GitHub Copilot CLI, Google Gemini CLI) plus 4 free-tier opencode models. See [`MODELS.md`](MODELS.md) for the full catalog, per-model notes, and the recommended picks per lane (agentic-coding, deep-reasoning, multimodal, long-context, bulk, security-audit, pii, safety-guard, cross-vendor).

The catalog is generated from [`models.yaml`](models.yaml). To regenerate:

```bash
cd plugins/multi-model
npm run gen-docs
```

### Cost

| Provider | Cost |
|---|---|
| Copilot CLI | 1 premium request per call |
| Gemini CLI | Free (user's Google account quota) |
| opencode CLI | Free (free-tier models only) |
| Ollama cloud | Self-hosted / cloud endpoint |
| NVIDIA NIM | Per NVIDIA API pricing |
| Codex | Per OpenAI/ChatGPT subscription |
