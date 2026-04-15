---
description: Security audit / PII / guardrail task via NVIDIA Security NIM
argument-hint: '<prompt or diff>'
---

Route security-sensitive task to `mcp__nvidia-security__nvidia_security_chat`.

Use for: authorized pentest reasoning, CVE/OWASP/SAST triage, threat modeling, prompt-injection detection, LLM I/O moderation, PII scrubbing, compliance review.

Input: `$ARGUMENTS`

Call the MCP tool with an appropriate security-curated model. Report findings with severity + remediation.
