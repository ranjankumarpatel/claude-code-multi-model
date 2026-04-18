#!/usr/bin/env node
/**
 * Drift check: compare hand-maintained COPILOT_MODELS against the canonical
 * models.yaml `copilot:` list. Exits 0 on match, 1 on drift.
 *
 * Run via: npm run check-copilot-drift
 */
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequireFromLocalFirst, loadYamlCopilotIds } from "./lib/common.mjs";
import { COPILOT_MODELS } from "./lib/copilot-models.mjs";

const require = createRequireFromLocalFirst(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const yamlPath = resolve(__dirname, "..", "models.yaml");

const yamlIds = loadYamlCopilotIds({ yamlPath, require });
if (!yamlIds) {
  console.error("models.yaml not parseable");
  process.exit(1);
}
const handIds = COPILOT_MODELS.map((m) => m.id);
const missingFromHand = yamlIds.filter((id) => !handIds.includes(id));
const extraInHand = handIds.filter((id) => !yamlIds.includes(id));
if (missingFromHand.length === 0 && extraInHand.length === 0) {
  console.log(`OK: COPILOT_MODELS matches models.yaml (${handIds.length} models).`);
  process.exit(0);
}
console.log("DRIFT:");
if (missingFromHand.length) console.log("  missing from hand: " + missingFromHand.join(", "));
if (extraInHand.length) console.log("  extra in hand: " + extraInHand.join(", "));
process.exit(1);
