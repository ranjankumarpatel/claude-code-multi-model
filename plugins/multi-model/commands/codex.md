---
description: Hand off to Codex for review, rescue, or adversarial verification
argument-hint: '[review|rescue|adversarial|cli] <task or diff>'
---

Route to Codex. Arg: `$ARGUMENTS`

## Preferred path — direct `codex` CLI (bypasses plugin sandbox)

The openai-codex plugin's app-server broker pins every turn to a Landlock sandbox (`read-only` or `workspace-write`) which sometimes reports `Codex blocked (sandbox restriction, file access denied)`. When that happens, use the direct CLI path instead:

- **`mcp__codex__codex_exec`** — runs `codex exec --full-auto` by default (workspace-write + on-request approvals). Set `bypassSandbox: true` to use `--dangerously-bypass-approvals-and-sandbox` for the rare case the workspace-write sandbox still blocks.
- **`mcp__codex__codex_review`** — runs `codex exec --sandbox read-only` for diff/review work.

Both bypass the openai-codex plugin's broker since they spawn the `codex` binary directly with our own sandbox flags.

## Fallback path — openai-codex plugin slash commands

Use only when the direct CLI path is unavailable (e.g., `codex` not on PATH):

- `review` → `/codex:review` on current diff
- `adversarial` → `/codex:adversarial-review`
- `rescue` → spawn `codex:codex-rescue` subagent via `Agent` tool

## Routing rules

- Default to `mcp__codex__codex_exec` for rescue/investigation/fix work.
- Default to `mcp__codex__codex_review` for diff verification.
- Use `bypassSandbox: true` only inside trusted repos when workspace-write denies a legitimate action.
- Codex remains the mandatory verification gate before declaring non-trivial work done.
