# MCP Server Setup

Local MCP servers in this repo (`mcp-ollama.mjs`, `mcp-nvidia.mjs`, `mcp-security-nvidia.mjs`, `plugins/multi-model/scripts/mcp-copilot.mjs`) resolve their dependencies from a **globally installed** npm package set. No local `package.json`, `package-lock.json`, or `node_modules` are kept in-tree.

## Prerequisites

- Node.js ≥ 18
- npm on PATH
- GitHub CLI (`gh`) on PATH — required for the `copilot` server

## 1. Install dependencies globally

```bash
npm install -g @modelcontextprotocol/sdk zod
```

Confirm the install root:

```bash
npm root -g
```

Typical paths:

| OS              | `npm root -g`                                      |
| --------------- | -------------------------------------------------- |
| Windows         | `C:\Users\<user>\AppData\Roaming\npm\node_modules` |
| macOS (Homebrew)| `/opt/homebrew/lib/node_modules`                   |
| Linux           | `/usr/lib/node_modules` or `~/.npm-global/lib/node_modules` |

## 2. How resolution works

Each `.mjs` server uses `createRequire` anchored at the global `node_modules` path supplied via the `MCP_GLOBAL_MODULES` env var:

```js
import { createRequire } from "node:module";
const require = createRequire(
  process.env.MCP_GLOBAL_MODULES
    ? `file:///${process.env.MCP_GLOBAL_MODULES.replaceAll("\\", "/")}/`
    : import.meta.url
);
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
```

Node's ESM loader ignores `NODE_PATH`, so `createRequire` with an explicit anchor is the reliable way to import globally-installed packages from a standalone `.mjs`.

## 3. `.mcp.json` wiring

Set `MCP_GLOBAL_MODULES` in each server's `env` to the output of `npm root -g`:

```json
{
  "mcpServers": {
    "ollama": {
      "command": "node",
      "args": ["./mcp-ollama.mjs"],
      "env": {
        "OLLAMA_HOST": "http://localhost:11434",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "nvidia-nim": {
      "command": "node",
      "args": ["./mcp-nvidia.mjs"],
      "env": {
        "NVIDIA_API_KEY": "${NVIDIA_API_KEY}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\<user>\\AppData\\Roaming\\npm\\node_modules"
      }
    },
    "nvidia-security": {
      "command": "node",
      "args": ["./mcp-security-nvidia.mjs"],
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
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

Required env per server:

| Server            | Required env                                              |
| ----------------- | --------------------------------------------------------- |
| `ollama`          | `OLLAMA_HOST`, `MCP_GLOBAL_MODULES`                       |
| `nvidia-nim`      | `NVIDIA_API_KEY`, `MCP_GLOBAL_MODULES`                    |
| `nvidia-security` | `NVIDIA_API_KEY`, `MCP_GLOBAL_MODULES`                    |
| `copilot`         | `GH_TOKEN` or `GITHUB_TOKEN`, `MCP_GLOBAL_MODULES`        |
| `playwright`      | none (runs via `npx -y @playwright/mcp@latest`)           |

## 4. Smoke tests

```bash
# Ollama
MCP_GLOBAL_MODULES="$(npm root -g)" OLLAMA_HOST=http://localhost:11434 node mcp-ollama.mjs

# NVIDIA NIM
MCP_GLOBAL_MODULES="$(npm root -g)" NVIDIA_API_KEY=x node mcp-nvidia.mjs

# NVIDIA Security
MCP_GLOBAL_MODULES="$(npm root -g)" NVIDIA_API_KEY=x node mcp-security-nvidia.mjs

# Copilot (requires gh auth login first)
MCP_GLOBAL_MODULES="$(npm root -g)" GH_TOKEN=$(gh auth token) node plugins/multi-model/scripts/mcp-copilot.mjs
```

Each server should start on stdio with no module-resolution errors. Ctrl+C to stop.

## 5. Upgrading

```bash
npm update -g @modelcontextprotocol/sdk zod
```

No lockfile in this repo — global install is the source of truth.

## 6. Uninstall / clean

```bash
npm uninstall -g @modelcontextprotocol/sdk zod
```
