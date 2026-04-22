/**
 * Hand-maintained Copilot model catalog.
 *
 * KEEP IN SYNC WITH plugins/multi-model/models.yaml copilot: section.
 * This list is hand-maintained and must match the catalog / live Copilot CLI
 * allow-list. Drift will silently break routing — audit on every Copilot SKU rev.
 *
 * Drift check: `npm run check-copilot-drift` compares these IDs against
 * models.yaml's `copilot:` block. The mcp-copilot.mjs server also runs a
 * drift check on boot; set `COPILOT_STRICT_MODELS=1` to fail startup on drift
 * (exit code 3), otherwise a warning is written to stderr.
 */
export const COPILOT_MODELS = [
  { id: "claude-opus-4.6",    vendor: "Anthropic", notes: "Anthropic Opus — planning, architecture, complex reasoning" },
  { id: "claude-sonnet-4.6",  vendor: "Anthropic", notes: "Anthropic Sonnet — balanced coding and reasoning" },
  { id: "claude-haiku-4.5",   vendor: "Anthropic", notes: "Anthropic Haiku — fast, lightweight tasks" },
  { id: "gpt-5.3-codex",      vendor: "OpenAI",    notes: "OpenAI Codex — code generation and completion" },
  { id: "gemini-3-pro",       vendor: "Google",    notes: "Google Gemini Pro — multimodal, long-context" },
  { id: "gpt-5",              vendor: "OpenAI",    notes: "OpenAI GPT-5 — general purpose frontier model" },
];
