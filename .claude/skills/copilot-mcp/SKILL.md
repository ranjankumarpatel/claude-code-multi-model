---
name: copilot-mcp
description: Delegate tasks to GitHub Copilot CLI (`@github/copilot`) as a cross-vendor executor. Use when user says "copilot", needs claude-sonnet-4.6, claude-opus-4.6, claude-haiku-4.5, gpt-5.3-codex, gemini-3-pro, gpt-5, or a fresh second opinion via GitHub's unified auth. Requires active Copilot subscription or GitHub Token with `Copilot Requests` scope.
---

# GitHub Copilot CLI MCP Orchestrator

Route tasks to GitHub Copilot CLI for cross-vendor frontier models via single GitHub authentication.

## Tools

- `mcp__copilot__copilot_list_models` — enumerate available Copilot models.
- `mcp__copilot__copilot_chat` — send messages. Args: `prompt`, `model` (optional), `cwd` (working directory context).

## Model routing

| ID | Vendor | Strengths | Use when |
|---|---|---|---|
| `claude-sonnet-4.6` | Anthropic | Balanced coding + reasoning | Default for code tasks. Peer to Sonnet locally. |
| `claude-opus-4.6` | Anthropic | Planning, architecture, complex reasoning | Hard multi-step tasks, design decisions. |
| `claude-haiku-4.5` | Anthropic | Fast coding | Bulk edits, refactoring, quick generation. |
| `gpt-5.3-codex` | OpenAI | Code generation and completion | OpenAI Codex-quality code tasks, completions. |
| `gemini-3-pro` | Google | Long-context, multimodal | Large file context, vision understanding. |
| `gpt-5` | OpenAI | General-purpose frontier | Reasoning, vision, second opinion on logic. |

## Decision rules

- **Code tasks** → `claude-sonnet-4.6` (default).
- **Second opinion needed** → `gpt-5` for reasoning or `gemini-3-pro` for long context.
- **Vision / image input** → `gpt-5` or `gemini-3-pro`.
- **Deep reasoning / proofs** → `gpt-5` or `claude-opus-4.6`.
- **Code generation / completion** → `gpt-5.3-codex`.
- **Speed + cost** → `claude-haiku-4.5`.
- **When model omitted** → Copilot CLI default applies (currently `claude-sonnet-4.5`).

## Auth setup

**One-time interactive login:**
```bash
copilot auth login
```

**Or via GitHub Token (PAT with `Copilot Requests` scope):**
```bash
export GITHUB_TOKEN=ghu_...
```

**Prerequisites:** Install `@github/copilot` globally:
```bash
npm install -g @github/copilot
copilot --version  # Verify installation
```

## Cost discipline

- Each prompt = 1 premium request (metered from monthly allocation).
- Free-tier users: 50 premium requests/month.
- Paid subscribers: unlimited or higher quota (depends on plan).
- **Do not dispatch trivially.** Reserve Copilot for frontier-quality opinions or cross-vendor validation.

## Tool posture

**WARNING**: The subprocess runs with `--allow-all-tools`. This means Copilot CLI can read files, write files, and execute shell commands inside the `cwd` directory. The caller controls `cwd` — do not pass a working directory you do not trust. Never set `cwd` to a directory containing secrets (e.g. `~`, `/etc`) unless you intend Copilot to access them. The subprocess is scoped to `cwd` by convention, not by sandbox.

## Invocation pattern

```
mcp__copilot__copilot_chat({
  prompt: "<task or code review>",
  model: "claude-sonnet-4.6",  // optional; CLI default if omitted
  cwd: "/path/to/repo"         // optional; working directory context
})
```

Tool runs with `--allow-all-tools`. Copilot can shell out inside the working directory to inspect files or run commands for context.

## Orchestration pattern

Opus plans → delegate independent chunks to Copilot in parallel with Sonnet/Haiku/Ollama/NVIDIA → Codex reviews diffs → Opus synthesizes. Fire multiple `Agent` / MCP calls in one message.

## Failure modes

- Missing `@github/copilot` binary → surface error, ask user to `npm i -g @github/copilot`.
- Expired / missing auth → `GITHUB_TOKEN` invalid or Copilot login expired. Re-run `copilot auth login`.
- 429 rate limit → Copilot quota exhausted (github/copilot-cli#2742, known issue). Fall back to local Sonnet/Haiku.
- Unknown model → relay error verbatim; check available models via `copilot_list_models`.
