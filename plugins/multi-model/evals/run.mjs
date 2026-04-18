#!/usr/bin/env node
// Multi-model evals runner — SCAFFOLD.
// Phase 1C: stubs all model calls. Prints what WOULD be called, emits a JSONL report.
// Phase 2: replace `stubCall` with real MCP invocations (see TODO block below).

import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { scorers } from "./scorers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TASKS_DIR = join(__dirname, "tasks");
const RESULTS_DIR = join(__dirname, "results");

/* ============================================================
 * TODO (Phase 2) — replace stubCall with real MCP dispatch.
 * ============================================================
 * Each `route` is `<executor>:<model>`. Map them like so:
 *
 *   sonnet-native    → Claude Agent tool (subagent_type: "general-purpose", model: "sonnet")
 *   haiku-native     → Claude Agent tool (model: "haiku")
 *   ollama:<model>   → mcp__ollama__ollama_chat        { model, messages }
 *   nim:<model>      → mcp__nvidia-nim__nvidia_chat    { model, messages }
 *   nim-security:<m> → mcp__nvidia-security__nvidia_security_chat { model, messages }
 *   copilot:<model>  → mcp__copilot__copilot_chat      { model, messages }
 *
 * For MCP calls, spawn the MCP script via stdio or (preferred) run this harness
 * inside a Claude session where those MCP tools are already wired, and have
 * Claude invoke them. Simplest Phase 2 plan: emit a per-task prompt file and
 * a /multi-model:delegate command invocation that fills in real outputs.
 * ============================================================ */
async function stubCall(route, task) {
  return {
    route,
    task_id: task.id,
    stub: true,
    output: `STUB[${route}] would answer: ${task.prompt.slice(0, 60)}...`,
    latency_ms: 0,
  };
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

async function loadTasks() {
  const files = (await readdir(TASKS_DIR)).filter((f) => f.endsWith(".json")).sort();
  const tasks = [];
  for (const f of files) {
    const raw = await readFile(join(TASKS_DIR, f), "utf8");
    tasks.push(JSON.parse(raw));
  }
  return tasks;
}

function score(task, output) {
  const s = scorers[task.scorer];
  if (!s) return { score: 0.0, detail: `unknown scorer: ${task.scorer}` };
  return s(output, task.ground_truth);
}

async function main() {
  const tasks = await loadTasks();
  const totalRoutes = tasks.reduce((n, t) => n + (t.routes_to_test?.length || 0), 0);
  console.log(`Would run ${tasks.length} tasks across ${totalRoutes} routes — scaffolded, no real calls yet.`);

  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = join(RESULTS_DIR, `${timestamp()}.jsonl`);
  const lines = [];

  for (const task of tasks) {
    if (task.skip_if_no_image && task.category === "multimodal") {
      console.log(`  [skip] ${task.id} — no image fixture yet`);
      lines.push(JSON.stringify({ task_id: task.id, skipped: true, reason: "no_image_fixture" }));
      continue;
    }
    for (const route of task.routes_to_test || []) {
      const call = await stubCall(route, task);
      const scored = score(task, call.output);
      const row = {
        task_id: task.id,
        category: task.category,
        route,
        scorer: task.scorer,
        score: scored.score,
        detail: scored.detail,
        stub: true,
        latency_ms: call.latency_ms,
        timestamp: new Date().toISOString(),
      };
      lines.push(JSON.stringify(row));
      console.log(`  [stub] ${task.id} :: ${route} → score=${scored.score}`);
    }
  }

  await writeFile(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`\nWrote ${lines.length} rows → ${outPath}`);
}

main().catch((e) => {
  console.error("evals/run.mjs failed:", e);
  process.exit(1);
});
