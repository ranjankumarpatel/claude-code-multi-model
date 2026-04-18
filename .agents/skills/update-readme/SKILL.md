---
name: update-readme
description: Analyze the codebase and regenerate README.md to reflect current project structure, commands, skills, MCP servers, and configuration. Use after code changes, new features, or when README is stale.
when_to_use: When user says "update readme", "refresh readme", "sync readme", or after significant code changes are committed. Also auto-triggered by post-commit hook.
argument-hint: "[path-to-readme]"
allowed-tools: Read Glob Grep Bash(git log *) Bash(git diff *) Bash(ls *) Edit Write
---

# Update README

Analyze the current codebase and update README.md to accurately reflect the project state.

## Target README

- If `$ARGUMENTS` specifies a path, update that README
- Otherwise update `plugins/multi-model/README.md` (primary plugin README)

## Analysis Steps

1. **Scan project structure** — use Glob to map directories, key files, scripts, configs
2. **Inventory commands** — read all files in `commands/` directories, extract slash command names and descriptions
3. **Inventory skills** — read SKILL.md files in `skills/` directories, extract name and description
4. **Inventory MCP servers** — read plugin.json manifests for bundled MCP server declarations
5. **Check requirements** — scan scripts for environment variables, dependencies, imports
6. **Read current README** — compare existing content against discovered state
7. **Diff analysis** — identify what's new, changed, or removed since last README update

## README Structure

Generate/update README with these sections (preserve any custom sections the user added):

```markdown
# {project-name}

{one-line description}

## Install
{installation instructions}

## Requirements
{dependencies, env vars, prerequisites}

## Commands
{table or list of all slash commands with descriptions}

## Skills
{list of skills with trigger descriptions}

## MCP Servers
{bundled servers and what they provide}

## Configuration
{key settings, env vars, optional features}
```

## Rules

- **Preserve custom content** — if the user added sections not in the template above, keep them
- **Be concise** — one line per command/skill, no verbose explanations
- **Use tables** for commands and models when there are 4+ entries
- **Show actual values** — real command names, real env var names, real model IDs
- **No stale references** — if a file/command/skill no longer exists, remove it from README
- **No aspirational content** — only document what exists now, not planned features
