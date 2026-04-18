#!/usr/bin/env node
// PreToolUse governance hook: warn (or block) when Opus tries to execute directly.
// Reads JSON from stdin per Claude Code plugin spec. Exit 0 = allow, exit 2 = deny.
// Env:
//   CLAUDE_MODEL / ANTHROPIC_MODEL       — current session model (detection source)
//   MULTI_MODEL_ALLOW_OPUS_EXEC=1        — skip entirely
//   MULTI_MODEL_BLOCK_OPUS_EXEC=1        — escalate warning to hard block (exit 2)

const GUARDED_TOOLS = new Set(["Edit", "Write", "NotebookEdit", "Bash"]);

async function readStdin() {
  return await new Promise((resolve) => {
    let buf = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => resolve(buf));
    // If nothing is piped in within a short window, treat as empty.
    setTimeout(() => resolve(buf), 1000).unref?.();
  });
}

function detectModel() {
  return (
    process.env.CLAUDE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    process.env.CLAUDE_CODE_MODEL ||
    ""
  );
}

(async () => {
  if (process.env.MULTI_MODEL_ALLOW_OPUS_EXEC === "1") process.exit(0);

  const raw = await readStdin();
  let payload = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }

  const toolName = payload.tool_name || payload.tool || "";
  if (!GUARDED_TOOLS.has(toolName)) process.exit(0);

  const model = detectModel();
  if (!model) process.exit(0); // no signal → don't block non-Opus sessions
  if (!/opus/i.test(model)) process.exit(0);

  const msg =
    "[multi-model] Opus should dispatch via Agent tool, not execute directly. " +
    "Override with MULTI_MODEL_ALLOW_OPUS_EXEC=1.";
  process.stderr.write(msg + "\n");

  if (process.env.MULTI_MODEL_BLOCK_OPUS_EXEC === "1") process.exit(2);
  process.exit(0);
})();
