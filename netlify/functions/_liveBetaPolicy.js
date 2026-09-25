// Talk with Jona (Gemini Live) — centralized beta policy (2026-09-25 cost
// controls + guardrails). Replaces the earlier _liveVoiceConfig.js: this is
// the single place every Live numeric limit lives, so changing 30 -> 60
// monthly minutes later is a Firestore edit (config/liveBetaPolicy), never
// a code change or a redeploy. The UI/server consume this policy; neither
// invents its own numbers.
//
// Two limit tiers, by design (per explicit direction): admin/test accounts
// (the hand-maintained allowlist in live-token.js) get generous limits so
// development isn't blocked, but every session — admin or beta — is still
// logged with a `usageClass` ("admin_test" vs "beta") so admin testing
// never silently distorts real beta-household usage/cost averages.
const DEFAULTS = {
  // Beta household (usageClass: "beta") limits — the actual product
  // guardrail while Talk with Jona is still admin-only-gated in
  // live-token.js. Deliberately small: this is a brand-new, continuously-
  // billable (not per-message) cost shape.
  monthlyMinutes:        30, // shared across the whole account (household), not per profile
  maxSessionMinutes:      5, // hard per-connection cap
  dailySessions:           3, // per account per day
  idleCheckSeconds:      45, // seconds of the learner NOT talking (Jona not mid-turn) before a "still there?" check-in
  idleDisconnectSeconds: 60, // total idle seconds (including the check-in's own ~15s grace window) before auto-ending
  maxConcurrentSessions:  1, // one live session per account at a time, across all devices

  // Concurrency-lock lease/heartbeat (2026-09-25 — see
  // docs/JONA_LIVE_LOCK_RECOVERY_2026-09-25.md). The lock is now a SHORT,
  // renewable lease instead of "maxSessionSeconds + 30s" — a live client
  // renews it periodically; an orphaned lock (tab closed, network dead,
  // crash) self-expires within roughly lockLeaseSeconds of the last
  // successful renewal, not up to 5.5 minutes. lockLeaseSeconds must stay
  // comfortably above heartbeatIntervalSeconds (a few missed beats of
  // tolerance for transient network blips) without exceeding the ~60-90s
  // recovery target.
  heartbeatIntervalSeconds: 20,
  lockLeaseSeconds:         75,

  // Admin/test tier — generous, not unlimited, still logged and still
  // capped so a runaway test script can't produce unbounded spend.
  adminMonthlyMinutes:   600,
  adminMaxSessionMinutes:  5, // session length itself is a technical/UX limit, not a cost lever — same for everyone
  adminDailySessions:     50,
};

/**
 * @param {(path: string) => Promise<Response>} firestoreFetch
 * @param {(fields: object) => object} fromFirestoreFields
 */
async function loadLiveBetaPolicy(firestoreFetch, fromFirestoreFields) {
  try {
    const res = await firestoreFetch("/config/liveBetaPolicy");
    if (!res.ok) return { ...DEFAULTS };
    const doc = await res.json();
    const f = fromFirestoreFields(doc.fields ?? {});
    const num = (key) => (Number.isFinite(f[key]) && f[key] > 0 ? f[key] : DEFAULTS[key]);
    return {
      monthlyMinutes:         num("monthlyMinutes"),
      maxSessionMinutes:      num("maxSessionMinutes"),
      dailySessions:          num("dailySessions"),
      idleCheckSeconds:       num("idleCheckSeconds"),
      idleDisconnectSeconds:  num("idleDisconnectSeconds"),
      maxConcurrentSessions:  num("maxConcurrentSessions"),
      heartbeatIntervalSeconds: num("heartbeatIntervalSeconds"),
      lockLeaseSeconds:         num("lockLeaseSeconds"),
      adminMonthlyMinutes:    num("adminMonthlyMinutes"),
      adminMaxSessionMinutes: num("adminMaxSessionMinutes"),
      adminDailySessions:     num("adminDailySessions"),
    };
  } catch {
    return { ...DEFAULTS }; // fail closed to the conservative defaults, never to "unlimited"
  }
}

module.exports = { loadLiveBetaPolicy, DEFAULTS };
