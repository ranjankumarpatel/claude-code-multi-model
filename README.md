# claude-code-multi-model

Portable Claude Code plugin for automatic multi-model orchestration. Opus plans + synthesizes. Sonnet/Haiku/Ollama cloud/NVIDIA NIM/NVIDIA Security/Codex execute in parallel. Codex verifies before merge. **No user prompting for model choice** — Opus auto-routes from task signal.

Drop into any project and start delegating across providers immediately.

---

## What you get

- **One plugin** (`multi-model`) bundling 3 MCP servers + 6 slash commands + 1 auto-trigger skill.
- **Auto-routing**: Opus picks the right model per task silently.
- **Parallel execution**: independent subtasks dispatched in one message.
- **Verification gate**: Codex reviews every non-trivial diff before done.
- **Portable**: zero project-level `.mcp.json` needed — the plugin manifest loads the MCP servers.

---

## Requirements

| Requirement | Notes |
|---|---|
| [Claude Code](https://docs.anthropic.com/claude-code) | Version with plugin + marketplace support |
| Node.js ≥ 18 | on `PATH` |
| `@modelcontextprotocol/sdk`, `zod` (global npm) | `npm i -g @modelcontextprotocol/sdk zod` |
| `MCP_GLOBAL_MODULES` env | Points at your global `node_modules`. Windows: `C:\Users\<you>\AppData\Roaming\npm\node_modules`. macOS/Linux: output of `npm root -g`. |
| `NVIDIA_API_KEY` *(optional)* | For NVIDIA NIM + Security. Get at [build.nvidia.com](https://build.nvidia.com). |
| `OLLAMA_HOST` *(optional)* | Default `http://localhost:11434`. Ollama cloud models require an [Ollama](https://ollama.com) install + cloud-enabled account. |
| Codex plugin *(optional)* | For `/codex:review`, `/codex:rescue`, `/codex:adversarial-review`. Install from [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc). Requires the [Codex CLI](https://github.com/openai/codex) on `PATH`. |

---

## Install in any project

### Option 0 — one-liner CLI (fastest)

```bash
cd your-project
npx github:ranjankumarpatel/claude-code-multi-model --cache --with-codex --env
```

Flags: `--cache` (reuse `~/.cache/claude-code-multi-model`), `--with-codex` (add codex-plugin-cc to marketplace), `--env` (write `MCP_GLOBAL_MODULES` to shell profile), `--global`, `--copy`, `--target <dir>`. `npx cmm-install -h` for full help.

### Option A — marketplace (recommended)

1. Clone this repo next to your project:
   ```bash
   git clone https://github.com/ranjankumarpatel/claude-code-multi-model.git
   ```
2. In your target project, create or edit `.claude-plugin/marketplace.json`:
   ```json
   {
     "name": "my-project-marketplace",
     "owner": { "name": "you" },
     "plugins": [
       {
         "name": "multi-model",
         "source": "../claude-code-multi-model/plugins/multi-model",
         "version": "1.0.0"
       }
     ]
   }
   ```
3. Launch Claude Code in the project → plugin auto-loads. Verify with `/multi-model:models`.

### Option B — copy plugin into the project

```bash
cp -r claude-code-multi-model/plugins/multi-model your-project/plugins/
```

Then point `.claude-plugin/marketplace.json` at `./plugins/multi-model`.

### Option C — global install

Drop the plugin dir into `~/.claude/plugins/multi-model/` — it loads for every project.

---

## Environment setup

Set once per machine (shell profile):

```bash
# Required for MCP servers to find the SDK
export MCP_GLOBAL_MODULES="$(npm root -g)"

# Optional — NVIDIA NIM + Security
export NVIDIA_API_KEY="nvapi-..."

# Optional — override Ollama host
export OLLAMA_HOST="http://localhost:11434"
```

Windows PowerShell:
```powershell
setx MCP_GLOBAL_MODULES "C:\Users\$env:USERNAME\AppData\Roaming\npm\node_modules"
setx NVIDIA_API_KEY "nvapi-..."
```

Install MCP deps globally:
```bash
npm i -g @modelcontextprotocol/sdk zod
```

---

## Install Codex integration

Codex is optional but recommended — it's the verification gate + rescue executor in the auto-routing pattern.

1. Install the [Codex CLI](https://github.com/openai/codex) and sign in so `codex` runs on your terminal.
2. Add [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) to your marketplace alongside this plugin:
   ```json
   {
     "plugins": [
       { "name": "multi-model", "source": "../claude-code-multi-model/plugins/multi-model", "version": "1.0.0" },
       { "name": "codex",       "source": "../codex-plugin-cc",                            "version": "latest" }
     ]
   }
   ```
3. Verify with `/codex:review` or `/codex:rescue` inside Claude Code.

If Codex is not installed, `multi-model` still works — auto-routing will simply skip the Codex verification step.

---

## How auto-routing works

Opus never edits files or runs shell directly. It parses your request, decomposes into subtasks, and dispatches each to the best executor using this rubric:

| Task signal | Auto-route to |
|---|---|
| Bulk read / grep / rename / format | Haiku |
| Multi-file refactor, debugging, tests | Sonnet |
| Deep chain-of-thought reasoning | `kimi-k2-thinking:cloud` or `deepseek-r1` |
| Coding second opinion / alt-frontier | `gemma4:31b-cloud` or `nemotron-ultra` |
| Long-context / agentic / vision | `kimi-k2.5:cloud` |
| Multilingual / non-English code | `mistral-large` |
| Large general-purpose | `llama405b` |
| Security audit / CVE / OWASP / PII / injection | NVIDIA Security |
| Stuck / failing tests / pre-merge verify | Codex |
| ≥2 independent subtasks | Parallel in one message |

You just state the goal. Opus reports the route in one line (e.g. `Routing: refactor → Sonnet; rename → Haiku; audit → NVIDIA Security`) and runs.

---

## Slash commands

| Command | Purpose |
|---|---|
| `/multi-model:delegate <task>` | Auto-orchestrate any task end-to-end |
| `/multi-model:ollama <prompt>` | Direct Ollama cloud chat (manual override) |
| `/multi-model:nvidia <prompt>` | Direct NVIDIA NIM chat |
| `/multi-model:nvidia-security <prompt>` | Security audit / guardrail task |
| `/multi-model:codex [review\|rescue\|adversarial] <arg>` | Codex handoff |
| `/multi-model:models` | List all available models across providers |

### Examples

```text
/multi-model:delegate add rate limiting to /api/upload, cover with tests, scan for injection risk
```
Opus → plans → Sonnet writes middleware + tests in parallel with Haiku reading existing routes; NVIDIA Security scans the diff; Codex reviews; Opus reports.

```text
/multi-model:ollama --model kimi-thinking explain why this reducer infinite-loops
```

```text
/multi-model:nvidia --model deepseek-r1 --thinking prove this sort is stable
```

```text
/multi-model:codex review
```

---

## MCP tools exposed

Once the plugin loads, these tools appear in Claude Code:

- `mcp__ollama__ollama_list_models`, `mcp__ollama__ollama_chat`
- `mcp__nvidia-nim__nvidia_list_models`, `mcp__nvidia-nim__nvidia_chat`
- `mcp__nvidia-security__nvidia_security_list_models`, `mcp__nvidia-security__nvidia_security_chat`

Opus calls them automatically based on the auto-routing rubric. You can call them directly too.

### Available models

**Ollama cloud**: `gemma4:31b-cloud`, `kimi-k2.5:cloud`, `kimi-k2-thinking:cloud`

**NVIDIA NIM** (aliases): `nemotron-ultra`, `nemotron-super`, `gemma4`, `deepseek-r1`, `llama405b`, `mistral-large`

**NVIDIA Security**: curated set, enumerate via `nvidia_security_list_models`

---

## Plugin layout

```
plugins/multi-model/
├── plugin.json              # Manifest — declares MCP servers
├── README.md
├── commands/                # Slash commands
│   ├── delegate.md
│   ├── ollama.md
│   ├── nvidia.md
│   ├── nvidia-security.md
│   ├── codex.md
│   └── models.md
├── skills/
│   └── orchestrator/
│       └── SKILL.md         # Auto-trigger routing playbook
└── scripts/                 # Bundled MCP servers
    ├── mcp-ollama.mjs
    ├── mcp-nvidia.mjs
    ├── mcp-security-nvidia.mjs
    └── ollama-companion.mjs
```

All paths resolve via `${CLAUDE_PLUGIN_ROOT}` — the plugin works unchanged regardless of where the project lives.

---

## Pin auto-routing in your project (recommended)

Append to your project's `CLAUDE.md` so the behavior sticks across sessions:

```markdown
## Model routing

Auto-route rule: Opus decides the model for every task automatically from the request signal. Never ask the user which model to use. Use the rubric in the `multi-model-orchestrator` skill. Report the chosen route in one line. Opus never edits files or runs shell directly — delegate to Sonnet/Haiku/Ollama/NVIDIA/Codex.
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module '@modelcontextprotocol/sdk'` | `npm i -g @modelcontextprotocol/sdk zod`, set `MCP_GLOBAL_MODULES` |
| NVIDIA tools return 401 | `NVIDIA_API_KEY` missing or invalid |
| Ollama tools fail with ECONNREFUSED | Start Ollama (`ollama serve`) or set `OLLAMA_HOST` |
| MCP servers not visible | Confirm the plugin is listed in `marketplace.json` and Claude Code loaded it (`/doctor`) |
| Opus still edits files directly | Ensure project `CLAUDE.md` has the routing rule; restart the session |
| Codex commands not found | Install [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) and the [Codex CLI](https://github.com/openai/codex) |

---

## Uninstall

Remove the entry from `.claude-plugin/marketplace.json` (or delete `plugins/multi-model/`). No other project state to clean up.

---

## License

MIT. Use, fork, adapt.
