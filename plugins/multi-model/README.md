# multi-model plugin

Portable Claude Code plugin. Drop into any project for instant multi-model orchestration across Ollama cloud, NVIDIA NIM, NVIDIA Security, and Codex.

## Install

Add to your project's `.claude-plugin/marketplace.json`:

```json
{
  "plugins": [
    { "name": "multi-model", "source": "./plugins/multi-model", "version": "1.0.0" }
  ]
}
```

Or reference this repo as a marketplace source.

## Requirements

- `node` on PATH, `@modelcontextprotocol/sdk` + `zod` installed globally (set `MCP_GLOBAL_MODULES` to your global `node_modules`)
- Optional: `OLLAMA_HOST` (default `http://localhost:11434`)
- Optional: `NVIDIA_API_KEY` for NVIDIA NIM + Security
- Optional: Codex plugin installed for `/codex:review`, `/codex:rescue`

## Commands
- `/multi-model:delegate <task>` — orchestrator entry
- `/multi-model:ollama <prompt>` — Ollama cloud chat
- `/multi-model:nvidia <prompt>` — NVIDIA NIM chat
- `/multi-model:nvidia-security <prompt>` — security audit
- `/multi-model:codex [review|rescue|adversarial] <arg>` — Codex handoff
- `/multi-model:models` — list all available models

## MCP servers bundled
`ollama`, `nvidia-nim`, `nvidia-security` — auto-loaded via plugin manifest. No project-level `.mcp.json` needed.

## Skill
`multi-model-orchestrator` auto-triggers on non-trivial tasks. Opus plans + synthesizes; Sonnet/Haiku/Ollama/NVIDIA/Codex execute in parallel; Codex verifies.
