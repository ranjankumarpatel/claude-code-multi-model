## Model routing

**Auto-route rule**: Opus decides the model for every task automatically from the request signal. Never ask the user which model to use. Use the rubric in the `multi-model-orchestrator` skill. Report the chosen route in one line, do not prompt for confirmation.

- **Opus** — advisor / orchestrator only. Use for planning, architecture decisions, task decomposition, reviewing results. Do not use for direct file edits, code generation, searches, or shell execution.
- **Sonnet / Haiku** — real executors. Delegate all concrete work (reading files, editing code, running commands, rendering templates, DB queries, test runs) to Sonnet (complex) or Haiku (simple/bulk).
- **Ollama cloud models** — additional executors for delegation via the `ollama_chat` MCP tool or `/ollama:chat` command:
  - `gemma4:31b-cloud` — coding tasks, reasoning, multimodal (peer to Sonnet)
  - `kimi-k2.5:cloud` — agentic tasks, vision+language, long-context work
  - `kimi-k2-thinking:cloud` — deep reasoning, chain-of-thought, hard problems (peer to Opus for reasoning-only tasks)
- **NVIDIA NIM models** — frontier models via `nvidia_chat` MCP tool or `/ollama:nvidia-chat` command (requires `NVIDIA_API_KEY`):
  - `nemotron-ultra` (`nvidia/llama-3.1-nemotron-ultra-253b-v1`) — NVIDIA flagship, best reasoning and coding
  - `nemotron-super` (`nvidia/llama-3.3-nemotron-super-49b-v1`) — balanced speed + quality
  - `gemma4` (`google/gemma-4-31b-it`) — multimodal vision, thinking mode
  - `llama405b` (`meta/llama-3.1-405b-instruct`) — large general purpose
  - NOTE: `deepseek-r1` reached EOL 2026-01-26 (410 Gone). Use `nemotron-ultra` (NVIDIA) or `kimi-k2-thinking:cloud` (Ollama) for deep reasoning.
  - `mistral-large` (`mistralai/mistral-large-2-instruct`) — multilingual, coding
- **Copilot CLI** — cross-vendor model picker via `mcp__copilot__copilot_chat` tool or `/multi-model:copilot` command (requires `GH_TOKEN` or `GITHUB_TOKEN`):
  - `gpt-5.3-codex` — GPT-5.3-Codex, peer to Sonnet for code generation and editing
  - `gemini-3-pro` — Gemini 3 Pro, long-context work and vision+language tasks
  - `claude` — routes back to Claude through Copilot auth (cross-vendor compare)
- **Gemini CLI** — Google-native model picker via `mcp__gemini__gemini_chat` tool or `/gemini` command (requires `GEMINI_API_KEY` or Google OAuth — no premium-request cost):
  - `auto` — **default**; smart routing picks best Gemini model per task complexity
  - `gemini-3-pro-preview` — flagship, deep reasoning, long-context (>256k)
  - `gemini-3-flash-preview` — fast Gemini 3 tier
  - `gemini-2.5-pro` — stable production tier, multimodal
  - `gemini-2.5-flash` — fast, cheap bulk tasks
- **opencode CLI** — free-tier cross-vendor picker via `mcp__opencode__opencode_run` tool or `/multi-model:opencode` command. MCP server enforces a free-models allowlist to prevent billing. Install: `npm install -g opencode-ai`. Auth: `opencode providers login`. Allowed models:
  - `opencode/big-pickle` — default free workhorse (omit model to get this)
  - `opencode/ling-2.6-flash-free` — fast / bulk / simple
  - `opencode/nemotron-3-super-free` — reasoning-heavy / chain-of-thought
  - `opencode/minimax-m2.5-free` — alt-frontier second opinion
  - Paid opencode models are rejected by the MCP. Prefer over Copilot for bulk / repeat cross-vendor calls (no cost).
- **Codex** — reviewer, verifier, and executor for code-focused work. **Prefer direct `codex` CLI** via multi-model's own MCP server, which bypasses the openai-codex plugin's Landlock sandbox (the source of `Codex blocked (sandbox restriction, file access denied)` errors):
  - `mcp__codex__codex_exec` — runs `codex exec --full-auto` for rescue/investigation/fix. Set `bypassSandbox: true` for `--dangerously-bypass-approvals-and-sandbox` when workspace-write still denies a legitimate action in a trusted repo.
  - `mcp__codex__codex_review` — runs `codex exec --sandbox read-only` for diff/review; mandatory verification gate before synthesizing.
  - Fallback to openai-codex plugin slash commands only if `codex` isn't on PATH: `/codex:review`, `/codex:adversarial-review`, `codex:codex-rescue` subagent via `Agent` tool.
  - If Codex flags issues, route fixes back to Sonnet/Haiku and re-review.
- Pattern: Opus plans → Sonnet/Haiku/Codex execute → Codex reviews → Opus synthesizes.
- **Parallelize executors** — run Sonnet/Haiku/Ollama/Codex subagents concurrently whenever tasks are independent. Single message, multiple `Agent` tool calls. Examples: multi-file edits, parallel searches across modules, rendering several templates, validating multiple XMLs. Only serialize when outputs feed each other.
- Split by task weight: Haiku for bulk/simple (grep, rename, format, read-many), Sonnet for reasoning-heavy (refactors, template logic, debugging), Ollama cloud for second-opinion or alternative-model tasks, Codex for code review / verification / rescue execution. Opus never executes — only dispatches and synthesizes.

## README auto-update

- **Skill**: `/update-readme [path]` — analyzes codebase and regenerates README to match current state. Defaults to `plugins/multi-model/README.md`.
- **Hook**: `PostToolUse` on `Bash(git commit *)` — after every commit, checks if code files changed and reminds to run `/update-readme`.
- Run `/update-readme` manually after pulling changes, rebasing, or adding new commands/skills/MCP servers.
