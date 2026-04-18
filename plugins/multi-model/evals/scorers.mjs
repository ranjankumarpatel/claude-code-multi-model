// Scorers for the multi-model evals harness.
// Each scorer returns { score: 0..1, detail: string }.

export function exact(output, groundTruth) {
  if (groundTruth == null || groundTruth === "") {
    return { score: 0.0, detail: "missing ground_truth" };
  }
  const a = String(output ?? "").trim();
  const b = String(groundTruth ?? "").trim();
  const hit = a === b;
  return { score: hit ? 1.0 : 0.0, detail: hit ? "exact match" : `expected ${JSON.stringify(b)}, got ${JSON.stringify(a.slice(0, 120))}` };
}

export function regex(output, groundTruth) {
  if (groundTruth == null || groundTruth === "") {
    return { score: 0.0, detail: "missing ground_truth" };
  }
  const pattern = String(groundTruth ?? "");
  let re;
  try {
    re = new RegExp(pattern, "s");
  } catch (e) {
    return { score: 0.0, detail: `invalid regex: ${e.message}` };
  }
  const hit = re.test(String(output ?? ""));
  return { score: hit ? 1.0 : 0.0, detail: hit ? `matched /${pattern}/` : `no match for /${pattern}/` };
}

// TODO (Phase 3): plug an LLM judge here.
//   - Route to Codex (`/codex:review`) or a NIM reasoning model (`nemotron-ultra`)
//     with the output + ground_truth rubric, have it return a 0..1 score + rationale.
//   - For now we stub to 0.5 so runs don't silently pass.
export function semantic(output, groundTruth) {
  return {
    score: 0.5,
    detail: "semantic scorer is STUB — returns 0.5. Wire LLM judge in Phase 3.",
    stub: true,
    ground_truth: groundTruth,
  };
}

export const scorers = { exact, regex, semantic };
