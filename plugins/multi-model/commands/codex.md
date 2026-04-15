---
description: Hand off to Codex for review, rescue, or adversarial verification
argument-hint: '[review|rescue|adversarial] <task or diff>'
---

Route to Codex. Arg: `$ARGUMENTS`

- `review` → run `/codex:review` on current diff
- `adversarial` → run `/codex:adversarial-review`
- `rescue` → spawn `codex:codex-rescue` subagent via `Agent` tool for investigation / failing tests / hard fixes

Use Codex as verification gate before declaring non-trivial work done.
