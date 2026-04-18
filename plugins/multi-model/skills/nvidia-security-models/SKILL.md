---
name: multi-model-nvidia-security-models
description: Deep dive on the 8 security/audit/guardrail models served by the `mcp__nvidia-security` MCP. Use for ANY security, audit, PII, safety-classification, prompt-injection, compliance, jailbreak-detection, CVE analysis, OWASP review, SAST triage, threat modeling, or LLM I/O moderation task. Auto-triggers when user mentions security, vulnerability, CVE, OWASP, SAST, PII, GDPR, HIPAA, guardrail, jailbreak, safety classifier. Requires `NVIDIA_API_KEY`.
---

# NVIDIA Security Models — `mcp__nvidia-security`

8 curated models for authorized pentest reasoning, code audits, safety classification, PII detection, and guardrails. Call via `mcp__nvidia-security__nvidia_security_chat` with the `model` alias below.

**Env**: `NVIDIA_API_KEY` (required).

**Source-of-truth**: `plugins/multi-model/scripts/mcp-security-nvidia.mjs` + `MODELS.md`.

## Model catalog (role-matched)

| Alias | Model ID | Role | Best for |
|---|---|---|---|
| `nemotron-ultra` | nvidia/llama-3.1-nemotron-ultra-253b-v1 | audit-reasoner | Vuln analysis, secure-code review, compliance audits, threat modeling |
| `qwen3-coder` | qwen/qwen3-coder-480b-a35b-instruct | code-auditor | SAST-style review, taint analysis, fix suggestions |
| `devstral` | mistralai/devstral-2-123b-instruct-2512 | code-auditor | Repo-scale secure review, dependency / IaC audits |
| `llama-guard` | meta/llama-guard-4-12b | safety-classifier | Multimodal (text+image) prompt-injection / jailbreak |
| `nemotron-safety` | nvidia/llama-3_1-nemotron-safety-guard-8b-v3 | safety-classifier | LLM I/O moderation, guardrails |
| `nemotron-safety-reason` | nvidia/nemotron-content-safety-reasoning-4b | safety-classifier | Reasoning-based safety with justification (NeMo) |
| `granite-guardian` | ibm/granite-guardian-3_0-8b | risk-classifier | Enterprise risk: bias/harm/hallucination/jailbreak |
| `gliner-pii` | nvidia/gliner-pii | pii-detector | PII detect/redact — GDPR/HIPAA pre-processing |

## Decision rules by task type

### Vulnerability analysis / threat modeling / compliance audit

- **`nemotron-ultra`** (audit-reasoner) — primary. Reasons about attack surface, impact, remediation.
- Combine with `qwen3-coder` for line-level code evidence.

### SAST / secure code review / taint analysis

- **`qwen3-coder`** (code-auditor) — file/function-scope review.
- **`devstral`** (code-auditor) — repo-scale, dependency/IaC audits.

### Prompt-injection / jailbreak detection

- **`llama-guard`** — multimodal (text+image). First choice for LLM I/O gates.
- **`nemotron-safety`** — lightweight 8B guard, LLM I/O moderation.
- **`nemotron-safety-reason`** — when you need a *justification* for the classification (NeMo reasoning).

### PII detect / redact (GDPR, HIPAA pre-processing)

- **`gliner-pii`** — only PII-specialized model. Use it for scrub pipelines.

### Risk classification (bias, harm, hallucination)

- **`granite-guardian`** — enterprise risk signals.

## Combining models (pipelines)

Common pipelines:

1. **Secure code review**: `qwen3-coder` → line-level findings → `nemotron-ultra` → impact + remediation.
2. **LLM output gate**: user input → `gliner-pii` (redact) → model call → `llama-guard` (classify output) → deliver or block.
3. **Compliance audit**: `devstral` → repo scan → `nemotron-ultra` → compliance report.

Dispatch pipeline steps as parallel `Agent` subagents when independent, serial when chained.

## Invocation pattern

```jsonc
// Via mcp__nvidia-security__nvidia_security_chat
{
  "model": "nemotron-ultra",
  "messages": [
    { "role": "system", "content": "You are a security auditor. Output findings as CWE-tagged JSON." },
    { "role": "user", "content": "<code or policy>" }
  ]
}
```

## Authorization check (before invoking)

These models support **authorized** security work: pentesting engagements, CTF competitions, defensive code review, compliance, LLM safety research. Do NOT use for: credential harvesting on targets you don't own, exploit weaponization for mass campaigns, detection evasion for malicious purposes.

If the context is unclear, ask the user for the authorization context before dispatching.

## Common pitfalls

- **`google/shieldgemma-9b` reached EOL 2026-04-15.** Use `llama-guard` (NIM) or `nemotron-safety` (security) instead.
- Using a NIM coding model instead of `nvidia-security` `qwen3-coder` — they're the same weights but the security MCP sets safer defaults.
- Skipping `gliner-pii` before shipping free-text to a general model in regulated domains (GDPR, HIPAA).
- Using `llama-guard` alone for full audit — it classifies, it doesn't reason about impact. Chain with `nemotron-ultra`.
- Picking `nemotron-safety` when you need *justifications* — use `nemotron-safety-reason` instead.
