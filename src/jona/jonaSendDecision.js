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

/**
 * Executes the ordinary (non-demo) live send: calls the given sendMessage
 * implementation and normalizes the outcome into a plain result object,
 * never throwing. Extracted from GlobalJonaAssistant's send() (2026-09-27)
 * so the "authenticated caller sends, gets a reply, recovers from an error"
 * path is directly testable with a mocked sendMessage — no React, no DOM
 * renderer, no real network/model call.
 *
 * @param {{
 *   sendMessage: (messages: any[], user: any, lang: string, context: any, onMeta: (meta: any) => void) => Promise<string>,
 *   messages: any[],
 *   user: object,
 *   lang: string,
 *   context: any,
 *   errorFallback: string,
 * }} params
 * @returns {Promise<
 *   | { ok: true, reply: string, safetyToken: string | null }
 *   | { ok: false, error: string }
 * >}
 */
export async function performLiveSend({ sendMessage, messages, user, lang, context, errorFallback }) {
  let safetyToken = null;
  try {
    const reply = await sendMessage(messages, user, lang, context, (meta) => {
      safetyToken = meta?.safetyToken ?? null;
    });
    return { ok: true, reply, safetyToken };
  } catch (e) {
    return { ok: false, error: e?.message ?? errorFallback };
  }
}
