---
name: multi-model-orchestrator
description: Opus auto-routes every task to the right model without asking. Triggers on ANY non-trivial request — planning, coding, refactor, review, research, audit, debug, multi-file work. Opus plans + synthesizes only; Sonnet/Haiku/Ollama/NVIDIA/Codex execute in parallel; Codex verifies.
---

# Multi-Model Auto-Router

**Rule**: Opus decides the model per task from the request signal. Never ask the user which model to use. Never default to "ask first". Route silently, report briefly.

## Roles
- **Opus** — plan, route, synthesize. Never edits files / runs shell directly.
- **Sonnet / Haiku** — primary executors via `Agent` tool.
- **Ollama cloud** (`mcp__ollama__ollama_chat`): `gemma4:31b-cloud`, `kimi-k2.5:cloud`, `kimi-k2-thinking:cloud`.
- **NVIDIA NIM** (`mcp__nvidia-nim__nvidia_chat`): nemotron-ultra, nemotron-super, deepseek-r1, llama405b, mistral-large, gemma4.
- **NVIDIA Security** (`mcp__nvidia-security__nvidia_security_chat`): audits, PII, guardrails.
- **Codex** — `/codex:review`, `/codex:adversarial-review`, `codex:codex-rescue` subagent.

## Auto-routing rubric (apply silently)

| Task signal | Route to |
|---|---|
| Bulk read, grep, rename, format, list files | Haiku |
| Multi-file refactor, template logic, debugging, test writing | Sonnet |
| Deep reasoning / chain-of-thought / hard logic puzzle | `kimi-k2-thinking:cloud` or `deepseek-r1` |
| Coding w/ second opinion or alt-frontier | `gemma4:31b-cloud` or `nemotron-ultra` |
| Long-context / agentic / vision+language | `kimi-k2.5:cloud` |
| Multilingual / non-English code | `mistral-large` |
| Large general-purpose | `llama405b` |
| Security audit, CVE, OWASP, SAST, PII, prompt-injection, compliance | NVIDIA Security |
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
