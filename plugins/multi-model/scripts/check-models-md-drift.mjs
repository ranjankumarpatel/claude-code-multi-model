#!/usr/bin/env node
/**
 * Drift check: MODELS.md vs. models.yaml (the canonical source).
 *
 * For each provider key in models.yaml, extract every model id from both the
 * YAML and the MODELS.md table, then diff. Exits 0 on match, 1 on drift.
 *
 * Run via: npm run check-models-md-drift
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import fs from "node:fs";
import { createRequireFromLocalFirst, loadYamlModelIds } from "./lib/common.mjs";

const require = createRequireFromLocalFirst(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const pluginRoot = resolve(__dirname, "..");
const yamlPath = resolve(pluginRoot, "models.yaml");
const mdPath = resolve(pluginRoot, "MODELS.md");

// YAML keys we expect to find in MODELS.md tables.
// Gemini CLI is manually maintained in MODELS.md (gen-docs doesn't cover it yet).
const PROVIDERS = ["ollama", "nvidia-nim", "nvidia-security", "copilot", "gemini"];

function extractMdIds(md, section) {
  // Split MODELS.md into sections by ## headers, find the one matching this provider.
  const sections = md.split(/\n##\s+/);
  const hit = sections.find((s) => s.toLowerCase().includes(section.toLowerCase()));
  if (!hit) return null;
  // Pull inline-code model ids from table rows: `…`
  const ids = [...hit.matchAll(/`([a-zA-Z0-9._:\-/]+)`/g)]
    .map((m) => m[1])
    // Keep only entries that look like a model id — reject paths and filenames.
    .filter((id) => !/^(plugins|scripts|[A-Z]+\.md)$/.test(id))
    .filter((id) => !id.endsWith(".mjs") && !id.includes("/scripts/"));
  return [...new Set(ids)];
}

// Section header fragments in MODELS.md keyed by YAML provider key.
const SECTION_FRAGMENT = {
  ollama: "ollama cloud models",
  "nvidia-nim": "nvidia nim frontier models",
  "nvidia-security": "nvidia security",
  copilot: "copilot",
  gemini: "gemini",
};

const YAML_KEY_ALIAS = {
  "nvidia-nim": "nvidia_nim",
  "nvidia-security": "nvidia_security",
};

const md = fs.readFileSync(mdPath, "utf8");
let totalDrift = 0;
const report = [];

for (const p of PROVIDERS) {
  const yamlKey = YAML_KEY_ALIAS[p] ?? p;
  const yamlIds = loadYamlModelIds({ yamlPath, require, key: yamlKey })
    ?? loadYamlModelIds({ yamlPath, require, key: p }); // try both
  if (!yamlIds) {
    report.push(`[${p}] models.yaml: key "${yamlKey}" not found or empty — SKIP`);
    continue;
  }
  const mdIds = extractMdIds(md, SECTION_FRAGMENT[p]);
  if (!mdIds) {
    report.push(`[${p}] MODELS.md: section not found — DRIFT`);
    totalDrift++;
    continue;
  }
  // Models in YAML but not in MODELS.md table.
  const missingInMd = yamlIds.filter((id) => !mdIds.some((mid) => mid === id));
  // Models in MODELS.md table but not in YAML — only count model-shaped ids,
  // so we don't false-flag things like `alias`, `model id`, or "Provider".
  const modelShape = /^([a-z0-9-]+[:/.][a-zA-Z0-9._:\-/]+|opencode\/.+)$/;
  const extraInMd = mdIds
    .filter((id) => modelShape.test(id))
    .filter((id) => !yamlIds.includes(id));

  if (missingInMd.length === 0 && extraInMd.length === 0) {
    report.push(`[${p}] OK — ${yamlIds.length} models match`);
    continue;
  }
  totalDrift++;
  report.push(`[${p}] DRIFT:`);
  if (missingInMd.length) report.push(`  missing in MODELS.md: ${missingInMd.join(", ")}`);
  if (extraInMd.length) report.push(`  extra in MODELS.md (not in yaml): ${extraInMd.join(", ")}`);
}

console.log(report.join("\n"));
if (totalDrift > 0) {
  console.log(`\nFAIL: ${totalDrift} provider(s) drifted. Run: node scripts/gen-docs.mjs`);
  process.exit(1);
}
console.log("\nOK: MODELS.md matches models.yaml.");
process.exit(0);
