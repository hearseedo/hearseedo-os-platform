// Emergency API kill-switch — passcode-protected
// Sets flags in Firestore config/killSwitch that all AI functions check before executing.
//
// config/killSwitch is now admin-only in firestore.rules (Phase 0 security
// hardening, 2026-09-09) — a bare API-key request has no request.auth, so
// this must authenticate as the service account via firestoreFetch
// (_firebaseAdmin.js), which bypasses rules entirely, same as the Stripe
// webhook. The passcode check below is a second, independent layer on top
// of that — not a substitute for it.
const { firestoreFetch } = require("./_firebaseAdmin");

if (!process.env.SHUTDOWN_PASSCODE) {
  console.error("SHUTDOWN_PASSCODE env var is not set — kill-switch is relying on a source-code fallback value. Set it in Netlify now.");
}
const PASSCODE = process.env.SHUTDOWN_PASSCODE || "HSD-STOP-2026";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ACTIONS = {
  disable_all:        { allEnabled: false, geminiEnabled: false, elevenLabsEnabled: false, geminiLiveEnabled: false },
  enable_all:         { allEnabled: true,  geminiEnabled: true,  elevenLabsEnabled: true,  geminiLiveEnabled: true  },
  disable_gemini:     { geminiEnabled: false },
  enable_gemini:      { geminiEnabled: true  },
  disable_tts:        { elevenLabsEnabled: false },
  enable_tts:         { elevenLabsEnabled: true  },
  // Talk with Jona (Gemini Live) — a dedicated switch separate from
  // disable_gemini (which stops Ask Jona's text pipeline too). Preventing
  // NEW sessions immediately is the chosen behavior for beta (see
  // docs/JONA_LIVE_BETA_GUARDRAILS_2026-09-25.md) — live-token.js checks
  // this before minting any token, so an already-open session already in
  // progress is allowed to finish naturally (it was minted before the
  // flag flipped) rather than being forcibly cut off mid-conversation.
  disable_gemini_live: { geminiLiveEnabled: false },
  enable_gemini_live:  { geminiLiveEnabled: true  },
  status:           null, // read-only
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { action, passcode } = body;

  if (!passcode || passcode !== PASSCODE) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Invalid passcode" }) };
  }

  if (!(action in ACTIONS)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unknown action" }) };
  }

  // status action — just read and return current state
  if (action === "status") {
    try {
      const r = await firestoreFetch("/config/killSwitch");
      if (r.status === 404) return { statusCode: 200, headers: CORS, body: JSON.stringify({ allEnabled: true, geminiEnabled: true, elevenLabsEnabled: true, geminiLiveEnabled: true }) };
      const doc = await r.json();
      const f   = doc.fields ?? {};
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        allEnabled:        f.allEnabled?.booleanValue        ?? true,
        geminiEnabled:     f.geminiEnabled?.booleanValue     ?? true,
        elevenLabsEnabled: f.elevenLabsEnabled?.booleanValue ?? true,
        geminiLiveEnabled: f.geminiLiveEnabled?.booleanValue ?? true,
        updatedAt:         f.updatedAt?.integerValue         ?? null,
        lastAction:        f.action?.stringValue             ?? null,
      })};
    } catch {
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Could not read status" }) };
    }
  }

  // Write the flag to Firestore
  const updates = ACTIONS[action];
  const fields  = { action: { stringValue: action }, updatedAt: { integerValue: String(Date.now()) } };
  for (const [k, v] of Object.entries(updates)) {
    fields[k] = { booleanValue: v };
  }

  const r = await firestoreFetch("/config/killSwitch", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ fields }),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error("kill-switch write error:", r.status, err);
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: "Failed to update — check Firestore" }) };
  }

  console.log("KILL_SWITCH_ACTION", action, "at", new Date().toISOString());
  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, action, ...updates }) };
};
