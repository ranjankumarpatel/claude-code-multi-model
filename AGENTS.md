## Purpose

This repository is a Claude Code plugin + prompt/skill pack for multi-model orchestration.

Primary implementation lives in `plugins/multi-model/`.

## Source Of Truth

- Routing policy and behavior: [plugins/multi-model/skills/orchestrator/SKILL.md](plugins/multi-model/skills/orchestrator/SKILL.md)
- Model catalog source: [plugins/multi-model/models.yaml](plugins/multi-model/models.yaml)
- Generated model docs: [plugins/multi-model/MODELS.md](plugins/multi-model/MODELS.md)
- Plugin usage and setup: [plugins/multi-model/README.md](plugins/multi-model/README.md)
- Repository-level usage: [README.md](README.md)

Prefer linking to those files instead of duplicating long model lists in instructions.

## Auto-Routing Rule

Opus chooses model routes automatically from task signal and does not ask users to pick models.

Execution pattern:
- Opus plans and synthesizes.
- Sonnet/Haiku and MCP-backed executors perform concrete work.
- Codex reviews non-trivial diffs before final synthesis.

## Where To Edit

- Slash commands: `plugins/multi-model/commands/`
- MCP servers: `plugins/multi-model/scripts/`
- Skill playbooks: `plugins/multi-model/skills/`
- Catalog data: `plugins/multi-model/models.yaml`
- Generated docs: `plugins/multi-model/MODELS.md` (do not hand-edit)

## Required Validation After Changes

From `plugins/multi-model/` run:

```bash
npm run gen-docs
npm run check-copilot-drift
npm test
```

If `models.yaml` changed, ensure the generated file `MODELS.md` is updated in the same change.

## Repo Conventions

- Keep `models.yaml` as the single catalog source of truth.
- Keep command descriptions aligned with exposed MCP tools.
- Prefer direct Codex CLI MCP path (`mcp-codex`) for review/rescue workflows when available.
- Treat EOL model notes as normative; remove stale references when upstream models are discontinued.

## README Maintenance

- After command/skill/MCP changes, run `/update-readme`.
- A post-commit hook reminds contributors to refresh README content when code changes are detected.
