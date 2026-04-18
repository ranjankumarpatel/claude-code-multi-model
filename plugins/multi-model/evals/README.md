# multi-model evals harness

Make routing claims falsifiable. Every time we say "route X to model Y because Y is best at category Z", we should be able to prove it with a reproducible eval.

## Layout

```
evals/
  README.md          ← you are here
  run.mjs            ← scaffolded runner (stubs model calls; emits JSONL)
  scorers.mjs        ← exact / regex / semantic scorers
  tasks/             ← one JSON file per canonical task
    01-bulk-rename.json
    02-agentic-refactor.json
    03-reasoning-puzzle.json
    04-multimodal-vision.json
    05-security-audit.json
  results/           ← JSONL reports, one per run (timestamped)
```

## Task file shape

```json
{
  "id": "01-bulk-rename",
  "category": "bulk",
  "prompt": "<task prompt fed to every candidate model>",
  "ground_truth": "<expected answer, or object for semantic scorers>",
  "scorer": "exact | regex | semantic",
  "routes_to_test": ["sonnet-native", "ollama:glm-5.1:cloud", "nim:qwen3-coder", "copilot:gpt-5.3-codex"]
}
```

`category` values align with the routing rubric in `skills/orchestrator/SKILL.md`: `bulk`, `agentic-coding`, `deep-reasoning`, `multimodal`, `security-audit`.

`routes_to_test` uses `<executor>:<model>` notation. `sonnet-native` and `haiku-native` are the Claude Agent-tool executors.

## Adding a task

1. Drop a new JSON file in `tasks/` with a unique `id`.
2. Pick the right `scorer`:
   - **exact** — ground truth is a literal string (puzzles, fact recall, well-defined outputs)
   - **regex** — ground truth is a pattern (must-mention keywords, structure checks)
   - **semantic** — ground truth is a rubric object; a judge LLM scores (currently stubbed, returns 0.5)
3. List the routes you want head-to-head. Leave out routes that structurally can't do the task (e.g. don't list a text-only model for multimodal).

## Scoring

| Scorer | Returns | Notes |
|---|---|---|
| `exact` | 1.0 if `output === ground_truth` else 0.0 | whitespace-trimmed |
| `regex` | 1.0 if pattern matches else 0.0 | ground_truth is a regex source string |
| `semantic` | 0.5 (stub) | TODO: route through Codex or a NIM reasoning model as judge |

## Running

```bash
# Scaffold run — prints what WOULD be called and writes a JSONL with stub results.
node evals/run.mjs
```

Output goes to `evals/results/YYYY-MM-DD-HHMMSS.jsonl` — one line per (task, route) pair.

## Interpreting results

For each task, compare scores across routes. Use the per-task winner to update the routing rubric in `skills/orchestrator/SKILL.md`. If a claimed-best route loses to a cheaper one, that's a bug in the rubric — fix it.

## Roadmap

- Phase 1C (this): scaffold + stub runners + JSONL output
- Phase 2: wire real MCP calls (see `TODO` block in `run.mjs`)
- Phase 3: plug LLM judge into `semantic` scorer
- Phase 4: CI canary runs the eval harness nightly and alerts on regressions
