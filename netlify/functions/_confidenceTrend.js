// HSD OS AI — server-side mirror of src/lib/confidenceEngine.js's
// computeConfidenceTrend (Phase 3.4, 2026-09-12).
//
// Deliberately duplicated rather than imported: the client file is an ESM
// module with no Firebase dependency of its own, but Netlify Functions here
// are plain CommonJS (see every other netlify/functions/*.js file) and this
// repo has no build step for the functions directory. The function is 8
// lines and purely mathematical — small enough that a manual mirror (same
// pattern _curriculumIds.js already uses for the V2 curriculum data) is
// far lower risk than adding a bundler step just for this. Keep both copies
// in sync if the trend formula ever changes.
function computeConfidenceTrend(history) {
  if (!history || history.length < 2) return "stable";
  const sorted = [...history].sort((a, b) => (a.date > b.date ? 1 : -1));
  const recent = sorted.slice(-1)[0]?.score ?? 50;
  const older = sorted.slice(-8, -1).reduce((s, h) => s + h.score, 0) / Math.max(1, sorted.slice(-8, -1).length);
  if (recent > older + 3) return "rising";
  if (recent < older - 3) return "declining";
  return "stable";
}

module.exports = { computeConfidenceTrend };
