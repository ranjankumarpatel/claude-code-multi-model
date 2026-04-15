---
name: nvidia-nim-mcp
description: Delegate tasks to NVIDIA NIM frontier models via the `nvidia-nim` MCP server. Use when user says "nvidia", "nemotron", "qwen", "devstral", "deepseek", "llama 405", "mistral large", or needs frontier-quality outside Anthropic — large-scale code gen, deep reasoning with thinking mode, multimodal, or long-context agentic coding. Requires `NVIDIA_API_KEY`.
---

# NVIDIA NIM MCP Orchestrator

Route general-purpose, coding, reasoning, and multimodal tasks to NVIDIA NIM.

## Tools

- `mcp__nvidia-nim__nvidia_list_models` — enumerate models.
- `mcp__nvidia-nim__nvidia_chat` — send messages. Args: `model` (id or alias), `messages`, `thinking` (bool), `max_tokens`.

## Model routing

| Alias | ID | Role | Thinking | Use when |
|---|---|---|---|---|
| `qwen3-coder` | `qwen/qwen3-coder-480b-a35b-instruct` | agentic coder | no | Default for code. Repo-scale edits, tool-use coding, SAST-style review. |
| `devstral` | `mistralai/devstral-2-123b-instruct-2512` | SWE agent | no | Heavy refactors, multi-file engineering. |
| `kimi-k2-coder` | `moonshotai/kimi-k2-instruct-0905` | long-ctx coder | no | Large repo context + tool calls. |
| `deepseek-coder` | `deepseek-ai/deepseek-v3_1-terminus` | coder + logic | no | Strong coding, math, tool-calling. |
| `nemotron-ultra` | `nvidia/llama-3.1-nemotron-ultra-253b-v1` | flagship reasoner | no | Best reasoning + coding + instruction following. |
| `nemotron-super` | `nvidia/llama-3.3-nemotron-super-49b-v1` | balanced | no | Speed/quality tradeoff, strong coding. |
| `gemma4` | `google/gemma-4-31b-it` | multimodal | **yes** | Vision + thinking mode. |
| `deepseek-r1` | `deepseek-ai/deepseek-r1` | CoT reasoner | **yes** | Extended chain-of-thought, hard problems. |
| `llama405b` | `meta/llama-3.1-405b-instruct` | generalist | no | Large general purpose, big context. |
| `mistral-large` | `mistralai/mistral-large-2-instruct` | multilingual | no | Multilingual tasks, coding. |
| `granite-guardian` | `ibm/granite-guardian-3_0-8b` | risk classifier | no | Bias/harm/hallucination/jailbreak scoring. |
| `shieldgemma` | `google/shieldgemma-9b` | safety classifier | no | Policy-driven content moderation. |

## Decision rules

- **Code tasks** → `qwen3-coder` (default). Very large repo? `devstral` or `kimi-k2-coder`.
- **Pure reasoning / planning** → `nemotron-ultra` (no CoT) or `deepseek-r1` with `thinking: true` (verbose CoT).
- **Vision / image input** → `gemma4` with `thinking: true`.
- **Balanced latency** → `nemotron-super`.
- **Safety/risk scoring** → `granite-guardian` or `shieldgemma`. For deep audit workflow, prefer the `nvidia-security-mcp` skill instead.
- **Second frontier opinion on Anthropic output** → `nemotron-ultra`.

## Invocation pattern

```
mcp__nvidia-nim__nvidia_chat({
  model: "qwen3-coder",
  messages: [
    { role: "system", content: "Senior engineer. Output unified diff." },
    { role: "user", content: "<task>" }
  ],
  max_tokens: 4096
})
```

Enable `thinking: true` only for `gemma4` and `deepseek-r1` — other models ignore it. Reasoning returned wrapped in `<thinking>…</thinking>`; show separately from answer.

## Orchestration pattern

Opus plans → fan out independent chunks to NVIDIA + Sonnet/Haiku/Ollama/Codex in one message (parallel `Agent` / MCP calls) → Codex reviews diffs → Opus synthesizes. Only serialize when outputs feed each other.

## Cost / quota

Large models (`llama405b`, `nemotron-ultra`, `qwen3-coder-480b`) are expensive. For bulk simple work use Haiku locally. Reserve NVIDIA for frontier quality or alternative-architecture opinions.

## Failure modes

- Missing `NVIDIA_API_KEY` → surface to user, don't retry.
- 4xx with message → relay verbatim; usually bad model id or malformed messages.
- 5xx / timeout → one retry, else fall back to Sonnet.
