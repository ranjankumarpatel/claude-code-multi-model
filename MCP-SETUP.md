# MCP Server Setup

Local MCP servers in this repo (`mcp-ollama.mjs`, `mcp-nvidia.mjs`, `mcp-security-nvidia.mjs`) resolve their dependencies from a **globally installed** npm package set. No local `package.json`, `package-lock.json`, or `node_modules` are kept in-tree.

## Prerequisites

- Node.js ≥ 18
- npm on PATH

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
    "nvidia-nim": {
      "command": "node",
      "args": ["./mcp-nvidia.mjs"],
      "env": {
        "NVIDIA_API_KEY": "${NVIDIA_API_KEY}",
        "MCP_GLOBAL_MODULES": "C:\\Users\\ranja\\AppData\\Roaming\\npm\\node_modules"
      }
    }
  }
}
```

Required env per server:

| Server            | Required env                                    |
| ----------------- | ----------------------------------------------- |
| `ollama`          | `OLLAMA_HOST`, `MCP_GLOBAL_MODULES`             |
| `nvidia-nim`      | `NVIDIA_API_KEY`, `MCP_GLOBAL_MODULES`          |
| `nvidia-security` | `NVIDIA_API_KEY`, `MCP_GLOBAL_MODULES`          |
| `playwright`      | none (runs via `npx -y @playwright/mcp@latest`) |

## 4. Smoke test

```bash
MCP_GLOBAL_MODULES="$(npm root -g)" NVIDIA_API_KEY=x node mcp-nvidia.mjs
```

Server should start on stdio with no module-resolution errors. Ctrl+C to stop.

## 5. Upgrading

```bash
npm update -g @modelcontextprotocol/sdk zod
```

No lockfile in this repo — global install is the source of truth.

## 6. Uninstall / clean

```bash
npm uninstall -g @modelcontextprotocol/sdk zod
```


