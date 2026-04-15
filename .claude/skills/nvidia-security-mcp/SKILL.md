---
name: nvidia-security-mcp
description: Delegate security, audit, safety-classification, PII-detection, and guardrail tasks to curated NVIDIA NIM models via the `nvidia-security` MCP server. Use for authorized pentest reasoning, code audits (CVE/OWASP/SAST triage), threat modeling, prompt-injection detection, LLM I/O moderation, PII scrubbing, compliance review. Requires `NVIDIA_API_KEY`.
---

# NVIDIA NIM Security MCP Orchestrator

Route **defensive** security and audit workloads to purpose-tuned NIM models. Low temperature (0.2) for deterministic, auditable output.

## Tools

- `mcp__nvidia-security__nvidia_security_list_models` — list curated security models.
- `mcp__nvidia-security__nvidia_security_chat` — args: `model` (alias or id), `messages`, `thinking`, `max_tokens`.

## Model routing

| Alias | Role | Use when |
|---|---|---|
| `deepseek-r1` (default) | audit-reasoner, CoT | Root-cause, threat modeling, exploit reasoning, code-audit narratives. Set `thinking: true`. |
| `nemotron-ultra` | audit-reasoner | Vulnerability analysis, secure-code review, compliance audits without verbose CoT. |
| `qwen3-coder` | code-auditor | SAST-style review, taint analysis, fix suggestions in diff form. |
| `devstral` | code-auditor | Repo-scale secure-code + dependency + IaC audits. |
| `llama-guard` | safety-classifier | Multimodal (text+image) jailbreak / prompt-injection / policy screen. |
| `nemotron-safety` | safety-classifier | LLM I/O moderation, harmful content gating. |
| `nemotron-safety-reason` | safety-classifier | Classification **with justification** (NeMo Guardrails). |
| `granite-guardian` | risk-classifier | Bias, harm, hallucination, jailbreak, function-call risk. |
| `shieldgemma` | risk-classifier | Harassment, dangerous content, sexual, hate. |
| `gliner-pii` | pii-detector | PII extraction / redaction (GDPR/HIPAA pre-processing). |

## Decision rules

- **Root-cause / threat model / exploit chain reasoning** → `deepseek-r1` + `thinking: true`.
- **Diff review for CVEs/OWASP** → `qwen3-coder` (small scope) or `devstral` (repo-scale).
- **Classify a single user prompt for jailbreak/injection** → `llama-guard` or `nemotron-safety`.
- **Need explanation with the label** → `nemotron-safety-reason`.
- **Redact PII before sending data to another model or log** → `gliner-pii` first, then route.
- **Enterprise risk scoring on LLM output** → `granite-guardian`.
- **Content-policy moderation** → `shieldgemma`.

## Pipeline patterns

**Pre-flight moderation + PII scrub**
1. `gliner-pii` → redact.
2. `llama-guard` or `nemotron-safety` → allow/deny.
3. On pass, route task to primary executor (Sonnet / NVIDIA NIM).

**Audit workflow**
1. `qwen3-coder` or `devstral` → produce finding list with line refs.
2. `deepseek-r1` (thinking on) → reason about severity + exploit path.
3. `nemotron-ultra` → synthesize executive summary.
4. Opus → final review & prioritization.

## Invocation

```
mcp__nvidia-security__nvidia_security_chat({
  model: "deepseek-r1",
  messages: [
    { role: "system", content: "Security auditor. Cite file:line. Output JSON findings." },
    { role: "user", content: "<diff>" }
  ],
  thinking: true,
  max_tokens: 8192
})
```

Reasoning arrives wrapped in `<thinking>…</thinking>`. Preserve for audit trail; don't strip.

## Scope and ethics

Authorized defensive / audit use only: pentest engagements with scope, CTFs, code review, guardrails, compliance, research. Refuse: mass targeting, detection-evasion for malicious actors, offensive payload crafting against third parties without authorization. When ambiguous, ask the user for authorization context before dispatching.

## Orchestration pattern

Opus plans → fan out independent audit chunks to security MCP models + Codex in parallel → `nemotron-ultra` or Opus synthesizes final report. Serialize only when a later stage depends on an earlier label (e.g., PII scrub before external send).

## Failure modes

- Missing `NVIDIA_API_KEY` → surface and stop.
- Classifier returns ambiguous label → escalate to `nemotron-safety-reason` for justification, or to Opus for judgment.
- 5xx → one retry, else fall back to `nvidia-nim-mcp` generalist model and note degradation.
