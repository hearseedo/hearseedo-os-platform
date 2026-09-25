// Talk with Jona (Gemini Live) — centralized cost-estimation pricing
// (2026-09-25). ONE place Gemini Live $ rates live, so nothing is
// hardcoded inline in components/admin pages — per direct instruction.
//
// HONEST LIMITS OF THIS ESTIMATE (do not remove this note):
// Gemini's Live API returns per-session token usage (promptTokenCount,
// responseTokenCount — see live-token.js's onmessage usageMetadata
// capture) but does NOT return an authoritative dollar cost in the API
// response itself, and Google has not published a per-model rate card
// specific to "gemini-2.5-flash-native-audio-preview-09-2025" that this
// audit could independently verify today. The rates below are carried
// over from the live-web-verified research in
// docs/JONA_REALTIME_VOICE_AUDIT_2026-09-24.md (a comparable Gemini Flash
// Live model, verified via live web search that date) as the best
// available placeholder — NOT a confirmed rate for the exact model in use.
// Every dollar figure this produces must be labeled "estimated" wherever
// shown (admin dashboard only — never surfaced to customers), and this
// config is remotely adjustable via config/livePricingConfig precisely so
// the numbers can be corrected the moment a real invoice or an official
// rate card confirms the actual figures, without a code change.
const DEFAULTS = {
  // USD per 1,000,000 tokens. Gemini Live's token accounting bundles
  // audio/text/etc. into one token count (see UsageMetadata's
  // promptTokensDetails per-modality breakdown, not separately priced
  // here for simplicity — a refinement, not required for a first cost
  // estimate).
  inputPerMillionUSD:   3.00,
  outputPerMillionUSD: 12.00,
};

/**
 * @param {(path: string) => Promise<Response>} firestoreFetch
 * @param {(fields: object) => object} fromFirestoreFields
 */
async function loadLivePricingConfig(firestoreFetch, fromFirestoreFields) {
  try {
    const res = await firestoreFetch("/config/livePricingConfig");
    if (!res.ok) return { ...DEFAULTS };
    const doc = await res.json();
    const f = fromFirestoreFields(doc.fields ?? {});
    return {
      inputPerMillionUSD:  Number.isFinite(f.inputPerMillionUSD)  && f.inputPerMillionUSD  >= 0 ? f.inputPerMillionUSD  : DEFAULTS.inputPerMillionUSD,
      outputPerMillionUSD: Number.isFinite(f.outputPerMillionUSD) && f.outputPerMillionUSD >= 0 ? f.outputPerMillionUSD : DEFAULTS.outputPerMillionUSD,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Estimated USD cost for one session — always an estimate, never exact.
 * @param {{promptTokenCount?: number, responseTokenCount?: number}} usage
 * @param {{inputPerMillionUSD: number, outputPerMillionUSD: number}} pricing
 */
function estimateSessionCostUSD(usage, pricing) {
  const inputTokens  = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.responseTokenCount ?? 0;
  const cost = (inputTokens / 1_000_000) * pricing.inputPerMillionUSD + (outputTokens / 1_000_000) * pricing.outputPerMillionUSD;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6dp — small per-session numbers, avoid losing all precision to rounding
}

module.exports = { loadLivePricingConfig, estimateSessionCostUSD, DEFAULTS };
