# MCP Server Setup

This project ships MCP servers through two delivery paths:

1. **`.mcp.json`** (project root) — project-level wiring for servers not managed by a plugin. Currently covers the Playwright server.
2. **`plugins/multi-model/.claude-plugin/plugin.json`** — plugin-managed servers that auto-load when the `multi-model` plugin is active. This is the preferred path; it includes all seven custom servers listed below.

> **Prefer the plugin path.** If you have the `multi-model` plugin installed and active, you do **not** need to touch `.mcp.json` for the custom servers — they are wired automatically.

---

## MCP servers at a glance

| Server name | Script | MCP tools | Auth required |
|---|---|---|---|
| `ollama` | `scripts/mcp-ollama.mjs` | `ollama_chat`, `ollama_list_models` | None (`OLLAMA_HOST` optional) |
| `nvidia-nim` | `scripts/mcp-nvidia.mjs` | `nvidia_chat`, `nvidia_list_models` | `NVIDIA_API_KEY` |
| `nvidia-security` | `scripts/mcp-security-nvidia.mjs` | `nvidia_security_chat`, `nvidia_security_list_models` | `NVIDIA_API_KEY` |
| `copilot` | `scripts/mcp-copilot.mjs` | `copilot_chat`, `copilot_list_models` | `GH_TOKEN` or `GITHUB_TOKEN` |
| `codex` | `scripts/mcp-codex.mjs` | `codex_exec`, `codex_review` | `codex login` (ChatGPT subscription) |
| `gemini` | `scripts/mcp-gemini.mjs` | `gemini_chat`, `gemini_list_models` | `GEMINI_API_KEY` or Google OAuth |
| `opencode` | `scripts/mcp-opencode.mjs` | `opencode_run`, `opencode_list_models` | `opencode providers login` |
| `playwright` | `npx @playwright/mcp@latest` | `browser_*` (20+ tools) | None |

---

## Prerequisites

- Node.js >= 18
- npm on PATH

### Install dependencies (choose one approach)

**Option A — plugin-local install (preferred)**

```bash
cd plugins/multi-model
npm install
```

Installs `@modelcontextprotocol/sdk`, `zod`, and `js-yaml` into `plugins/multi-model/node_modules`. No global install needed; `MCP_GLOBAL_MODULES` becomes optional.

**Option B — global install (legacy / root `.mcp.json` path)**

```bash
npm install -g @modelcontextprotocol/sdk zod
```

Confirm the global root:

```bash
npm root -g
```

Typical paths:

| OS | `npm root -g` |
|---|---|
| Windows | `C:\Users\<user>\AppData\Roaming\npm\node_modules` |
| macOS (Homebrew) | `/opt/homebrew/lib/node_modules` |
| Linux | `/usr/lib/node_modules` or `~/.npm-global/lib/node_modules` |

---

## How module resolution works

Each `.mjs` server uses `createRequireFromLocalFirst` (defined in `scripts/lib/common.mjs`). It first looks for dependencies in the script's own local `node_modules`, then falls back to the path in `MCP_GLOBAL_MODULES`:

```js
import { createRequire } from "node:module";
const require = createRequire(
  process.env.MCP_GLOBAL_MODULES
    ? `file:///${process.env.MCP_GLOBAL_MODULES.replaceAll("\\", "/")}/`
    : import.meta.url
);
```

Node's ESM loader ignores `NODE_PATH`, so this `createRequire` pattern is the reliable way to import globally-installed packages from a standalone `.mjs`.

---

## Server details

### 1. Ollama (`ollama`)

Routes prompts to Ollama cloud models (and local Ollama instances).

**Script:** `plugins/multi-model/scripts/mcp-ollama.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `ollama_list_models` | List all supported cloud models with provider, params, and context size |
| `ollama_chat` | Send a chat prompt to an Ollama cloud model |

**Models (cloud, free tier via Ollama cloud routing):**

| Name | Provider | Params | Context | Notes |
|---|---|---|---|---|
| `gemma4:31b-cloud` | Google | 31B | 256K | Frontier-level, multimodal, coding+reasoning |
| `kimi-k2.5:cloud` | Moonshot | MoE | 256K | Native multimodal, vision+language, agentic |
| `kimi-k2-thinking:cloud` | Moonshot | MoE | 256K | Extended thinking / chain-of-thought |
| `kimi-k2:1t-cloud` | Moonshot | 1T | 256K | MoE coding agent, tool calling |
| `deepseek-v3.2:cloud` | DeepSeek | MoE | 160K | Efficient reasoning + agentic coding |
| `devstral-2:123b-cloud` | Mistral | 123B | 256K | Repo-level edits, tool calling, agentic |
| `devstral-small-2:24b-cloud` | Mistral | 24B | 256K | Lightweight agentic coding with tool use |
| `glm-4.6:cloud` | Z.ai | MoE | 198K | Agentic + reasoning + coding |
| `glm-5.1:cloud` | Z.ai | MoE | 198K | Frontier agentic, SWE-Bench Pro SOTA |
| `gpt-oss:120b-cloud` | OpenAI | 120B | 256K | OpenAI open-weight reasoning + agentic |
| `minimax-m2:cloud` | MiniMax | MoE | 200K | High-efficiency coding + agentic |
| `mistral-large-3:675b-cloud` | Mistral | 675B | 256K | Multimodal MoE, vision+tools, production |
| `nemotron-3-super:cloud` | NVIDIA | 120B | 128K | NVIDIA 120B MoE agentic, strong tool use |
| `qwen3-coder-next:cloud` | Alibaba | MoE | 256K | Agentic coding, local-dev focus |
| `qwen3-coder:480b-cloud` | Alibaba | 480B | 256K | Long-context coding + agentic |

**Slash command:** `/multi-model:ollama`

**Environment variables:**

| Variable | Required | Default | Description |
|---|---|---|---|
| `OLLAMA_HOST` | No | `http://localhost:11434` | Ollama server URL |
| `MCP_GLOBAL_MODULES` | No (if plugin-local install done) | — | Path to global `node_modules` |

---

### 2. NVIDIA NIM (`nvidia-nim`)

Access to frontier models via the NVIDIA NIM API (`https://integrate.api.nvidia.com/v1`), OpenAI-compatible.

**Script:** `plugins/multi-model/scripts/mcp-nvidia.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `nvidia_list_models` | List all supported NIM models with aliases and strengths |
| `nvidia_chat` | Send a chat prompt to a NVIDIA NIM model |

**Models:**

| Alias | Model ID | Notes |
|---|---|---|
| `qwen3-coder` | `qwen/qwen3-coder-480b-a35b-instruct` | Best-in-class agentic coding, 480B MoE, default for code tasks |
| `devstral` | `mistralai/devstral-2-123b-instruct-2512` | Heavy coding / SE agent, repo-scale refactors |
| `kimi-k2-coder` | `moonshotai/kimi-k2-instruct-0905` | Long-context coding + agentic tool calling |
| `deepseek-coder` | `deepseek-ai/deepseek-v3_1-terminus` | Strong coding + tool-calling, math/logic |
| `nemotron-ultra` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | NVIDIA flagship — best reasoning, coding, instruction following |
| `nemotron-super` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Balanced reasoning + speed, strong coding |
| `gemma4` | `google/gemma-4-31b-it` | Multimodal (vision), thinking mode, coding+reasoning |
| `llama405b` | `meta/llama-3.1-405b-instruct` | Meta Llama 405B — general purpose, large context |
| `mistral-large` | `mistralai/mistral-large-2-instruct` | Mistral Large — multilingual, coding, instruction |
| `granite-guardian` | `ibm/granite-guardian-3_0-8b` | Risk/guardrail classifier — bias, harm, hallucination, jailbreak |

> **Note:** `deepseek-r1` reached EOL 2026-01-26 (410 Gone). Use `nemotron-ultra` or `kimi-k2-thinking:cloud` (Ollama) for deep reasoning instead.

**Auth:** Obtain an API key at [build.nvidia.com](https://build.nvidia.com).

**Slash command:** `/multi-model:nvidia`

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `NVIDIA_API_KEY` | Yes | NVIDIA NIM API key |
| `MCP_GLOBAL_MODULES` | No (if plugin-local install done) | Path to global `node_modules` |

---

### 3. NVIDIA Security NIM (`nvidia-security`)

Curated security-focused subset of NVIDIA NIM models for code audit, safety classification, PII detection, and guardrails.

**Script:** `plugins/multi-model/scripts/mcp-security-nvidia.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `nvidia_security_list_models` | List security/audit-specific NIM models with roles |
| `nvidia_security_chat` | Run a security-focused prompt through a NIM security model |

**Models:**

| Alias | Model ID | Role | Notes |
|---|---|---|---|
| `nemotron-ultra` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | audit-reasoner | Flagship reasoning — vulnerability analysis, secure-code review, compliance audits |
| `qwen3-coder` | `qwen/qwen3-coder-480b-a35b-instruct` | code-auditor | SAST-style review, taint analysis, fix suggestions |
| `devstral` | `mistralai/devstral-2-123b-instruct-2512` | code-auditor | Repo-scale secure-code review, dependency / IaC audits |
| `llama-guard` | `meta/llama-guard-4-12b` | safety-classifier | Multimodal (text+image) safety — prompt-injection, jailbreak, policy violations |
| `nemotron-safety` | `nvidia/llama-3_1-nemotron-safety-guard-8b-v3` | safety-classifier | LLM I/O moderation — harmful content, policy gating, guardrails |
| `nemotron-safety-reason` | `nvidia/nemotron-content-safety-reasoning-4b` | safety-classifier | Reasoning-based safety classifier with justification |
| `granite-guardian` | `ibm/granite-guardian-3_0-8b` | risk-classifier | Enterprise risk — bias, harm, hallucination, jailbreak, function-call risk |
| `gliner-pii` | `nvidia/gliner-pii` | pii-detector | PII detection / redaction — GDPR/HIPAA pre-processing |

**Slash command:** `/multi-model:nvidia-security`

**Environment variables:** Same as `nvidia-nim` — `NVIDIA_API_KEY` required.

---

### 4. GitHub Copilot CLI (`copilot`)

Routes prompts to cross-vendor models via the `copilot` CLI (`@github/copilot`). Each call costs **1 premium request** from your GitHub Copilot monthly allocation.

**Script:** `plugins/multi-model/scripts/mcp-copilot.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `copilot_list_models` | List supported Copilot CLI model IDs |
| `copilot_chat` | Send a chat prompt to a GitHub Copilot CLI model |

**Models:**

| Alias | Notes |
|---|---|
| `gpt-5.3-codex` | GPT-5.3-Codex — peer to Sonnet for code generation and editing |
| `gemini-3-pro` | Gemini 3 Pro — long-context work and vision+language tasks |
| `claude` | Routes back to Claude through Copilot auth (cross-vendor compare) |

**Auth setup:**

```bash
npm install -g @github/copilot
gh auth login          # or: export GH_TOKEN=<your-PAT>
```

PAT requires the `Copilot Requests` scope.

**Slash command:** `/multi-model:copilot`

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `GH_TOKEN` or `GITHUB_TOKEN` | Yes | GitHub PAT with `Copilot Requests` scope |
| `MCP_GLOBAL_MODULES` | No (if plugin-local install done) | Path to global `node_modules` |

---

### 5. OpenAI Codex CLI (`codex`)

Wraps the `codex` binary (`@openai/codex`) as a stdio MCP server. This path **bypasses** the openai-codex plugin's Landlock sandbox — the source of `Codex blocked (sandbox restriction, file access denied)` errors.

**Script:** `plugins/multi-model/scripts/mcp-codex.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `codex_exec` | Run `codex exec --full-auto` (workspace-write + on-request approvals). Set `bypassSandbox: true` for `--dangerously-bypass-approvals-and-sandbox` in trusted repos. |
| `codex_review` | Run `codex exec --sandbox read-only` for diff/review. Mandatory verification gate before merging non-trivial changes. |

**Tool parameters (`codex_exec`):**

| Parameter | Type | Description |
|---|---|---|
| `prompt` | string | Task prompt for Codex |
| `model` | string? | Codex model (e.g. `gpt-5.3-codex`, `gpt-5.3-codex-spark`) |
| `cwd` | string? | Working directory |
| `bypassSandbox` | boolean? | Use `--dangerously-bypass-approvals-and-sandbox` (YOLO mode; trusted repos only) |
| `sandboxMode` | enum? | `read-only`, `workspace-write`, or `danger-full-access` |
| `effort` | enum? | Reasoning effort: `none`, `minimal`, `low`, `medium`, `high`, `xhigh` |
| `addDir` | string[]? | Extra writable dirs (`--add-dir`) — prefer over `bypassSandbox` when you need one extra directory |

**Auth setup:**

```bash
npm install -g @openai/codex
codex login            # Uses ChatGPT subscription credentials; cached in ~/.codex/auth.json
```

> **Important:** Do NOT set `OPENAI_API_KEY`. This MCP server deliberately omits it to preserve ChatGPT subscription auth. Setting `OPENAI_API_KEY` would override subscription credentials.

**Fallback:** If `codex` is not on PATH, fall back to openai-codex plugin slash commands: `/codex:review`, `/codex:adversarial-review`, or the `codex:codex-rescue` subagent.

**Slash command:** `/multi-model:codex`

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `CODEX_HOME` | No | Override for `~/.codex` credential directory |
| `MCP_GLOBAL_MODULES` | No (if plugin-local install done) | Path to global `node_modules` |

---

### 6. Google Gemini CLI (`gemini`)

Wraps the `gemini` binary (`@google/gemini-cli`) as a stdio MCP server. Auth is via `GEMINI_API_KEY` **or** Google OAuth (cached from interactive login) — no premium-request cost.

**Script:** `plugins/multi-model/scripts/mcp-gemini.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `gemini_list_models` | List supported Gemini CLI model IDs |
| `gemini_chat` | Run a prompt through the Gemini CLI |

**Tool parameters (`gemini_chat`):**

| Parameter | Type | Description |
|---|---|---|
| `prompt` | string | Prompt to send to Gemini |
| `model` | string? | Model ID (see below). Omit or use `auto` to let the CLI pick. |
| `cwd` | string? | Working directory |
| `approvalMode` | enum? | `default`, `auto_edit`, `yolo` (default), `plan` |

**Models:**

| Model ID | Notes |
|---|---|
| `auto` | **Default** — smart routing picks the best Gemini model per task complexity |
| `gemini-3-pro-preview` | Flagship, deep reasoning, long-context (>256K) |
| `gemini-3-flash-preview` | Fast Gemini 3 tier |
| `gemini-2.5-pro` | Stable production tier, multimodal |
| `gemini-2.5-flash` | Fast, cheap, bulk tasks |

**Auth setup:**

```bash
npm install -g @google/gemini-cli
gemini auth login      # Interactive Google OAuth (no API key needed)
# OR: export GEMINI_API_KEY=<your-key>
```

**Slash command:** `/gemini`

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | No (if OAuth cached) | Google AI API key |
| `GOOGLE_API_KEY` | No | Alternative Google API key |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Path to service account JSON |
| `MCP_GLOBAL_MODULES` | No (if plugin-local install done) | Path to global `node_modules` |

**Drift check:** On startup, the server compares its hand-coded model list against `models.yaml`. Mismatches are logged to stderr. Set `GEMINI_STRICT_MODELS=1` to fail startup on drift.

---

### 7. opencode CLI (`opencode`)

Wraps the `opencode` binary as a stdio MCP server. Cross-vendor executor. This MCP server enforces a **free-models-only allowlist** to prevent unexpected billing — paid opencode models are rejected at the tool level.

**Script:** `plugins/multi-model/scripts/mcp-opencode.mjs`

**Tools:**

| Tool | Description |
|---|---|
| `opencode_list_models` | List the free-tier allowlist plus full `opencode models` output for reference |
| `opencode_run` | Run a prompt through `opencode run` non-interactively. Restricted to free-tier models. |

**Tool parameters (`opencode_run`):**

| Parameter | Type | Description |
|---|---|---|
| `prompt` | string | Task prompt |
| `model` | string? | Free-tier model (see allowlist below). Default: first entry in allowlist |
| `agent` | string? | opencode agent (`opencode agent` subcommand) |
| `variant` | string? | Provider reasoning variant (e.g. `high`, `max`, `minimal`) |
| `cwd` | string? | Working directory (`--dir`) |
| `thinking` | boolean? | Show thinking blocks |
| `format` | enum? | `default` or `json` |
| `dangerouslySkipPermissions` | boolean? | Auto-approve tool use. Default: `true` (headless). |

**Free-tier allowlist (enforced by MCP — paid models are blocked):**

| Model | Notes |
|---|---|
| `opencode/big-pickle` | **Default** free workhorse |
| `opencode/ling-2.6-flash-free` | Fast / bulk / simple tasks |
| `opencode/nemotron-3-super-free` | Reasoning-heavy / chain-of-thought |
| `opencode/minimax-m2.5-free` | Alt-frontier second opinion |

**Auth setup:**

```bash
npm install -g opencode-ai
opencode providers login   # Authenticate with your provider(s)
```

**Slash command:** `/multi-model:opencode`

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `OPENCODE_SERVER_PASSWORD` | No | opencode server password if used |
| `MCP_GLOBAL_MODULES` | No (if plugin-local install done) | Path to global `node_modules` |

> **Cost note:** Prefer opencode over Copilot for bulk/repeat cross-vendor calls — opencode free-tier models have zero cost, while each Copilot call costs 1 premium request.

---

### 8. Playwright (`playwright`)

Browser automation MCP server from the official `@playwright/mcp` package. Loaded via `npx` — no install required.

**Wiring (`.mcp.json`):**

```json
"playwright": {
  "command": "npx",
  "args": ["-y", "@playwright/mcp@latest"]
}
```

**Tools (20+):**

`browser_navigate`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_snapshot`, `browser_take_screenshot`, `browser_evaluate`, `browser_wait_for`, `browser_hover`, `browser_drag`, `browser_select_option`, `browser_file_upload`, `browser_press_key`, `browser_navigate_back`, `browser_tabs`, `browser_resize`, `browser_close`, `browser_console_messages`, `browser_network_requests`, `browser_handle_dialog`, `browser_run_code`

**Auth:** None required.

---

## Plugin-managed wiring (preferred)

When the `multi-model` plugin is active, all seven custom servers (Ollama, NVIDIA NIM, NVIDIA Security, Copilot, Codex, Gemini, opencode) are registered via `plugins/multi-model/.claude-plugin/plugin.json`. No manual `.mcp.json` edits needed for those servers.

The Playwright server must still be wired separately (via `.mcp.json` or a user-level setting), unless you have the `playwright@claude-plugins-official` plugin installed.

---

## `.mcp.json` — full reference example

```json
{
  "mcpServers": {
    "ollama": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-ollama.mjs"],
      "env": {
        "OLLAMA_HOST": "http://localhost:11434",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "nvidia-nim": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-nvidia.mjs"],
      "env": {
        "NVIDIA_API_KEY": "${NVIDIA_API_KEY}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "nvidia-security": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-security-nvidia.mjs"],
      "env": {
        "NVIDIA_API_KEY": "${NVIDIA_API_KEY}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "copilot": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-copilot.mjs"],
      "env": {
        "GH_TOKEN": "${GH_TOKEN}",
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "codex": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-codex.mjs"],
      "env": {
        "CODEX_HOME": "${CODEX_HOME}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "gemini": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-gemini.mjs"],
      "env": {
        "GEMINI_API_KEY": "${GEMINI_API_KEY}",
        "GOOGLE_API_KEY": "${GOOGLE_API_KEY}",
        "GOOGLE_APPLICATION_CREDENTIALS": "${GOOGLE_APPLICATION_CREDENTIALS}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "opencode": {
      "command": "node",
      "args": ["./plugins/multi-model/scripts/mcp-opencode.mjs"],
      "env": {
        "OPENCODE_SERVER_PASSWORD": "${OPENCODE_SERVER_PASSWORD}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Required env per server:

| Server | Required env |
|---|---|
| `ollama` | `OLLAMA_HOST` (optional), `MCP_GLOBAL_MODULES` (if no local install) |
| `nvidia-nim` | `NVIDIA_API_KEY`, `MCP_GLOBAL_MODULES` (if no local install) |
| `nvidia-security` | `NVIDIA_API_KEY`, `MCP_GLOBAL_MODULES` (if no local install) |
| `copilot` | `GH_TOKEN` or `GITHUB_TOKEN`, `MCP_GLOBAL_MODULES` (if no local install) |
| `codex` | `CODEX_HOME` (optional), `MCP_GLOBAL_MODULES` (if no local install) |
| `gemini` | `GEMINI_API_KEY` or Google OAuth, `MCP_GLOBAL_MODULES` (if no local install) |
| `opencode` | `opencode providers login` (no env key needed), `MCP_GLOBAL_MODULES` (if no local install) |
| `playwright` | None |

---

## Smoke tests

```bash
# Ollama
MCP_GLOBAL_MODULES="$(npm root -g)" OLLAMA_HOST=http://localhost:11434 node plugins/multi-model/scripts/mcp-ollama.mjs

# NVIDIA NIM
MCP_GLOBAL_MODULES="$(npm root -g)" NVIDIA_API_KEY=x node plugins/multi-model/scripts/mcp-nvidia.mjs

# NVIDIA Security
MCP_GLOBAL_MODULES="$(npm root -g)" NVIDIA_API_KEY=x node plugins/multi-model/scripts/mcp-security-nvidia.mjs

# Copilot (requires gh auth login first)
MCP_GLOBAL_MODULES="$(npm root -g)" GH_TOKEN=$(gh auth token) node plugins/multi-model/scripts/mcp-copilot.mjs

# Codex (requires codex login first)
MCP_GLOBAL_MODULES="$(npm root -g)" node plugins/multi-model/scripts/mcp-codex.mjs

# Gemini (requires GEMINI_API_KEY or prior gemini auth login)
MCP_GLOBAL_MODULES="$(npm root -g)" GEMINI_API_KEY=x node plugins/multi-model/scripts/mcp-gemini.mjs

# opencode (requires opencode providers login first)
MCP_GLOBAL_MODULES="$(npm root -g)" node plugins/multi-model/scripts/mcp-opencode.mjs
```

Each server should start on stdio with no module-resolution errors. Press Ctrl+C to stop.

For a live canary test against all endpoints:

```bash
CANARY_LIVE=1 node scripts/canary.mjs
# Stub-mode (no real API calls, for CI):
CANARY_STUB_OK=1 node scripts/canary.mjs
```

---

## Upgrading

```bash
# Global packages (if using global install path)
npm update -g @modelcontextprotocol/sdk zod

# Plugin-local packages
cd plugins/multi-model && npm update
```

No lockfile is kept in the root of this repo — the plugin's `package.json` is the source of truth for local installs.

---

## Uninstall / clean

```bash
# Global
npm uninstall -g @modelcontextprotocol/sdk zod

# Plugin-local
rm -rf plugins/multi-model/node_modules
```
