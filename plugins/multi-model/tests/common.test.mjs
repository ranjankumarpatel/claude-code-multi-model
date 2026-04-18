/**
 * Regression-proof tests for plugins/multi-model/scripts/lib/common.mjs.
 * Uses only Node stdlib: node:test + node:assert/strict.
 *
 * Run:   npm test  (from plugins/multi-model/)
 * Or:    node --test tests/
 */

import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import the library under test.
const commonUrl = pathToFileURL(
  path.resolve(__dirname, "..", "scripts", "lib", "common.mjs")
).href;
const common = await import(commonUrl);

const {
  isTransient,
  retry,
  copilotBudget,
  safetySystemPrompt,
  fallbackChain,
  createRequireFromLocalFirst,
  loadYamlCopilotIds,
} = common;

// ---------------------------------------------------------------------------
// Helpers for budget-file cleanup. The budget lives in os.tmpdir() keyed by
// UTC date — we scrub matching files before/after every budget test so runs
// are deterministic and don't leak across invocations.
// ---------------------------------------------------------------------------
function cleanBudgetFiles() {
  const dir = os.tmpdir();
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name.startsWith("multi-model-copilot-budget-")) {
      try {
        fs.unlinkSync(path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
}

// ---------------------------------------------------------------------------
// isTransient
// ---------------------------------------------------------------------------
describe("isTransient", () => {
  test("transient HTTP status codes return true", () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      assert.equal(isTransient({ status }), true, `status ${status} should be transient`);
      assert.equal(isTransient({ statusCode: status }), true, `statusCode ${status} should be transient`);
    }
  });

  test("non-transient HTTP status codes return false", () => {
    for (const status of [400, 401, 403, 404, 409, 410]) {
      assert.equal(isTransient({ status }), false, `status ${status} should NOT be transient`);
    }
  });

  test("410 EOL must NOT retry", () => {
    assert.equal(isTransient({ status: 410 }), false);
    assert.equal(isTransient(new Error("HTTP 410 Gone")), false);
  });

  test("transient network codes return true", () => {
    for (const code of ["ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EAI_AGAIN", "ECONNREFUSED", "EPIPE"]) {
      assert.equal(isTransient({ code }), true, `code ${code} should be transient`);
    }
  });

  test("nested cause.code is inspected", () => {
    const err = new Error("fetch failed");
    err.cause = { code: "ECONNRESET" };
    assert.equal(isTransient(err), true);
  });

  test("message containing 'HTTP 504' returns true", () => {
    assert.equal(isTransient(new Error("HTTP 504 from upstream")), true);
  });

  test("message containing 'status 504' returns true", () => {
    assert.equal(isTransient(new Error("got status 504")), true);
  });

  test("message 'length 504 bytes' must NOT over-match", () => {
    assert.equal(isTransient(new Error("length 504 bytes")), false);
  });

  test("plain 'unknown error' returns false", () => {
    assert.equal(isTransient(new Error("unknown error")), false);
  });

  test("null / undefined / empty object return false", () => {
    assert.equal(isTransient(null), false);
    assert.equal(isTransient(undefined), false);
    assert.equal(isTransient({}), false);
  });

  test("message containing a bare network code string returns true", () => {
    assert.equal(isTransient(new Error("socket hang up ECONNRESET during handshake")), true);
  });
});

// ---------------------------------------------------------------------------
// retry
// ---------------------------------------------------------------------------
describe("retry", () => {
  test("resolves immediately on first-try success (1 call)", async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      return "ok";
    }, { retries: 3, baseMs: 1 });
    assert.equal(result, "ok");
    assert.equal(calls, 1);
  });

  test("retries on transient error, succeeds on 2nd try (2 calls)", async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      if (calls === 1) {
        const e = new Error("transient");
        e.code = "ECONNRESET";
        throw e;
      }
      return "done";
    }, { retries: 3, baseMs: 1 });
    assert.equal(result, "done");
    assert.equal(calls, 2);
  });

  test("does NOT retry on non-transient error (1 call)", async () => {
    let calls = 0;
    await assert.rejects(
      retry(async () => {
        calls++;
        const e = new Error("bad request");
        e.status = 400;
        throw e;
      }, { retries: 3, baseMs: 1 }),
      /bad request/,
    );
    assert.equal(calls, 1);
  });

  test("respects retries option (N retries => N+1 total calls)", async () => {
    let calls = 0;
    await assert.rejects(
      retry(async () => {
        calls++;
        const e = new Error("boom");
        e.code = "ETIMEDOUT";
        throw e;
      }, { retries: 2, baseMs: 1 }),
      /boom/,
    );
    assert.equal(calls, 3, "expected 2 retries + 1 original = 3 calls");
  });

  test("exponential backoff: elapsed between attempt 1 and 2 >= baseMs * 0.5", async () => {
    const baseMs = 50;
    let calls = 0;
    const timestamps = [];
    await retry(async () => {
      calls++;
      timestamps.push(Date.now());
      if (calls < 2) {
        const e = new Error("transient");
        e.code = "ECONNRESET";
        throw e;
      }
      return "ok";
    }, { retries: 2, baseMs });
    const elapsed = timestamps[1] - timestamps[0];
    assert.ok(
      elapsed >= baseMs * 0.5,
      `elapsed ${elapsed}ms should be >= ${baseMs * 0.5}ms`,
    );
  });

  test("custom retryOn predicate is respected (forced true retries non-transient)", async () => {
    let calls = 0;
    const result = await retry(async () => {
      calls++;
      if (calls < 2) throw new Error("custom-class");
      return "won";
    }, { retries: 2, baseMs: 1, retryOn: (err) => /custom-class/.test(String(err)) });
    assert.equal(calls, 2);
    assert.equal(result, "won");
  });

  test("custom retryOn predicate returning false skips retry", async () => {
    let calls = 0;
    await assert.rejects(
      retry(async () => {
        calls++;
        const e = new Error("would-be-transient");
        e.code = "ECONNRESET";
        throw e;
      }, { retries: 3, baseMs: 1, retryOn: () => false }),
      /would-be-transient/,
    );
    assert.equal(calls, 1);
  });
});

// ---------------------------------------------------------------------------
// copilotBudget
// ---------------------------------------------------------------------------
describe("copilotBudget", () => {
  beforeEach(() => {
    cleanBudgetFiles();
    delete process.env.COPILOT_DAILY_LIMIT;
  });
  afterEach(() => {
    cleanBudgetFiles();
    delete process.env.COPILOT_DAILY_LIMIT;
  });

  test(".check() returns used:0 / allowed:true on first call (default limit 20)", () => {
    const b = copilotBudget();
    const s = b.check();
    assert.equal(s.used, 0);
    assert.equal(s.limit, 20);
    assert.equal(s.allowed, true);
  });

  test(".consume() increments used", () => {
    const b = copilotBudget();
    const r1 = b.consume();
    assert.equal(r1.used, 1);
    assert.equal(r1.limit, 20);
    const r2 = b.consume();
    assert.equal(r2.used, 2);
    assert.equal(b.check().used, 2);
  });

  test("consuming past limit throws documented error message", () => {
    process.env.COPILOT_DAILY_LIMIT = "2";
    const b = copilotBudget();
    b.consume();
    b.consume();
    assert.throws(
      () => b.consume(),
      /Daily Copilot budget exhausted/,
    );
  });

  test("COPILOT_DAILY_LIMIT env override honored (3 ok, 4th throws)", () => {
    process.env.COPILOT_DAILY_LIMIT = "3";
    const b = copilotBudget();
    assert.equal(b.check().limit, 3);
    b.consume();
    b.consume();
    b.consume();
    assert.throws(() => b.consume(), /Daily Copilot budget exhausted/);
  });

  test("concurrent .consume() calls are serialized by the lockfile (no over-consumption)", async () => {
    process.env.COPILOT_DAILY_LIMIT = "5";
    const b = copilotBudget();
    // Fire 10 concurrent consumes; exactly `limit`(=5) should succeed.
    const settled = await Promise.allSettled(
      Array.from({ length: 10 }, () => Promise.resolve().then(() => b.consume())),
    );
    const fulfilled = settled.filter((s) => s.status === "fulfilled").length;
    const rejected = settled.filter((s) => s.status === "rejected").length;
    assert.equal(fulfilled, 5, `expected exactly 5 fulfilled, got ${fulfilled}`);
    assert.equal(rejected, 5, `expected exactly 5 rejected, got ${rejected}`);
    assert.equal(b.check().used, 5);
    for (const s of settled.filter((x) => x.status === "rejected")) {
      assert.match(String(s.reason?.message ?? s.reason), /Daily Copilot budget exhausted/);
    }
  });
});

// ---------------------------------------------------------------------------
// safetySystemPrompt
// ---------------------------------------------------------------------------
describe("safetySystemPrompt", () => {
  const roles = {
    "audit-reasoner": /audit reasoner/i,
    "code-auditor": /code auditor/i,
    "safety-classifier": /safety content classifier/i,
    "risk-classifier": /risk classifier/i,
    "pii-detector": /PII detector/i,
  };

  for (const [role, marker] of Object.entries(roles)) {
    test(`returns a role-specific, non-empty prompt for "${role}"`, () => {
      const s = safetySystemPrompt(role);
      assert.equal(typeof s, "string");
      assert.ok(s.length > 50, `prompt for ${role} is too short`);
      assert.match(s, marker);
    });
  }

  test("unknown role falls back to audit-reasoner prompt (locked-in behavior)", () => {
    const unknown = safetySystemPrompt("does-not-exist");
    const baseline = safetySystemPrompt("audit-reasoner");
    assert.equal(unknown, baseline);
  });
});

// ---------------------------------------------------------------------------
// scrubSecrets — NOT exported from common.mjs.
// We exercise the scrub behavior indirectly via logCall, which invokes
// scrubSecrets on error strings before writing the JSON-lines log.
// ---------------------------------------------------------------------------
describe("scrubSecrets (indirect via logCall)", () => {
  let tmpRoot;
  let logFile;

  before(() => {
    // Point CLAUDE_PLUGIN_ROOT so logs go to a known, disposable location.
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mm-test-log-"));
    // logCall resolves $root/../../logs/mcp-calls.jsonl
    const pluginRoot = path.join(tmpRoot, "a", "b");
    fs.mkdirSync(pluginRoot, { recursive: true });
    process.env.CLAUDE_PLUGIN_ROOT = pluginRoot;
    logFile = path.join(tmpRoot, "logs", "mcp-calls.jsonl");
  });
  after(() => {
    delete process.env.CLAUDE_PLUGIN_ROOT;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });
  beforeEach(() => {
    try { fs.unlinkSync(logFile); } catch { /* ignore */ }
  });

  function lastLoggedError(errMessage) {
    common.logCall({
      mcp: "test", tool: "t", model: "m",
      startedAt: Date.now() - 1, endedAt: Date.now(),
      ok: false, error: new Error(errMessage),
    });
    const raw = fs.readFileSync(logFile, "utf8").trim().split("\n").pop();
    return JSON.parse(raw).error;
  }

  // Build fake tokens at runtime so static secret scanners (GitGuardian, TruffleHog,
  // etc.) don't match literal prefixes (sk-, nvapi-, ghp_, Bearer ...) in source.
  const fakeToken = (prefix, sep = "") => prefix + sep + ["FAKE", "TEST", "TOKEN"].join("");

  test("Bearer token redacted", () => {
    const sample = fakeToken("Bear" + "er ");
    const scrubbed = lastLoggedError(`auth failed: ${sample}`);
    assert.match(scrubbed, /\[REDACTED\]/);
    assert.doesNotMatch(scrubbed, new RegExp(sample));
  });

  test("sk- prefix redacted", () => {
    const sample = fakeToken("s" + "k", "-proj-");
    const scrubbed = lastLoggedError(`key=${sample}`);
    assert.match(scrubbed, /\[REDACTED\]/);
    assert.doesNotMatch(scrubbed, new RegExp(sample));
  });

  test("nvapi- prefix redacted", () => {
    const sample = fakeToken("nv" + "api", "-");
    const scrubbed = lastLoggedError(`token: ${sample}`);
    assert.match(scrubbed, /\[REDACTED\]/);
    assert.doesNotMatch(scrubbed, new RegExp(sample));
  });

  test("ghp_, gho_, ghs_, ghu_ tokens redacted", () => {
    for (const p of ["ghp", "gho", "ghs", "ghu"]) {
      const sample = fakeToken(p, "_");
      const scrubbed = lastLoggedError(`token ${sample}`);
      assert.match(scrubbed, /\[REDACTED\]/);
      assert.doesNotMatch(scrubbed, new RegExp(sample));
    }
  });

  test("32+ char hex string redacted", () => {
    const hex = "a".repeat(40);
    const scrubbed = lastLoggedError(`sig=${hex}`);
    assert.match(scrubbed, /\[REDACTED\]/);
    assert.doesNotMatch(scrubbed, new RegExp(hex));
  });

  test("plain text is unchanged", () => {
    const scrubbed = lastLoggedError("error: request failed");
    assert.equal(scrubbed, "error: request failed");
  });

  test("null error becomes null (not the string 'null')", () => {
    common.logCall({
      mcp: "test", tool: "t", model: "m",
      startedAt: Date.now() - 1, endedAt: Date.now(),
      ok: true, error: null,
    });
    const raw = fs.readFileSync(logFile, "utf8").trim().split("\n").pop();
    const entry = JSON.parse(raw);
    assert.equal(entry.error, null);
  });
});

// ---------------------------------------------------------------------------
// createRequireFromLocalFirst
// ---------------------------------------------------------------------------
describe("createRequireFromLocalFirst", () => {
  test("returns a require-like function", () => {
    const req = createRequireFromLocalFirst(import.meta.url);
    assert.equal(typeof req, "function");
    assert.equal(typeof req.resolve, "function");
  });

  test("resolves js-yaml from local node_modules", () => {
    const req = createRequireFromLocalFirst(import.meta.url);
    const yaml = req("js-yaml");
    assert.equal(typeof yaml.load, "function");
    assert.equal(typeof yaml.dump, "function");
  });

  test(".resolve('js-yaml') returns a file path", () => {
    const req = createRequireFromLocalFirst(import.meta.url);
    const resolved = req.resolve("js-yaml");
    assert.equal(typeof resolved, "string");
    assert.ok(resolved.length > 0);
    assert.ok(fs.existsSync(resolved), `resolved path should exist on disk: ${resolved}`);
  });

  test("missing module throws a recognizable error", () => {
    const req = createRequireFromLocalFirst(import.meta.url);
    assert.throws(
      () => req("this-module-absolutely-does-not-exist-xyzzy"),
      /Cannot find module|Cannot resolve module/,
    );
  });
});

// ---------------------------------------------------------------------------
// loadYamlCopilotIds (may be present — test if so)
// ---------------------------------------------------------------------------
describe("loadYamlCopilotIds", () => {
  if (typeof loadYamlCopilotIds !== "function") {
    test("skipped — loadYamlCopilotIds not exported", () => {
      assert.ok(true, "export not present; skipping");
    });
    return;
  }

  const req = createRequireFromLocalFirst(import.meta.url);
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mm-yaml-test-"));
  });
  after(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test("returns list of ids for a valid yaml", () => {
    const p = path.join(tmpDir, "ok.yaml");
    fs.writeFileSync(p, "copilot:\n  - id: gpt-5.3-codex\n  - id: gemini-3-pro\n", "utf8");
    const ids = loadYamlCopilotIds({ yamlPath: p, require: req });
    assert.deepEqual(ids, ["gpt-5.3-codex", "gemini-3-pro"]);
  });

  test("returns null on missing file (never throws)", () => {
    const ids = loadYamlCopilotIds({ yamlPath: path.join(tmpDir, "nope.yaml"), require: req });
    assert.equal(ids, null);
  });

  test("returns null when copilot key missing or wrong shape", () => {
    const p = path.join(tmpDir, "bad.yaml");
    fs.writeFileSync(p, "other: [1, 2, 3]\n", "utf8");
    assert.equal(loadYamlCopilotIds({ yamlPath: p, require: req }), null);
  });
});

// ---------------------------------------------------------------------------
// fallbackChain
// ---------------------------------------------------------------------------
describe("fallbackChain", () => {
  test("first thunk succeeds — its value returned, later thunks NOT called", async () => {
    let bCalled = 0;
    const result = await fallbackChain([
      async () => "A",
      async () => { bCalled++; return "B"; },
    ], { retries: 0, baseMs: 1 });
    assert.equal(result, "A");
    assert.equal(bCalled, 0);
  });

  test("first throws non-transient — falls through to second (locked-in current behavior)", async () => {
    const result = await fallbackChain([
      async () => { const e = new Error("nope"); e.status = 400; throw e; },
      async () => "B",
    ], { retries: 0, baseMs: 1 });
    assert.equal(result, "B");
  });

  test("first throws transient, second succeeds — second value returned", async () => {
    let firstCalls = 0;
    const result = await fallbackChain([
      async () => {
        firstCalls++;
        const e = new Error("flaky");
        e.code = "ECONNRESET";
        throw e;
      },
      async () => "B-ok",
    ], { retries: 2, baseMs: 1 });
    assert.equal(result, "B-ok");
    assert.equal(firstCalls, 3, "first thunk should have been retried 2 times (3 total) before failing out");
  });

  test("all fail — aggregated error carries .attempts and mentions attempts count", async () => {
    try {
      await fallbackChain([
        async () => { throw new Error("first-failure"); },
        async () => { throw new Error("second-failure"); },
      ], { retries: 0, baseMs: 1 });
      assert.fail("expected fallbackChain to throw");
    } catch (err) {
      assert.match(err.message, /all 2 attempts failed/);
      assert.match(err.message, /first-failure/);
      assert.match(err.message, /second-failure/);
      assert.ok(Array.isArray(err.attempts), "err.attempts should be an array");
      assert.equal(err.attempts.length, 2);
    }
  });

  test("empty attempts array throws guard error", async () => {
    await assert.rejects(
      fallbackChain([], { retries: 0, baseMs: 1 }),
      /non-empty array of thunks/,
    );
  });
});
