# claude-code-multi-model

Portable Claude Code plugin for automatic multi-model orchestration. Opus plans + synthesizes. Sonnet/Haiku/Ollama cloud/NVIDIA NIM/NVIDIA Security/Copilot/Gemini/opencode/Codex execute in parallel. Codex verifies before merge. **No user prompting for model choice** — Opus auto-routes from task signal.

Drop into any project and start delegating across 7 providers immediately.

---

## What you get

- **One plugin** (`multi-model` v1.3.0) bundling 7 MCP servers + 10 slash commands + 7 auto-trigger skills.
- **44 models** across 6 providers (Ollama cloud, NVIDIA NIM, NVIDIA Security, Copilot, Gemini) + 4 free-tier opencode models.
- **Auto-routing**: Opus picks the right model per task silently.
- **Parallel execution**: independent subtasks dispatched in one message.
- **Verification gate**: Codex reviews every non-trivial diff before done.
- **Portable**: zero project-level `.mcp.json` needed — the plugin manifest loads the MCP servers.

---

## Requirements

| Requirement | Notes |
|---|---|
| [Claude Code](https://docs.anthropic.com/claude-code) | Version with plugin + marketplace support |
| Node.js >= 18 | on `PATH` |
| `npm install` inside the plugin | Installs `@modelcontextprotocol/sdk`, `zod`, `js-yaml` locally. No global install required. |
| `NVIDIA_API_KEY` *(optional)* | For NVIDIA NIM + Security. Get at [build.nvidia.com](https://build.nvidia.com). |
| `OLLAMA_HOST` *(optional)* | Default `http://localhost:11434`. Ollama cloud models require an [Ollama](https://ollama.com) install + cloud-enabled account. |
| `GH_TOKEN` or `GITHUB_TOKEN` *(optional)* | For Copilot CLI. PAT with `Copilot Requests` scope. Also: `npm install -g @github/copilot`. |
| `GEMINI_API_KEY` or Google OAuth *(optional)* | For Gemini CLI. Run `gemini` once interactively for OAuth, or set `GEMINI_API_KEY`. |
| `npm install -g opencode-ai` *(optional)* | For opencode CLI. Auth: `opencode providers login`. Free-tier models only. |
| Codex CLI *(optional)* | `npm install -g @openai/codex` + `codex login`. Verification gate + rescue executor. |
| `MCP_GLOBAL_MODULES` *(legacy)* | Fallback path to a global `node_modules` if plugin-local `node_modules` is missing. |

---

## Install in any project

### Option A — GitHub marketplace (recommended)

Two commands, any project, any machine:

```bash
claude plugin marketplace add ranjankumarpatel/claude-code-multi-model
claude plugin install multi-model@claude-code-multi-model
```

Restart Claude Code -> plugin auto-loads with its 7 MCP servers. Verify:

```bash
claude mcp list        # expect plugin:multi-model:{ollama,nvidia-nim,nvidia-security,copilot,codex,opencode,gemini}
```

**Update after plugin code changes:**

```bash
claude plugin marketplace update ranjankumarpatel/claude-code-multi-model
```

Or force reinstall:

```bash
claude plugin remove multi-model
claude plugin marketplace add ranjankumarpatel/claude-code-multi-model
claude plugin install multi-model@claude-code-multi-model
```

### Option B — local clone (development)

For hacking on the plugin itself:

```bash
git clone https://github.com/ranjankumarpatel/claude-code-multi-model.git
claude plugin marketplace add /absolute/path/to/claude-code-multi-model
claude plugin install multi-model@claude-code-multi-model
```

---

## Environment setup

Set once per machine (shell profile):

```bash
# Optional — NVIDIA NIM + Security
export NVIDIA_API_KEY="nvapi-..."

# Optional — override Ollama host
export OLLAMA_HOST="http://localhost:11434"

# Optional — GitHub Copilot CLI
export GH_TOKEN="ghp_..."

# Optional — Google Gemini CLI
export GEMINI_API_KEY="AIza..."

# Legacy — only if plugin-local node_modules is missing
export MCP_GLOBAL_MODULES="$(npm root -g)"
```

Windows PowerShell:
```powershell
setx NVIDIA_API_KEY "nvapi-..."
setx GH_TOKEN "ghp_..."
setx GEMINI_API_KEY "AIza..."
```

Install plugin dependencies:
```bash
cd plugins/multi-model
npm install
```

---

## Install Codex integration

Codex is optional but recommended — it's the verification gate + rescue executor in the auto-routing pattern.

1. Install the [Codex CLI](https://github.com/openai/codex): `npm install -g @openai/codex`
2. Sign in: `codex login` (ChatGPT subscription — no `OPENAI_API_KEY` needed).
3. Verify with `/multi-model:codex review` inside Claude Code.

If Codex is not installed, `multi-model` still works — auto-routing will simply skip the Codex verification step.

---

## How auto-routing works

Opus never edits files or runs shell directly. It parses your request, decomposes into subtasks, and dispatches each to the best executor using this rubric:

| Task signal | Auto-route to |
|---|---|
| Bulk read / grep / rename / format | Haiku |
| Multi-file refactor, debugging, tests | Sonnet |
| Deep chain-of-thought reasoning | `kimi-k2-thinking:cloud` (Ollama) or `nemotron-ultra` (NIM) |
| Agentic coding / repo-level edits | `qwen3-coder` (NIM) or `glm-5.1:cloud` (Ollama) |
| Coding second opinion / alt-frontier | `gemma4:31b-cloud` (Ollama) or `gpt-5.3-codex` (Copilot) |
| Long-context / agentic / vision | `kimi-k2.5:cloud` (Ollama) or `gemini-3-pro` (Copilot/Gemini) |
| Multimodal / vision | `gemma4` (NIM) or Gemini CLI (`auto`) |
| Cross-vendor comparison | Copilot CLI or opencode CLI (free) |
| Security audit / CVE / OWASP / PII / injection | NVIDIA Security |
| Stuck / failing tests / pre-merge verify | Codex |
| Free-tier bulk / repeat calls | opencode CLI |
| 2+ independent subtasks | Parallel in one message |

You just state the goal. Opus reports the route in one line (e.g. `Routing: refactor -> Sonnet; rename -> Haiku; audit -> NVIDIA Security`) and runs.

---

## Slash commands

| Command | Purpose |
|---|---|
| `/multi-model:delegate <task>` | Auto-orchestrate any task end-to-end |
| `/multi-model:ollama <prompt>` | Direct Ollama cloud chat |
| `/multi-model:nvidia <prompt>` | Direct NVIDIA NIM chat |
| `/multi-model:nvidia-security <prompt>` | Security audit / guardrail task |
| `/multi-model:copilot <prompt>` | GitHub Copilot CLI (1 premium request per call) |
| `/multi-model:gemini <prompt>` | Google Gemini CLI (no premium cost) |
| `/multi-model:opencode <prompt>` | opencode CLI (free-tier models only) |
| `/multi-model:codex [review\|rescue\|adversarial] <arg>` | Codex handoff |
| `/multi-model:models` | List all available models across providers |
| `/multi-model:test-all-models` | Canary ping every executor + MCP endpoint |

### Examples

```text
/multi-model:delegate add rate limiting to /api/upload, cover with tests, scan for injection risk
```
Opus -> plans -> Sonnet writes middleware + tests in parallel with Haiku reading existing routes; NVIDIA Security scans the diff; Codex reviews; Opus reports.

```text
/multi-model:ollama --model kimi-k2-thinking:cloud explain why this reducer infinite-loops
```

```text
/multi-model:nvidia --model nemotron-ultra prove this sort is stable
```

```text
/multi-model:gemini review this PR for performance issues
```

```text
/multi-model:opencode summarize this module
```

```text
/multi-model:codex review
```

---

## MCP tools exposed

Once the plugin loads, these tools appear in Claude Code:

| Server | Tools |
|---|---|
| `ollama` | `ollama_chat`, `ollama_list_models` |
| `nvidia-nim` | `nvidia_chat`, `nvidia_list_models` |
| `nvidia-security` | `nvidia_security_chat`, `nvidia_security_list_models` |
| `copilot` | `copilot_chat`, `copilot_list_models` |
| `gemini` | `gemini_chat`, `gemini_list_models` |
| `opencode` | `opencode_run`, `opencode_list_models` |
| `codex` | `codex_exec`, `codex_review` |

Opus calls them automatically based on the auto-routing rubric. You can call them directly too.

### Model highlights

**Ollama cloud** (15 models): `gemma4:31b-cloud`, `kimi-k2.5:cloud`, `kimi-k2-thinking:cloud`, `deepseek-v3.2:cloud`, `devstral-2:123b-cloud`, `glm-5.1:cloud`, `qwen3-coder:480b-cloud`, and more.

**NVIDIA NIM** (10 models): `qwen3-coder`, `devstral`, `kimi-k2-coder`, `deepseek-coder`, `nemotron-ultra`, `nemotron-super`, `gemma4`, `llama405b`, `mistral-large`, `granite-guardian`.

**NVIDIA Security** (8 models): `nemotron-ultra`, `qwen3-coder`, `devstral`, `llama-guard`, `nemotron-safety`, `nemotron-safety-reason`, `granite-guardian`, `gliner-pii`.

**Copilot CLI** (6 models): `claude-opus-4.6`, `claude-sonnet-4.6`, `claude-haiku-4.5`, `gpt-5.3-codex`, `gemini-3-pro`, `gpt-5`.

**Gemini CLI** (5 models): `auto` (default), `gemini-3-pro-preview`, `gemini-3-flash-preview`, `gemini-2.5-pro`, `gemini-2.5-flash`.

**opencode CLI** (4 free models): `opencode/big-pickle-free`, `opencode/ling-2.6-flash-free`, `opencode/nemotron-3-super-free`, `opencode/minimax-m2.5-free`.

Full catalog with per-model notes: [`plugins/multi-model/MODELS.md`](plugins/multi-model/MODELS.md).

---

## Plugin layout

```
plugins/multi-model/
+-- .claude-plugin/
|   +-- plugin.json              # Manifest -- declares 7 MCP servers + hooks
+-- package.json
+-- models.yaml                  # Single source of truth for model catalog
+-- README.md
+-- MODELS.md                    # Generated from models.yaml
+-- CLAUDE.md                    # Opus orchestrator/advisor rules
+-- commands/                    # 10 slash commands
|   +-- delegate.md
|   +-- ollama.md
|   +-- nvidia.md
|   +-- nvidia-security.md
|   +-- copilot.md
|   +-- gemini.md
|   +-- opencode.md
|   +-- codex.md
|   +-- models.md
|   +-- test-all-models.md
+-- skills/                      # 7 skills
|   +-- orchestrator/SKILL.md    # Auto-routing playbook
|   +-- advisor/SKILL.md         # Model recommendation advisor
|   +-- ollama-models/SKILL.md
|   +-- nvidia-nim-models/SKILL.md
|   +-- nvidia-security-models/SKILL.md
|   +-- copilot-models/SKILL.md
|   +-- gemini-cli-models/SKILL.md
+-- scripts/                     # Bundled MCP servers
|   +-- mcp-ollama.mjs
|   +-- mcp-nvidia.mjs
|   +-- mcp-security-nvidia.mjs
|   +-- mcp-copilot.mjs
|   +-- mcp-gemini.mjs
|   +-- mcp-opencode.mjs
|   +-- mcp-codex.mjs
|   +-- ollama-companion.mjs
|   +-- lib/common.mjs
|   +-- lib/copilot-models.mjs
|   +-- lib/gemini-models.mjs
+-- hooks/
|   +-- opus-executor-guard.mjs  # PreToolUse hook -- blocks Opus from direct execution
+-- evals/                       # Eval framework
|   +-- run.mjs
|   +-- scorers.mjs
|   +-- tasks/
+-- tests/
    +-- common.test.mjs
```

All paths resolve via `${CLAUDE_PLUGIN_ROOT}` — the plugin works unchanged regardless of where the project lives.

---

## Pin auto-routing in your project (recommended)

Append to your project's `CLAUDE.md` so the behavior sticks across sessions:

```markdown
## Model routing

Auto-route rule: Opus decides the model for every task automatically from the request signal. Never ask the user which model to use. Use the rubric in the `multi-model-orchestrator` skill. Report the chosen route in one line. Opus never edits files or runs shell directly — delegate to Sonnet/Haiku/Ollama/NVIDIA/Copilot/Gemini/Codex.
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module '@modelcontextprotocol/sdk'` | Run `npm install` inside `plugins/multi-model/`. Or set `MCP_GLOBAL_MODULES` as fallback. |
| NVIDIA tools return 401 | `NVIDIA_API_KEY` missing or invalid |
| Ollama tools fail with ECONNREFUSED | Start Ollama (`ollama serve`) or set `OLLAMA_HOST` |
| Copilot fails with `spawn EINVAL` | Restart Claude Code to reload `mcp-copilot.mjs` |
| Copilot returns 401 | `GH_TOKEN` missing/expired or no Copilot subscription |
| Gemini returns 403 | `GEMINI_API_KEY` invalid or Google OAuth not set up (run `gemini` once) |
| opencode returns auth error | Run `opencode providers login` to authenticate |
| MCP servers not visible | Confirm the plugin is listed in `marketplace.json` and Claude Code loaded it (`/doctor`) |
| Opus still edits files directly | Ensure project `CLAUDE.md` has the routing rule; restart the session |
| `Codex blocked (sandbox restriction)` | Use `mcp__codex__codex_exec` (direct CLI) instead of openai-codex plugin slash commands |

---

## Cost

| Provider | Cost |
|---|---|
| Copilot CLI | 1 premium request per call |
| Gemini CLI | Free (user's Google account quota) |
| opencode CLI | Free (free-tier models only) |
| Ollama cloud | Self-hosted / cloud endpoint |
| NVIDIA NIM | Per NVIDIA API pricing |
| Codex | Per OpenAI/ChatGPT subscription |

---

## Uninstall

Remove the entry from `.claude-plugin/marketplace.json` (or delete `plugins/multi-model/`). No other project state to clean up.

---

## License

MIT. Use, fork, adapt.
