// Talk with Jona (Gemini Live) — server-controlled beta limits. Requirement
// #9: a hard session limit from day one, conservative, and remotely
// adjustable — never a number hardcoded into the UI/product-pricing sense.
// Reuses the existing /config/{docId} Firestore convention (public read,
// admin write — see firestore.rules) already used for killSwitch, so
// changing a limit is a Firestore edit, not a deploy.
//
// Conservative beta defaults, deliberately small: this is a brand-new,
// continuously-billable (not per-message) cost shape (see
// docs/JONA_REALTIME_VOICE_AUDIT_2026-09-24.md, Part 3F) being exposed to
// exactly one admin test account first. These numbers exist to bound
// worst-case spend while real usage data is collected, not to model what a
// real customer allowance should eventually be.
const DEFAULTS = {
  maxSessionSeconds:  180, // hard cap per Live connection; server force-closes at this age
  // Raised from 10 -> 25 (2026-09-24) — live-token.js originally incremented
  // this counter BEFORE attempting the mint, so a string of failed attempts
  // during initial debugging (fixed the same day) burned through the cap
  // without ever producing a working session. 25 gives real iteration room
  // for the one admin test account; still nowhere near a customer-facing
  // number.
  dailySessionCap:     25, // max sessions/account/day (UTC) while in admin-only beta
  inactivitySeconds:   45, // no audio either direction for this long -> server-side close
};

/**
 * @param {(path: string) => Promise<Response>} firestoreFetch
 * @param {(fields: object) => object} fromFirestoreFields
 */
async function loadLiveVoiceConfig(firestoreFetch, fromFirestoreFields) {
  try {
    const res = await firestoreFetch("/config/liveVoiceConfig");
    if (!res.ok) return { ...DEFAULTS };
    const doc = await res.json();
    const f = fromFirestoreFields(doc.fields ?? {});
    return {
      maxSessionSeconds: Number.isFinite(f.maxSessionSeconds) && f.maxSessionSeconds > 0 ? f.maxSessionSeconds : DEFAULTS.maxSessionSeconds,
      dailySessionCap:   Number.isFinite(f.dailySessionCap)   && f.dailySessionCap   > 0 ? f.dailySessionCap   : DEFAULTS.dailySessionCap,
      inactivitySeconds: Number.isFinite(f.inactivitySeconds) && f.inactivitySeconds > 0 ? f.inactivitySeconds : DEFAULTS.inactivitySeconds,
    };
  } catch {
    return { ...DEFAULTS }; // fail closed to the conservative defaults, never to "unlimited"
  }
}

module.exports = { loadLiveVoiceConfig, DEFAULTS };
