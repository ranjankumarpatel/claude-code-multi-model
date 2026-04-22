# Copilot Instructions

## Repository Focus
This repository is a Claude Code plugin plus skill pack for multi-model orchestration.
The primary implementation is under `plugins/multi-model/`.

## Source of Truth
When making changes, prefer these files over duplicating content elsewhere:
- `plugins/multi-model/skills/orchestrator/SKILL.md` for routing behavior and policy
- `plugins/multi-model/models.yaml` for model catalog data
- `plugins/multi-model/MODELS.md` for generated model documentation
- `plugins/multi-model/README.md` for plugin usage and setup
- `README.md` for repository-level usage

## Editing Rules
- Keep `plugins/multi-model/models.yaml` as the single source of truth for model catalog entries.
- Do not hand-edit `plugins/multi-model/MODELS.md`; regenerate it.
- Keep command docs in `plugins/multi-model/commands/` aligned with available MCP tools.
- Remove stale references for discontinued or EOL models.

## Validation Required After Changes
Run these commands from `plugins/multi-model/` after substantive edits:

```bash
npm run gen-docs
npm run check-copilot-drift
npm test
```

If `models.yaml` changes, include the regenerated `MODELS.md` in the same change.

## README Maintenance
After command, skill, or MCP changes, refresh README content.

## Working Style
- Keep diffs focused and minimal.
- Prefer updating existing docs rather than adding duplicate model lists.
- Preserve current folder conventions:
  - `plugins/multi-model/commands/` for slash command docs
  - `plugins/multi-model/scripts/` for MCP scripts
  - `plugins/multi-model/skills/` for skill playbooks

## Caveman Mode Requirement
- Always use the `/caveman ultra` skill mode for responses and reasoning style.
- Treat caveman mode as persistent across turns.
- Only stop caveman mode if explicitly instructed with `stop caveman` or `normal mode`.
