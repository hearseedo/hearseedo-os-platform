// Pure decision logic extracted from GlobalJonaAssistant's send() (2026-09-27).
// No React, no network — lets both the demo-script failure handling and the
// "which branch would an ordinary (non-demo) caller take" question be
// unit-tested directly, including with a mocked authenticated user, without
// a DOM renderer and without ever executing a real model call.
//
// GlobalJonaAssistant calls this to decide what to do, then performs the
// actual side effect (append the scripted reply / show the sign-in error /
// call the real sendMessage()) for whichever branch is returned.

export const DEMO_ERROR_FALLBACK =
  "I couldn't work out a reply just now — that's a limit of this guided demo, not something wrong with your answer. Try asking again, or keep going with your task below.";

/**
 * @param {{
 *   demoScript: object | ((demoState: any) => object) | undefined,
 *   demoState: any,
 *   user: object | null | undefined,
 *   trimmed: string,
 * }} params
 * @returns {
 *   | { type: "demo", reply: string }
 *   | { type: "demo_error" }
 *   | { type: "requires_auth" }
 *   | { type: "send" }
 * }
 */
export function resolveJonaAction({ demoScript, demoState, user, trimmed }) {
  if (demoScript) {
    let scriptTable;
    try {
      scriptTable = typeof demoScript === "function" ? demoScript(demoState) : demoScript;
    } catch {
      // A script that throws (a broken/missing per-pathway script function)
      // never reaches the caller as an exception, and never falls through
      // to a live call — it's a local, recoverable failure.
      return { type: "demo_error" };
    }
    if (!scriptTable || typeof scriptTable !== "object") {
      // A script that returns nothing usable (undefined, null, a string,
      // whatever) is the same local failure as one that throws.
      return { type: "demo_error" };
    }
    const reply = scriptTable[trimmed] ?? scriptTable._default ?? null;
    if (typeof reply !== "string" || !reply) {
      // Present but with no matching line AND no _default fallback either
      // (a genuinely incomplete script) — still local, still recoverable.
      return { type: "demo_error" };
    }
    return { type: "demo", reply };
  }

  // Ordinary (non-demo) path — this is what a real, signed-in caller
  // reaches. No demoScript was passed at all here, by construction.
  if (!user) {
    return { type: "requires_auth" };
  }
  return { type: "send" };
}
