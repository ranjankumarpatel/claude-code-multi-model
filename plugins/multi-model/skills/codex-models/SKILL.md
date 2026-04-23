---
name: multi-model-codex-models
description: Deep-dive on Codex execution/review paths. Invoke when routing to Codex for rescue, fix, adversarial review, or pre-merge verification — or when choosing between direct-CLI and plugin-slash paths. Codex is the mandatory verification gate for non-trivial diffs.
---

# Codex — executor + mandatory verifier

Codex has two roles in this plugin:

1. **Executor of last resort** — rescue / fix when Sonnet/Haiku stall, adversarial review, tough debugging.
2. **Mandatory verification gate** — every non-trivial diff runs through `codex_review` before the orchestrator declares "done."

## Preferred path — direct CLI MCP (default)

These tools spawn the `codex` binary directly, bypassing the openai-codex plugin's Landlock sandbox. The Landlock sandbox is the source of `Codex blocked (sandbox restriction, file access denied)` errors — it pins every turn to `read-only` or `workspace-write`, and workspace-write sometimes still denies legitimate actions.

| Tool | Runs | When |
|---|---|---|
| `mcp__codex__codex_exec` | `codex exec --full-auto` (workspace-write, approvals on-request) | Rescue, investigation, fix |
| `mcp__codex__codex_review` | `codex exec --sandbox read-only` | Diff review, adversarial read, mandatory verification gate |

**`bypassSandbox: true`** on `codex_exec` runs `--dangerously-bypass-approvals-and-sandbox`. Use only in trusted repos when workspace-write denies a legitimate action. Never as a default.

## Fallback path — openai-codex plugin slash commands

Use ONLY when `codex` is not on PATH or the MCP tools fail to launch:

- `/codex:review` — review current diff
- `/codex:adversarial-review` — hostile/adversarial review
- `codex:codex-rescue` subagent (via `Agent` tool) — rescue execution

## Decision matrix

| Situation | Path |
|---|---|
| Verify non-trivial diff before "done" | `codex_review` (read-only) — mandatory gate |
| Sonnet/Haiku stuck, need different brain | `codex_exec` (full-auto) |
| Workspace-write denied a legitimate file action | `codex_exec` + `bypassSandbox: true` (trusted repo only) |
| Pre-merge adversarial read / "what would a hostile reviewer say?" | `codex_review` first, escalate to `/codex:adversarial-review` if needed |
| `codex` binary not on PATH | Fall back to `/codex:review` or `codex:codex-rescue` subagent |

## Codex as verification gate (hard rule)

Every orchestrator run that produced non-trivial changes MUST call `codex_review` on the diff before reporting "done." No exceptions. If Codex flags issues:

1. Route fixes back to Sonnet/Haiku (not Codex — Codex is the reviewer, not the patcher).
2. Re-run `codex_review` on the updated diff.
3. Only declare "done" when Codex clears it.

Trivial changes (typo fixes, comment tweaks, pure doc updates) can skip the gate — but when in doubt, run the review.

## Anti-patterns

- Using `/codex:review` (plugin slash) when `mcp__codex__codex_review` (direct CLI) would work — the plugin version hits the Landlock sandbox.
- Setting `bypassSandbox: true` as a default. It disables all sandboxing — only for trusted-repo legitimate-action denials.
- Skipping the verification gate "because the change looks fine." That's what the gate is for.
- Asking Codex to fix issues it flagged. Codex reviews; Sonnet/Haiku patches; Codex re-reviews.
- Using `codex_exec` for pure review work. Use `codex_review` — it's read-only and faster.
