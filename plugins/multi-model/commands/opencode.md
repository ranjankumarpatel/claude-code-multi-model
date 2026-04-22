---
description: Delegate a prompt to the opencode CLI (cross-vendor model picker)
argument-hint: '[--model provider/model] [--agent <name>] [--variant <high|max|minimal>] [--cwd <path>] <prompt>'
allowed-tools: mcp__opencode__opencode_run, mcp__opencode__opencode_list_models
---

Delegate to opencode. Raw args: `$ARGUMENTS`

## About opencode

Cross-vendor executor (https://opencode.ai). Routes the prompt through whichever provider the user has authenticated via `opencode providers login`. Large model catalog including Claude, GPT-5.x, Gemini 3.x, Kimi, Qwen, GLM, Nemotron, MiniMax.

Install: `npm install -g opencode-ai`. Auth: `opencode providers login`.

## Free models only (format `provider/model`)

This integration restricts routing to opencode's free tier — no billing, no premium-request cost:

- `opencode/big-pickle` — default free workhorse
- `opencode/ling-2.6-flash-free` — fast free-tier
- `opencode/minimax-m2.5-free` — alt-frontier free
- `opencode/nemotron-3-super-free` — reasoning-heavy free-tier

Paid models exist in `opencode models` output but are intentionally not routed here. If the user asks for a paid opencode model, confirm first. Full list: `mcp__opencode__opencode_list_models`.

## Invoke

Parse `$ARGUMENTS` for optional `--model <id>`, `--agent <name>`, `--variant <level>`, `--cwd <path>`. Remainder is the prompt.

```
mcp__opencode__opencode_run({
  prompt: "<extracted prompt>",
  model: "<provider/model if --model given>",
  agent: "<name if --agent given>",
  variant: "<level if --variant given>",
  cwd: "<path if --cwd given>"
})
```

Show response verbatim.

## Routing tips (free tier)

- Default pick: `opencode/big-pickle` — general-purpose free workhorse.
- Fast / bulk / simple: `opencode/ling-2.6-flash-free`.
- Reasoning-heavy / chain-of-thought: `opencode/nemotron-3-super-free`.
- Second opinion / alt-frontier: `opencode/minimax-m2.5-free`.
- Free tier makes this the cheapest cross-vendor option — prefer over Copilot for repeat comparisons.
