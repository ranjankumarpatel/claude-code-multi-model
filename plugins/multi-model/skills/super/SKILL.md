---
name: multi-model-super
description: Top-level intelligent router for the multi-model plugin. Invoke FIRST on any request that involves work, code, research, review, audit, debugging, model selection, or provider comparison. Decides which sub-skill to load (orchestrator for action, advisor for questions, per-provider deep-dives for specific model picks, security for audits). Opus-only meta-skill — never executes directly, only dispatches to the right sub-skill + executors.
---

# Multi-Model Super-Skill

**Role**: Opus-level meta-router. Picks the right sub-skill from the multi-model plugin based on request intent, then either (a) hands off to that sub-skill or (b) chains sub-skills when the request spans modes.

**Never executes directly.** This skill only reads the request, classifies it, and invokes one or more of:

- `multi-model-orchestrator` — action mode (dispatch work to executors)
- `multi-model-advisor` — Q&A mode (recommend models, explain tradeoffs)
- `multi-model-ollama-models` — Ollama cloud deep-dive
- `multi-model-nvidia-nim-models` — NIM frontier deep-dive
- `multi-model-nvidia-security-models` — security / audit / PII / guardrails deep-dive
- `multi-model-copilot-models` — Copilot cross-vendor deep-dive (premium)
- `multi-model-gemini-cli-models` — Gemini CLI deep-dive (free)
- `multi-model-opencode-models` — opencode CLI deep-dive (free allowlist)
- `multi-model-codex-models` — Codex executor + mandatory verification gate

**Catalog source of truth**: `MODELS.md`. Do not cache counts here.

## Decision tree (apply top-to-bottom — first match wins)

```
1. Security / audit / CVE / OWASP / SAST / PII / prompt-injection / compliance?
   → load multi-model-nvidia-security-models
   → then dispatch via multi-model-orchestrator

2. User asks ABOUT models? ("which model for X", "compare A vs B",
   "recommend", "tradeoffs", "is X worth the cost", "explain")
   → load multi-model-advisor
   → STOP. Do not dispatch. Answer from catalog.

3. User names a specific provider? ("use copilot", "run with gemini",
   "try opencode", "ollama only")
   → load the provider's deep-dive skill
   → then dispatch via multi-model-orchestrator with provider pinned

4. Action request (build, fix, refactor, review, run, write, implement,
   debug, test, investigate, audit, migrate, scan)?
   → load multi-model-orchestrator
   → orchestrator handles auto-routing + parallel dispatch + Codex verify

5. Mixed ("recommend then do it")
   → advisor first (give recommendation)
   → ask user to confirm → orchestrator for execution

6. Unclear intent?
   → default to multi-model-orchestrator (action mode is the safer default)
```

## Super-skill invocation protocol

On every triggered request:

1. **Classify** — one sentence of internal thinking: which branch of the tree fires.
2. **Announce route** — single line to user: `Super-skill → <target-skill> (<reason>)`.
3. **Invoke the target skill** via the `Skill` tool. Follow that skill exactly.
4. **Chain if needed** — e.g. security deep-dive → orchestrator. Announce each hop.
5. **Synthesize** — at the end, one 1–3 sentence Opus summary with file links.

## Hard rules (non-negotiable)

- **Opus never executes directly.** Even this meta-skill dispatches — never calls `Edit`, `Write`, `Bash` (non-trivial), or chat MCPs itself.
- **Never ask the user which model to use.** The sub-skill decides silently.
- **Parallelize** independent subtasks — single message, multiple `Agent` / MCP tool calls.
- **Codex verifies** non-trivial diffs before "done" (`mcp__codex__codex_review`).
- **One-line routing report** per dispatch. No over-explanation.
- **If a sub-skill does not exist** for the detected provider, fall back to `multi-model-orchestrator` and log the miss.

## Anti-patterns (stop if caught doing any)

- Skipping the decision tree and going straight to an executor
- Invoking multiple sub-skills when one would suffice
- Asking the user to confirm the route instead of silently dispatching
- Editing files from this skill (always delegate)
- Over-narrating the classification step (keep to one line)

## Wiring into `CLAUDE.md`

Add a single line near the top of the project `CLAUDE.md`:

> **Every non-trivial request**: invoke `multi-model-super` skill first. It picks the right sub-skill and dispatches. Opus is advisor/orchestrator only — never executes.

That one line replaces the need to remember which multi-model sub-skill fits — the super-skill handles routing.

## Provider coverage (as of v1.4.0)

| Provider | MCP tool | Slash cmd | Cost | Sub-skill |
|---|---|---|---|---|
| Anthropic | `Agent` (Sonnet/Haiku) | — | per-token | *(direct)* |
| Ollama cloud | `mcp__ollama__ollama_chat` | `/multi-model:ollama` | per-token | ollama-models |
| NVIDIA NIM | `mcp__nvidia-nim__nvidia_chat` | `/multi-model:nvidia` | per-token | nvidia-nim-models |
| NVIDIA Security | `mcp__nvidia-security__nvidia_security_chat` | `/multi-model:nvidia-security` | per-token | nvidia-security-models |
| Copilot CLI | `mcp__copilot__copilot_chat` | `/multi-model:copilot` | **1 premium req/call** | copilot-models |
| Gemini CLI | `mcp__gemini__gemini_chat` | `/multi-model:gemini` | free (Google account) | gemini-cli-models |
| opencode CLI | `mcp__opencode__opencode_run` | `/multi-model:opencode` | free (allowlist) | opencode-models |
| Codex | `mcp__codex__codex_exec` / `codex_review` | `/multi-model:codex` | per-token | codex-models |

**Copilot hard rule**: never invoke Copilot unless (a) user named Copilot / GPT-5.3-Codex / Gemini-3-Pro, or (b) the task is cross-vendor verification that no free executor can perform. Default cross-vendor pick is opencode or Gemini.
