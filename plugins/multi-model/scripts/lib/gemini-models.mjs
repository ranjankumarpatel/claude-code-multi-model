/**
 * Hand-maintained Gemini CLI model catalog.
 *
 * KEEP IN SYNC WITH plugins/multi-model/models.yaml gemini: section.
 * This list is hand-maintained and must match the catalog / live Gemini CLI
 * allow-list. Drift will silently break routing — audit on every Gemini SKU rev.
 *
 * Drift check: the mcp-gemini.mjs server runs a drift check on boot;
 * set `GEMINI_STRICT_MODELS=1` to fail startup on drift (exit code 3),
 * otherwise a warning is written to stderr.
 */
export const GEMINI_MODELS = [
  { id: "auto",                   vendor: "Google", notes: "Default — smart routing picks best Gemini model per task complexity" },
  { id: "gemini-3-pro-preview",   vendor: "Google", notes: "Gemini 3 Pro — flagship, deep reasoning, long-context" },
  { id: "gemini-3-flash-preview", vendor: "Google", notes: "Gemini 3 Flash — fast Gemini 3 tier" },
  { id: "gemini-2.5-pro",         vendor: "Google", notes: "Gemini 2.5 Pro — stable production tier" },
  { id: "gemini-2.5-flash",       vendor: "Google", notes: "Gemini 2.5 Flash — fast, cheap bulk tasks" },
];
