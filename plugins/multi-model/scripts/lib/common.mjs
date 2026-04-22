/**
 * Shared helpers for multi-model MCP scripts.
 * Zero third-party deps beyond Node stdlib.
 *
 * Exports:
 *   - createRequireFromLocalFirst(importMetaUrl)
 *   - loadYamlCopilotIds({ yamlPath, require })
 *   - retry(fn, opts)
 *   - isTransient(err)
 *   - logCall(entry)
 *   - copilotBudget(opts)
 *   - safetySystemPrompt(role)
 *   - fallbackChain(attempts)
 */

import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

// ---------------------------------------------------------------------------
// Require resolution: try local node_modules next to the caller first,
// then MCP_GLOBAL_MODULES env, then the caller's own import.meta.url.
// ---------------------------------------------------------------------------
export function createRequireFromLocalFirst(importMetaUrl) {
  // Candidate list of base URLs where `require` will attempt to resolve from.
  const candidates = [];

  // 1. Local node_modules relative to the caller script (../node_modules/).
  try {
    const callerPath = fileURLToPath(importMetaUrl);
    const callerDir = path.dirname(callerPath);
    // "../node_modules/" relative to the caller file.
    const localNM = path.resolve(callerDir, "..", "node_modules");
    if (fs.existsSync(localNM)) {
      // createRequire accepts a directory (as a file:// URL pointing *into* it).
      // Use a marker file path inside node_modules so createRequire resolves
      // against that directory.
      candidates.push(pathToFileURL(path.join(localNM, "noop.js")).href);
    }
    // Also try sibling node_modules at the caller's own directory.
    const siblingNM = path.resolve(callerDir, "node_modules");
    if (fs.existsSync(siblingNM)) {
      candidates.push(pathToFileURL(path.join(siblingNM, "noop.js")).href);
    }
  } catch (_) {
    // ignore — fall through to other candidates
  }

  // 2. MCP_GLOBAL_MODULES env var (directory of global modules).
  if (process.env.MCP_GLOBAL_MODULES) {
    const globalDir = process.env.MCP_GLOBAL_MODULES.replaceAll("\\", "/");
    candidates.push(`file:///${globalDir}/noop.js`);
  }

  // 3. Caller's own import.meta.url (last resort).
  candidates.push(importMetaUrl);

  const requires = candidates.map((c) => {
    try {
      return createRequire(c);
    } catch {
      return null;
    }
  }).filter(Boolean);

  // Composite require: try each in order.
  function compositeRequire(id) {
    let lastErr;
    for (const r of requires) {
      try {
        return r(id);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error(`Cannot resolve module '${id}' from any candidate path`);
  }

  // Preserve .resolve for compatibility (uses first successful resolver).
  compositeRequire.resolve = (id) => {
    let lastErr;
    for (const r of requires) {
      try {
        return r.resolve(id);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error(`Cannot resolve module '${id}'`);
  };

  return compositeRequire;
}

// ---------------------------------------------------------------------------
// loadYamlModelIds() — read models.yaml and extract model ids for any key.
// Returns string[] on success, null on any failure. Must never throw.
// ---------------------------------------------------------------------------
export function loadYamlModelIds({ yamlPath, require, key }) {
  try {
    const yaml = require("js-yaml");
    const fsMod = require("node:fs");
    const raw = fsMod.readFileSync(yamlPath, "utf8");
    const doc = yaml.load(raw);
    const list = doc?.[key];
    if (!Array.isArray(list)) return null;
    return list
      .filter((e) => e && typeof e.id === "string")
      .map((e) => e.id);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// loadYamlCopilotIds() — thin wrapper for backward compatibility.
// ---------------------------------------------------------------------------
export function loadYamlCopilotIds({ yamlPath, require }) {
  return loadYamlModelIds({ yamlPath, require, key: "copilot" });
}

// ---------------------------------------------------------------------------
// Transient error detection (HTTP + network).
// ---------------------------------------------------------------------------
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_NET_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
]);

export function isTransient(err) {
  if (!err) return false;

  // Direct status field (e.g. { status: 503 } style).
  if (typeof err.status === "number" && TRANSIENT_STATUSES.has(err.status)) return true;
  if (typeof err.statusCode === "number" && TRANSIENT_STATUSES.has(err.statusCode)) return true;

  // Node net/DNS error codes.
  if (err.code && TRANSIENT_NET_CODES.has(err.code)) return true;
  if (err.cause && err.cause.code && TRANSIENT_NET_CODES.has(err.cause.code)) return true;

  // Parse "XXX" out of the error message (we often throw `Error ${status}: …`).
  // Require "status" / "code" / "http" context near the code so literal strings
  // like "length 504 bytes" don't trigger a spurious retry.
  const msg = String(err.message ?? err);
  const m = msg.match(/(?:\b(?:status|code|http|http\/[0-9.]+)\b[^0-9]{0,8})(408|425|429|500|502|503|504)\b/i);
  if (m) return true;

  // Named network conditions.
  for (const code of TRANSIENT_NET_CODES) {
    if (msg.includes(code)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// retry() — async exponential backoff with jitter.
// ---------------------------------------------------------------------------
export async function retry(fn, opts = {}) {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 500;
  const retryOn = opts.retryOn ?? ((err) => isTransient(err));

  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !retryOn(err)) throw err;
      const backoff = baseMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseMs;
      await new Promise((res) => setTimeout(res, backoff + jitter));
      attempt++;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// logCall() — best-effort JSON-lines log. Never throws.
// ---------------------------------------------------------------------------
function resolveLogPath() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root) {
    // $CLAUDE_PLUGIN_ROOT/../../logs/mcp-calls.jsonl
    const logsDir = path.resolve(root, "..", "..", "logs");
    try {
      fs.mkdirSync(logsDir, { recursive: true });
      return path.join(logsDir, "mcp-calls.jsonl");
    } catch (_) {
      // fall through to tmpdir fallback
    }
  }
  return path.join(os.tmpdir(), "multi-model-mcp-calls.jsonl");
}

function scrubSecrets(s) {
  if (s == null) return s;
  let out = String(s);
  // Bearer tokens and common API key prefixes.
  out = out.replace(/Bearer\s+\S+/gi, "[REDACTED]");
  out = out.replace(/sk-\S+/g, "[REDACTED]");
  out = out.replace(/nvapi-\S+/g, "[REDACTED]");
  out = out.replace(/ghp_\S+/g, "[REDACTED]");
  out = out.replace(/gho_\S+/g, "[REDACTED]");
  out = out.replace(/ghs_\S+/g, "[REDACTED]");
  out = out.replace(/ghu_\S+/g, "[REDACTED]");
  out = out.replace(/AIzaSy[A-Za-z0-9_-]{30,}/g, "[REDACTED]");
  // Long hex blobs (32+ chars) — likely signatures/tokens.
  out = out.replace(/[a-f0-9]{32,}/gi, "[REDACTED]");
  return out;
}

export function logCall(entry) {
  try {
    const {
      mcp,
      tool,
      model,
      startedAt,
      endedAt,
      ok,
      error,
      tokensIn,
      tokensOut,
    } = entry ?? {};

    const ts = new Date().toISOString();
    const start = startedAt ? Number(startedAt) : null;
    const end = endedAt ? Number(endedAt) : Date.now();
    const latency_ms = start != null ? Math.max(0, end - start) : null;

    const rawError = error == null ? null : String(error.message ?? error);
    const safeError = rawError == null ? null : scrubSecrets(rawError);

    const line = JSON.stringify({
      ts,
      mcp: mcp ?? null,
      tool: tool ?? null,
      model: model ?? null,
      latency_ms,
      ok: ok === true,
      error: safeError,
      tokens_in: tokensIn ?? null,
      tokens_out: tokensOut ?? null,
    }) + "\n";

    const file = resolveLogPath();
    fs.appendFileSync(file, line, { encoding: "utf8" });
  } catch (_) {
    // Swallow all errors — logging must never break the MCP tool.
  }
}

// ---------------------------------------------------------------------------
// copilotBudget() — per-day persistent counter for premium copilot calls.
// ---------------------------------------------------------------------------
function todayKey() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function budgetFile() {
  return path.join(os.tmpdir(), `multi-model-copilot-budget-${todayKey()}.json`);
}

function readBudget() {
  const file = budgetFile();
  try {
    const raw = fs.readFileSync(file, "utf8");
    const j = JSON.parse(raw);
    if (j && typeof j.used === "number") return { file, used: j.used };
  } catch (_) {
    // fresh day / missing / corrupt — start at 0
  }
  return { file, used: 0 };
}

function writeBudget(file, used) {
  try {
    fs.writeFileSync(file, JSON.stringify({ used, date: todayKey() }), "utf8");
  } catch (_) {
    // best-effort — failing to persist shouldn't break the request
  }
}

// Cross-process lockfile using O_EXCL create/unlink. Busy-waits while held;
// acceptable because these paths are CLI-only and rarely contended.
function withLock(lockPath, fn, { maxMs = 2000, stepMs = 25 } = {}) {
  const deadline = Date.now() + maxMs;
  let fd;
  while (true) {
    try {
      fd = fs.openSync(lockPath, "wx"); // O_EXCL — fails if file already exists
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      if (Date.now() > deadline) throw new Error(`lock timeout: ${lockPath}`);
      // busy-wait; acceptable because this is a rare CLI
      const end = Date.now() + stepMs;
      while (Date.now() < end) { /* spin */ }
    }
  }
  try {
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(lockPath); } catch {}
  }
}

export function copilotBudget(opts = {}) {
  const dailyLimitEnv = opts.dailyLimitEnv ?? "COPILOT_DAILY_LIMIT";
  const defaultLimit = opts.defaultLimit ?? 20;
  const envVal = process.env[dailyLimitEnv];
  const parsed = envVal != null ? parseInt(envVal, 10) : NaN;
  const limit = Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultLimit;

  return {
    check() {
      const { used } = readBudget();
      return { used, limit, allowed: used < limit };
    },
    consume() {
      const statePath = budgetFile();
      return withLock(`${statePath}.lock`, () => {
        const { file, used } = readBudget();
        if (used >= limit) {
          throw new Error(
            `Daily Copilot budget exhausted: used ${used}/${limit}. ` +
            `Set ${dailyLimitEnv} to adjust.`
          );
        }
        writeBudget(file, used + 1);
        return { used: used + 1, limit };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// safetySystemPrompt() — per-role prompts + output schema guidance.
// ---------------------------------------------------------------------------
const SAFETY_PROMPTS = {
  "audit-reasoner":
    [
      "You are a security audit reasoner. Perform rigorous vulnerability analysis,",
      "threat modeling, and compliance review on the provided artifact.",
      "Cite standards where relevant (OWASP Top 10, CWE, NIST, STRIDE).",
      "Be precise, auditable, and conservative — do not speculate beyond evidence.",
      "Return a JSON object:",
      '  {"summary": "<one paragraph>",',
      '   "findings": [{"title": "...", "severity": "info|low|medium|high|critical",',
      '                 "standard": "CWE-XXX|OWASP-AYY|NIST-...",',
      '                 "evidence": "...", "recommendation": "..."}],',
      '   "assumptions": ["..."], "confidence": "low|medium|high"}',
    ].join("\n"),

  "code-auditor":
    [
      "You are a static-analysis code auditor. Review the provided code for security",
      "vulnerabilities, insecure patterns, and missing defenses.",
      "Focus on: injection, auth/authz gaps, crypto misuse, secrets, unsafe deserialization,",
      "path traversal, SSRF, TOCTOU, and dependency risk. Tag every issue with a CWE ID.",
      "Return a JSON array of findings:",
      '  [{"file": "...", "line": <int|null>,',
      '    "cwe": "CWE-XXX", "owasp": "A0X:YYYY|null",',
      '    "severity": "info|low|medium|high|critical",',
      '    "description": "...", "fix": "concrete patch suggestion"}]',
      "If no issues found, return an empty array [].",
    ].join("\n"),

  "safety-classifier":
    [
      "You are a safety content classifier. Evaluate the provided text against",
      "harm categories: harassment, hate, sexual, self-harm, violence, dangerous-content,",
      "prompt-injection, jailbreak, policy-violation.",
      "Be conservative: label only when clearly warranted. Provide justification.",
      "Return a JSON object:",
      '  {"label": "safe|unsafe",',
      '   "categories": ["<category>", ...],',
      '   "severity": "none|low|medium|high",',
      '   "justification": "<one or two sentences>",',
      '   "confidence": <0..1>}',
    ].join("\n"),

  "risk-classifier":
    [
      "You are an enterprise risk classifier. Score the provided input/output for",
      "risk dimensions: bias, harm, hallucination, jailbreak, function-call-risk,",
      "prompt-injection, data-exfiltration, policy-violation.",
      "Be objective and auditable; cite the specific signal that triggered each score.",
      "Return a JSON object:",
      '  {"risks": {"bias": {"score": <0..1>, "signal": "..."},',
      '             "harm": {...}, "hallucination": {...},',
      '             "jailbreak": {...}, "function_call_risk": {...}},',
      '   "overall": "low|medium|high|critical",',
      '   "justification": "..."}',
    ].join("\n"),

  "pii-detector":
    [
      "You are a PII detector. Scan the provided text for personally identifiable",
      "information (GDPR/HIPAA-relevant). Types: name, email, phone, address, ssn,",
      "national-id, credit-card, iban, dob, ip, geo, medical, credentials.",
      "Do NOT paraphrase the text; only report spans and labels exactly.",
      "Return a JSON object:",
      '  {"spans": [{"start": <int>, "end": <int>,',
      '              "text": "<matched substring>",',
      '              "label": "<type>", "confidence": <0..1>}],',
      '   "redacted": "<input with spans replaced by [LABEL]>"}',
      "If no PII found, return {\"spans\": [], \"redacted\": \"<input unchanged>\"}.",
    ].join("\n"),
};

export function safetySystemPrompt(role) {
  return SAFETY_PROMPTS[role] ?? SAFETY_PROMPTS["audit-reasoner"];
}

// ---------------------------------------------------------------------------
// fallbackChain() — try attempts in order, each wrapped with retry().
// ---------------------------------------------------------------------------
export async function fallbackChain(attempts, retryOpts = {}) {
  if (!Array.isArray(attempts) || attempts.length === 0) {
    throw new Error("fallbackChain: attempts must be a non-empty array of thunks");
  }
  const errors = [];
  for (let i = 0; i < attempts.length; i++) {
    const thunk = attempts[i];
    try {
      return await retry(thunk, retryOpts);
    } catch (err) {
      errors.push({ index: i, error: err });
    }
  }
  const summary = errors
    .map((e) => `  [${e.index}] ${e.error?.message ?? e.error}`)
    .join("\n");
  const agg = new Error(
    `fallbackChain: all ${attempts.length} attempts failed:\n${summary}`
  );
  agg.attempts = errors;
  throw agg;
}
