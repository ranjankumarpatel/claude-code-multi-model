# Models

All models served by MCPs in `plugins/multi-model/scripts/`. Source-of-truth: the `.mjs` scripts, not the live MCP runtime (may be stale until reconnected).

## `mcp__ollama` — 15 cloud models

Source: [mcp-ollama.mjs](plugins/multi-model/scripts/mcp-ollama.mjs)

| Model | Provider | Params | Ctx | Why use |
|---|---|---|---|---|
| `gemma4:31b-cloud` | Google | 31B | 256K | Frontier-level, multimodal, coding+reasoning |
| `kimi-k2.5:cloud` | Moonshot | MoE | 256K | Native multimodal, vision+language, agentic |
| `kimi-k2-thinking:cloud` | Moonshot | MoE | 256K | Extended thinking / chain-of-thought |
| `deepseek-v3.2:cloud` | DeepSeek | MoE | 160K | Efficient reasoning + agentic coding |
| `devstral-2:123b-cloud` | Mistral | 123B | 256K | Repo-level edits, tool calling, agentic |
| `devstral-small-2:24b-cloud` | Mistral | 24B | 256K | Lightweight agentic coding w/ tool use |
| `glm-4.6:cloud` | Z.ai | MoE | 198K | Agentic + reasoning + coding |
| `glm-5.1:cloud` | Z.ai | MoE | 198K | Frontier agentic, SWE-Bench Pro SOTA |
| `gpt-oss:120b-cloud` | OpenAI | 120B | 256K | Open-weight reasoning + agentic |
| `kimi-k2:1t-cloud` | Moonshot | 1T | 256K | MoE coding agent, tool calling |
| `minimax-m2:cloud` | MiniMax | MoE | 200K | High-efficiency coding + agentic |
| `mistral-large-3:675b-cloud` | Mistral | 675B | 256K | Multimodal MoE, vision+tools, production |
| `nemotron-3-super:cloud` | NVIDIA | 120B | 128K | NVIDIA 120B MoE agentic, strong tool use |
| `qwen3-coder-next:cloud` | Alibaba | MoE | 256K | Agentic coding, local-dev focus |
| `qwen3-coder:480b-cloud` | Alibaba | 480B | 256K | Long-context coding + agentic, 480B |

## `mcp__nvidia-nim` — 11 models

Source: [mcp-nvidia.mjs](plugins/multi-model/scripts/mcp-nvidia.mjs). Note: `deepseek-r1` removed (EOL 2026-01-26).

| Alias | Model ID | Think | Why use |
|---|---|---|---|
| `qwen3-coder` | qwen/qwen3-coder-480b-a35b-instruct | no | Best agentic coding — 480B MoE, repo-level edits. **Default for code** |
| `devstral` | mistralai/devstral-2-123b-instruct-2512 | no | Heavy SWE agent, repo-scale refactor |
| `kimi-k2-coder` | moonshotai/kimi-k2-instruct-0905 | no | Long-ctx coding + agentic tool calling |
| `deepseek-coder` | deepseek-ai/deepseek-v3_1-terminus | no | Coding + tool-calling, math/logic |
| `nemotron-ultra` | nvidia/llama-3.1-nemotron-ultra-253b-v1 | no | NVIDIA flagship — best reasoning, coding |
| `nemotron-super` | nvidia/llama-3.3-nemotron-super-49b-v1 | no | Balanced reasoning + speed |
| `gemma4` | google/gemma-4-31b-it | yes | Multimodal (vision) + thinking mode |
| `llama405b` | meta/llama-3.1-405b-instruct | no | Meta 405B general purpose, large ctx (may 404 per-tier) |
| `mistral-large` | mistralai/mistral-large-2-instruct | no | Multilingual, coding, instruction |
| `granite-guardian` | ibm/granite-guardian-3_0-8b | no | Risk/guardrail: bias, harm, hallucination, jailbreak |
| `shieldgemma` | google/shieldgemma-9b | no | Policy safety: harassment, dangerous, hate |

## `mcp__nvidia-security` — 9 models

Source: [mcp-security-nvidia.mjs](plugins/multi-model/scripts/mcp-security-nvidia.mjs). `deepseek-r1` removed (EOL).

| Alias | Model ID | Role | Why use |
|---|---|---|---|
| `nemotron-ultra` | nvidia/llama-3.1-nemotron-ultra-253b-v1 | audit-reasoner | Vuln analysis, secure-code review, compliance audits |
| `qwen3-coder` | qwen/qwen3-coder-480b-a35b-instruct | code-auditor | SAST-style review, taint analysis, fix suggestions |
| `devstral` | mistralai/devstral-2-123b-instruct-2512 | code-auditor | Repo-scale secure review, dep / IaC audits |
| `llama-guard` | meta/llama-guard-4-12b | safety-classifier | Multimodal (text+image) prompt-injection/jailbreak |
| `nemotron-safety` | nvidia/llama-3_1-nemotron-safety-guard-8b-v3 | safety-classifier | LLM I/O moderation, guardrails |
| `nemotron-safety-reason` | nvidia/nemotron-content-safety-reasoning-4b | safety-classifier | Reasoning-based safety w/ justification (NeMo) |
| `granite-guardian` | ibm/granite-guardian-3_0-8b | risk-classifier | Enterprise risk: bias/harm/hallucination/jailbreak |
| `shieldgemma` | google/shieldgemma-9b | risk-classifier | Policy safety: harassment, dangerous, sexual, hate |
| `gliner-pii` | nvidia/gliner-pii | pii-detector | PII detect/redact — GDPR/HIPAA pre-processing |

## `mcp__copilot` — 6 models

Source: [mcp-copilot.mjs](plugins/multi-model/scripts/mcp-copilot.mjs)

| Model | Vendor | Why use |
|---|---|---|
| `claude-opus-4.6` | Anthropic | Planning, architecture, complex reasoning |
| `claude-sonnet-4.6` | Anthropic | Balanced coding + reasoning |
| `claude-haiku-4.5` | Anthropic | Fast, lightweight |
| `gpt-5.3-codex` | OpenAI | Code generation + completion |
| `gemini-3-pro` | Google | Multimodal, long-ctx |
| `gpt-5` | OpenAI | General-purpose frontier |

---

**Total: 41 models across 4 MCPs** (15 Ollama + 11 NIM + 9 Security + 6 Copilot).

## Routing cheat-sheet

- Code gen / refactor → NIM `qwen3-coder`, Copilot `gpt-5.3-codex`, Ollama `qwen3-coder:480b-cloud` / `glm-5.1:cloud`
- Deep reasoning → Ollama `kimi-k2-thinking:cloud`, NIM `nemotron-ultra`, Ollama `gpt-oss:120b-cloud`
- Multimodal / vision → NIM `gemma4` (thinking), Ollama `kimi-k2.5:cloud` / `mistral-large-3:675b-cloud`, Copilot `gemini-3-pro`
- Long context → NIM `llama405b`, most Ollama (256K), Copilot `gemini-3-pro`
- Agentic coding → Ollama `glm-5.1:cloud`, `kimi-k2:1t-cloud`, `devstral-2:123b-cloud`, `minimax-m2:cloud`
- Security audit → `nvidia-security` role-matched
- PII scrub → `gliner-pii`
- Safety / guardrails → `llama-guard`, `shieldgemma`, `granite-guardian`
- Bulk / simple → Haiku, `devstral-small-2:24b-cloud`
- Second opinion → Copilot cross-vendor models
