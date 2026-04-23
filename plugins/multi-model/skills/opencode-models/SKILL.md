---
name: multi-model-opencode-models
description: Deep-dive on opencode CLI free-tier models. Invoke when routing to opencode, comparing it against Copilot (free vs. premium cross-vendor), picking a free-tier model for bulk / second-opinion / alt-frontier work, or answering questions about the opencode allowlist. Free — MCP enforces free-only, paid models rejected.
---

# opencode CLI — free-tier cross-vendor executor

**Tool**: `mcp__opencode__opencode_run`
**Slash**: `/multi-model:opencode`
**Auth**: `opencode providers login` (credentials cached locally — no API key env var)
**Install**: `npm install -g opencode-ai`
**Cost**: zero — MCP allowlist enforces free models only. Paid models return an error.

## The four allowed models

| Model | Best for | Trigger |
|---|---|---|
| `opencode/big-pickle` *(default — omit `model`)* | General-purpose workhorse, unknown-shape tasks | Default pick; first call when provider is "opencode" |
| `opencode/ling-2.6-flash-free` | Fast / bulk / simple (grep-like, short edits, summarize) | Task is shallow + needs volume |
| `opencode/nemotron-3-super-free` | Reasoning-heavy / chain-of-thought / hard logic | Task needs multi-step reasoning, not just pattern-matching |
| `opencode/minimax-m2.5-free` | Alt-frontier / second-opinion / disagreement probe | Want a different model family's read on a Sonnet/Copilot answer |

Full opencode catalog has paid tiers (Claude, GPT-5.x, Gemini-3, Kimi, Qwen, GLM, etc.) — **all blocked by this MCP** to prevent billing. `opencode_list_models` shows both the allowlist and the full reference list.

## When to pick opencode (vs. Copilot)

| Need | Pick |
|---|---|
| Cross-vendor comparison, user will run this many times | **opencode** (free) |
| Specifically need GPT-5.3-Codex or Gemini-3-Pro and user accepts premium cost | Copilot |
| Bulk second-opinion / disagreement check | **opencode** (free) |
| Quick one-off cross-vendor sanity check, no budget concern | Either — opencode still cheaper |
| User explicitly said "use copilot" | Copilot |

**Default rule**: if the task could work with opencode's free models, use opencode. Copilot costs 1 premium request per call.

## Invocation shape

```
mcp__opencode__opencode_run({
  prompt: "<task>",
  model: "opencode/big-pickle",        // optional; omit for default
  cwd: "<path>",                        // optional
  thinking: false,                      // set true for nemotron-3-super-free
  format: "default",                    // "json" when parsing structured output
  dangerouslySkipPermissions: true,     // default true for headless use
})
```

## Limits / gotchas

- `dangerouslySkipPermissions: true` by default — opencode will not refuse tool calls. Set to `false` when the prompt might trigger destructive shell actions.
- Windows: the MCP auto-detects `.cmd` / `.bat` wrappers and spawns with `shell: true`. No config needed.
- Timeout: 600s default (longer than Copilot/Gemini) — opencode runs its own agent loop internally.
- If the user asks for a paid opencode model, the MCP returns an error listing the allowlist. Fall back to Copilot or another provider.
- No drift check between allowlist and upstream — if opencode renames a free model, the allowlist needs a manual update in `scripts/mcp-opencode.mjs` (`OPENCODE_FREE_MODELS`).

## Anti-patterns

- Picking opencode when the task needs a *specific* premium model (e.g., GPT-5.3-Codex). Use Copilot instead.
- Picking Copilot when opencode's free tier would work. Burns a premium request for no reason.
- Setting `dangerouslySkipPermissions: false` for a read-only / context-gathering task — forces interactive prompts in a headless context.
