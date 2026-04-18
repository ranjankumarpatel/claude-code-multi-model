---
name: multi-model-orchestrator
description: Opus auto-routes every task to the right model without asking. Triggers on ANY non-trivial request — planning, coding, refactor, review, research, audit, debug, multi-file work. Opus plans + synthesizes only; Sonnet/Haiku/Ollama/NVIDIA/Codex execute in parallel; Codex verifies.
---

# Multi-Model Auto-Router

**Rule**: Opus decides the model per task from the request signal. Never ask the user which model to use. Never default to "ask first". Route silently, report briefly.

## Knowledge sources

- **`MODELS.md`** (plugin root) — full catalog of all 41 models across 4 MCPs. Read when routing a non-obvious task.
- **Per-MCP deep-dive skills** — invoke when the rubric points into a specific MCP:
  - `multi-model-ollama-models` — 15 Ollama cloud models
  - `multi-model-nvidia-nim-models` — 11 NIM frontier models
  - `multi-model-nvidia-security-models` — 9 security / audit / guardrail models
  - `multi-model-copilot-models` — 6 Copilot cross-vendor (1 premium req / call)
- **`multi-model-advisor`** — switch to advisory mode when the user asks *about* models instead of asking for work.

## Roles
- **Opus** — plan, route, synthesize. Never edits files / runs shell directly.
- **Sonnet / Haiku** — primary executors via `Agent` tool.
- **Ollama cloud** (`mcp__ollama__ollama_chat`): `gemma4:31b-cloud`, `kimi-k2.5:cloud`, `kimi-k2-thinking:cloud`. Agentic-coding variants also available: `glm-5.1:cloud` (SWE-Bench SOTA), `qwen3-coder:480b-cloud` (long-context), `devstral-2:123b-cloud` (repo edits+tools), `kimi-k2:1t-cloud`, `gpt-oss:120b-cloud`, `nemotron-3-super:cloud`, `minimax-m2:cloud`, `deepseek-v3.2:cloud`, `glm-4.6:cloud`, `qwen3-coder-next:cloud`, `devstral-small-2:24b-cloud`, `mistral-large-3:675b-cloud`.
- **NVIDIA NIM** (`mcp__nvidia-nim__nvidia_chat`): nemotron-ultra, nemotron-super, llama405b, mistral-large, gemma4. (deepseek-r1 EOL 2026-01-26)
- **NVIDIA Security** (`mcp__nvidia-security__nvidia_security_chat`): audits, PII, guardrails.
- **GitHub Copilot CLI** (`mcp__copilot__copilot_chat`): cross-vendor model picker — Claude, GPT-5.3-Codex, Gemini 3 Pro — through one GitHub auth. 1 premium request per call.
- **Codex** — `/codex:review`, `/codex:adversarial-review`, `codex:codex-rescue` subagent.

## Auto-routing rubric (apply silently)

| Task signal | Route to |
|---|---|
| Bulk read, grep, rename, format, list files | Haiku |
| Multi-file refactor, template logic, debugging, test writing | Sonnet |
| Deep reasoning / chain-of-thought / hard logic puzzle | `kimi-k2-thinking:cloud` or `nemotron-ultra` |
| Coding w/ second opinion or alt-frontier | `gemma4:31b-cloud` or `nemotron-ultra` |
| Agentic coding / SWE-Bench / repo-level edits | `glm-5.1:cloud` (SOTA) → `devstral-2:123b-cloud` → `qwen3-coder:480b-cloud` |
| Long-context / agentic / vision+language | `kimi-k2.5:cloud` or `mistral-large-3:675b-cloud` (vision) |
| Multilingual / non-English code | `mistral-large` |
| Large general-purpose | `llama405b` |
| Security audit, CVE, OWASP, SAST, PII, prompt-injection, compliance | NVIDIA Security |
| Cross-vendor model pick / GPT-5.3-Codex code / Gemini 3 Pro long-context | Copilot CLI (`copilot_chat`). **Skip when**: trivial task Sonnet/Haiku can handle; user not opted into premium-request spend; task is read-only and free-tier executors suffice. Each call costs 1 premium request. |
| Stuck / failing tests / adversarial review / pre-merge verify | Codex |
| Independent subtasks (≥2) | Parallel `Agent` calls in ONE message |

## Decision flow
1. Parse request → identify subtasks.
2. Tag each subtask with a route from the rubric. No user confirmation.
3. Dispatch parallel where independent.
4. Run `/codex:review` on the diff before declaring done.
5. Opus synthesizes → 1–3 sentence report + file links.

## Report format
State route chosen + why in one line per dispatch. Example:
> Routing: refactor → Sonnet; bulk rename → Haiku; security scan → NVIDIA Security (parallel).

## Anti-patterns
- Asking "which model should I use?" — never.
- Opus editing files directly.
- Serial execution of independent subtasks.
- Skipping Codex review on non-trivial diffs.
- Over-explaining routing choices.
