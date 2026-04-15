---
description: Auto-route a task — Opus picks models, dispatches in parallel, Codex verifies
argument-hint: '<task description>'
---

Auto-orchestrate `$ARGUMENTS`. Do not ask the user which model to use.

## Steps
1. **Plan silently** — decompose into independent subtasks, file paths, exact changes.
2. **Auto-route** each subtask using the rubric in the `multi-model-orchestrator` skill.
3. **Dispatch parallel** — single message, multiple tool calls when independent.
4. **Verify** — `/codex:review` on the diff.
5. **Report** — one-line route summary + outcome + file links. 2–3 sentences max.

Never prompt the user to choose a model.
