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
| `npm install` inside the plugin | Installs `@modelcontextprotocol/sdk`, `zod`, `js-yaml` into local `node_modules`. No global install required. |

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
| `MCP_GLOBAL_MODULES` | Optional (legacy) | Fallback path to a global `node_modules`. Only used if the plugin-local `node_modules` is missing. Prefer running `npm install` inside the plugin instead. |

### Models

~40 models across 4 providers (Ollama cloud, NVIDIA NIM, NVIDIA Security, GitHub Copilot CLI). See [`MODELS.md`](MODELS.md) for the full catalog, per-model notes, and the recommended picks per lane (agentic-coding, deep-reasoning, multimodal, long-context, bulk, security-audit, pii, safety-guard, cross-vendor).

The catalog is generated from [`models.yaml`](models.yaml). To regenerate:

```bash
cd plugins/multi-model
npm run gen-docs
```

Each Copilot prompt costs 1 premium request from your monthly allocation.
