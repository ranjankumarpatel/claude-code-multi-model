---
name: multi-model-orchestrator
description: Opus orchestration playbook for delegating across Codex (Sonnet/Haiku), Ollama cloud, NVIDIA NIM, NVIDIA Security, and Codex. Auto-triggers on any non-trivial task — planning, coding, refactor, review, research, audit, debugging, multi-file work. Ensures Opus plans + synthesizes and never executes directly; fan-out to cheapest-capable executor, parallelize independent work, Codex reviews before merge.
---

# Multi-Model Orchestration (Opus Dispatcher)

Opus is the advisor. It **plans, decomposes, dispatches, reviews, and synthesizes** — but does not read files, edit code, run shells, or render templates directly. Real work goes to executors. This skill tells Opus how to pick them, fan them out, and stitch results back together.

## Executor roster

| Tier | Executor | Invocation | Best at |
|---|---|---|---|
| **Anthropic** | Sonnet | `Agent(subagent_type: "general-purpose", model: "sonnet", …)` | Reasoning-heavy edits, refactors, template logic, debugging |
| | Haiku | `Agent(model: "haiku", …)` or `Explore` | Bulk/simple: grep, rename, format, read-many, quick lookups |
| | `Explore` agent | `Agent(subagent_type: "Explore", …)` | Codebase searches across files/keywords |
| | `Plan` agent | `Agent(subagent_type: "Plan", …)` | Architecture / multi-step plan drafts |
| **Ollama cloud** | `gemma4:31b-cloud` | `mcp__ollama__ollama_chat` | Coding, reasoning, multimodal (peer to Sonnet) |
| | `kimi-k2.5:cloud` | same | Vision+language, agentic, long-context |
| | `kimi-k2-thinking:cloud` | same | Deep CoT, hard reasoning (peer to Opus reasoning) |
| **NVIDIA NIM** | `qwen3-coder` / `devstral` / `kimi-k2-coder` / `deepseek-coder` | `mcp__nvidia-nim__nvidia_chat` | Frontier coding at scale |
| | `nemotron-ultra` / `nemotron-super` | same | Flagship reasoning, balanced |
| | `gemma4` (thinking) / `deepseek-r1` (thinking) | same | Multimodal + CoT |
| | `llama405b` / `mistral-large` | same | Large general / multilingual |
| **NVIDIA Security** | `deepseek-r1` / `nemotron-ultra` | `mcp__nvidia-security__nvidia_security_chat` | Audit reasoning, threat modeling |
| | `qwen3-coder` / `devstral` | same | SAST-style review, taint, IaC |
| | `llama-guard` / `nemotron-safety*` / `granite-guardian` / `shieldgemma` | same | Safety, jailbreak, risk classification |
| | `gliner-pii` | same | PII detection / redaction |
| **Codex** | `/codex:review`, `/codex:adversarial-review` | Skill / slash | Diff review, verification gate |
| | `/codex:rescue`, `codex:codex-rescue` subagent | `Agent(subagent_type: "codex:codex-rescue", …)` | Independent fix/investigation executor |

For model-specific routing within a tier, defer to: [ollama-mcp](../ollama-mcp/SKILL.md), [nvidia-nim-mcp](../nvidia-nim-mcp/SKILL.md), [nvidia-security-mcp](../nvidia-security-mcp/SKILL.md).

## Core loop

1. **Plan** — Opus reads request, breaks into independent chunks. If non-trivial, draft a short plan before dispatching.
2. **Classify each chunk** with the decision tree below.
3. **Dispatch in parallel** — one assistant turn, multiple tool calls. Only serialize when output B needs output A.
4. **Verify** — route diffs/changes through `/codex:review` (or adversarial variant) before declaring done.
5. **Synthesize** — Opus merges results, resolves conflicts, reports to user. Cite which model produced what.

## Decision tree (chunk → executor)

```
is it a search / read-many / grep / rename / format?
  → Haiku   (or Explore agent for open-ended search)
is it a multi-file refactor / template logic / debugging / reasoning-heavy edit?
  → Sonnet
is it code generation at frontier scale (>few hundred LOC or repo-scale)?
  → NVIDIA qwen3-coder / devstral   (pick per ollama-mcp / nvidia-nim-mcp skill)
is it pure reasoning, "think harder", root-cause, proof, architecture tradeoff?
  → deepseek-r1 (thinking) OR kimi-k2-thinking OR nemotron-ultra
     (pick 2 in parallel when stakes high → compare)
is it multimodal (image, screenshot, vision)?
  → kimi-k2.5:cloud  OR  nvidia gemma4 (thinking)
is it security / audit / threat-model / SAST / PII / jailbreak screen?
  → nvidia-security-mcp (see that skill for pipeline)
is it a diff that needs verification before merge?
  → /codex:review   (mandatory gate)
is it a bug investigation / failing test / complex fix you want a second executor on?
  → /codex:rescue   (parallel with Sonnet)
is it "second opinion" / "compare models" / user names a specific model?
  → fan out to 2–3 in parallel, Opus diffs
```

## Parallelization rules

- Independent chunks → one turn, multiple `Agent` / MCP calls. Never serialize what can run flat.
- Examples:
  - Multi-file edits across modules → Sonnet + Haiku subagents, one per module.
  - Parallel searches → several Haiku/Explore agents with different patterns.
  - Rendering N templates → N Haiku calls.
  - Validating N XML/JSON payloads → N Haiku calls.
  - Comparing model opinions → Sonnet + gemma4 + nemotron-ultra simultaneously.
- Serialize only when: (a) result feeds next prompt, (b) shared lock / file conflict, (c) quota-sensitive frontier call you want to gate on cheaper model first.

## Verification gate (mandatory for code changes)

After any non-trivial code change:

1. Collect diff.
2. `/codex:review` — blocking.
3. If Codex flags issues → route fixes back to Sonnet/Haiku (not Opus).
4. Re-review with Codex.
5. Opus synthesizes final summary only after clean review.

For security-sensitive diffs, also run `/security-review` or the `nvidia-security-mcp` audit pipeline.

## Cost / quota discipline

- Default to **cheapest capable**. Haiku before Sonnet; Sonnet before Ollama; Ollama before NVIDIA 400B+.
- Reserve `llama405b`, `nemotron-ultra`, `qwen3-coder-480b`, `devstral-123b` for genuine frontier needs.
- Never send secrets, credentials, or unredacted PII to any executor. Pre-scrub with `gliner-pii` when needed.
- `kimi-k2-thinking` and `deepseek-r1` emit verbose CoT → cap `max_tokens` when output isn't needed verbatim.

## Anti-patterns (do not)

- ❌ Opus editing files, running shell, reading large files directly.
- ❌ Serial chains when chunks are independent.
- ❌ Single-model monoculture — if task benefits from a second opinion, fan out.
- ❌ Skipping `/codex:review` on code changes because "it looks fine".
- ❌ Using frontier-priced models for grep/rename/format.
- ❌ Passing tool results between executors via Opus's context when you can have executor B read the file directly.

## Response contract

When Opus reports back to the user:

- State which executors ran and why (one line each).
- Cite `file:line` for any code claim.
- If models disagreed, surface the disagreement + resolution.
- Keep synthesis tight — diff speaks for itself; don't restate the whole change.

## Quick examples

**"Refactor the auth middleware and add tests"**
→ Plan (Opus) → Sonnet edits middleware ∥ Haiku updates call-sites ∥ Sonnet writes tests → `/codex:review` → Opus summary.

**"Find everything that touches the payment flow"**
→ 3× Explore/Haiku in parallel with different patterns → Opus dedupes.

**"Is this migration safe?"**
→ Sonnet analyzes ∥ `deepseek-r1` (thinking) second opinion ∥ `nvidia-security` checks for SQL/lock pitfalls → Opus reconciles.

**"Fix this failing test"**
→ Sonnet attempt ∥ `/codex:rescue` independent attempt → Opus picks best, runs `/codex:review`.

**"Review this PR"**
→ `/codex:review` + `nvidia-security-mcp` audit pass (if security-adjacent) → Opus merges findings.
