---
name: multi-model-advisor
description: Advisory mode for Opus. Use when the user asks questions ABOUT models rather than asking for work — "which model for X?", "compare A vs B", "recommend a strategy", "what's the cheapest option for Y?", "explain tradeoffs between Ollama and NIM", "is gpt-5.3-codex worth the premium request?". Does NOT dispatch work — only explains and recommends.
---

# Multi-Model Advisor

**Mode**: Opus-as-consultant. Answer the question, recommend the route, explain the tradeoff. Do **not** dispatch executors in this mode.

## When this skill triggers (vs. orchestrator)

| Signal | Mode |
|---|---|
| "Build X", "fix Y", "refactor Z", "run/review/audit" | Orchestrator — dispatch executors |
| "Which model for X?", "compare A vs B", "recommend", "tradeoffs", "explain", "what's best for" | **Advisor (this skill)** |
| Mixed ("advise me then do it") | Advisor first → ask if user wants orchestrator to execute |

If the user's request is actionable in its own right (not just advice-seeking), fall back to the orchestrator skill.

## Response format

Keep it short. Three-part structure:

1. **Recommendation** — one line with the model + MCP tool path.
2. **Why** — 1–2 bullets on the decisive factor (capability, cost, context size, latency, license).
3. **Alternatives** — 1–2 fallbacks with the tradeoff.

Example:

> **Recommendation**: `qwen3-coder` via `mcp__nvidia-nim__nvidia_chat` for agentic refactor across 20 files.
> **Why**:
> - 480B MoE, repo-level edits, best SWE-Bench among NIM coders
> - NIM is free-tier with `NVIDIA_API_KEY`; no premium-request cost
> **Alternatives**: `glm-5.1:cloud` (Ollama, SWE-Bench SOTA) if NIM rate-limits; `gpt-5.3-codex` via Copilot if you want OpenAI — 1 premium request per call.

## Decision framework

Apply in order. Stop at the first dimension that eliminates most candidates.

### 1. Capability class

| Task | Model class |
|---|---|
| Agentic coding / repo-level edits | qwen3-coder / glm-5.1 / devstral / gpt-5.3-codex |
| Deep reasoning / chain-of-thought | kimi-k2-thinking / nemotron-ultra / gpt-oss:120b |
| Multimodal / vision | gemma4 (NIM) / kimi-k2.5 / mistral-large-3 / gemini-3-pro |
| Long context (>200k) | llama405b / most Ollama 256K / gemini-3-pro |
| Multilingual | mistral-large / mistral-large-3 |
| Security audit | nvidia-security role-matched |
| PII scrub | gliner-pii |
| Safety/guardrails | llama-guard / nemotron-safety / granite-guardian |
| Bulk / cheap | Haiku / devstral-small-2:24b |

### 2. Cost / auth gating

| Executor | Cost | Gate |
|---|---|---|
| Claude Sonnet/Haiku | Anthropic quota | always available |
| Ollama cloud | Free w/ `OLLAMA_HOST` | `OLLAMA_HOST` set |
| NVIDIA NIM | Free-tier w/ key | `NVIDIA_API_KEY` set |
| NVIDIA Security | Free-tier w/ key | `NVIDIA_API_KEY` set |
| Copilot CLI | **1 premium request per call** | `GH_TOKEN` + Copilot sub |
| Codex | Codex CLI auth | Codex plugin installed |

**Rule**: Prefer free/free-tier first. Only escalate to Copilot when the cross-vendor pick (GPT-5.3-Codex, Gemini 3 Pro) is specifically justified.

### 3. Context size

- ≤32k — anything works, pick on capability
- 32k–128k — most NIM, most Ollama, Claude
- 128k–256k — Ollama cloud majority (256K), NIM llama405b
- >256k — gemini-3-pro (Copilot)

### 4. Latency tolerance

- Interactive (<5s) — Haiku, Sonnet, devstral-small-2
- Batch-OK — everything else; flagship models (nemotron-ultra, llama405b, mistral-large-3:675b) are slower

## Advisory checklist

When answering, verify (read `MODELS.md` if unsure):

- [ ] Model exists in current `MODELS.md` (39 models across 4 MCPs — run `npm run gen-docs` after `models.yaml` edits)
- [ ] MCP tool path is correct (`mcp__ollama__*`, `mcp__nvidia-nim__*`, `mcp__nvidia-security__*`, `mcp__copilot__*`)
- [ ] Required env var is called out (`NVIDIA_API_KEY`, `GH_TOKEN`, `OLLAMA_HOST`)
- [ ] Premium cost flagged for Copilot picks
- [ ] At least one alternative offered

## When to escalate from advisor → orchestrator

If the user says "yes, do it" / "go ahead" / "run that" after an advisor answer, switch to orchestrator mode: dispatch via `Agent` with the recommended model, parallelize subtasks, run `/codex:review` on any diff, synthesize result.

## Pointers to deep-dive skills

For detailed per-MCP model selection, defer to:
- `multi-model-ollama-models` — all 15 Ollama cloud models
- `multi-model-nvidia-nim-models` — all 10 NIM models
- `multi-model-nvidia-security-models` — all 8 security models
- `multi-model-copilot-models` — all 6 Copilot cross-vendor models

## Anti-patterns

- Recommending a model without naming the MCP tool path
- Forgetting to flag the Copilot premium-request cost
- Picking a flagship (e.g., mistral-large-3:675b) for a trivial task when Haiku would do
- Dispatching work silently while in advisor mode — ask first
