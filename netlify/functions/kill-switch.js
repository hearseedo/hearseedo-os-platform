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

// Staging-isolation hardening (2026-09-16) — removed the previous
// hardcoded source-code fallback passcode. There must be no built-in/
// default passcode anywhere in source; PASSCODE is null (never a
// guessable literal) when the env var is absent, and the handler below
// fails closed in that case rather than silently accepting a fallback.
const PASSCODE = process.env.SHUTDOWN_PASSCODE || null;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ACTIONS = {
  disable_all:      { allEnabled: false, geminiEnabled: false, elevenLabsEnabled: false },
  enable_all:       { allEnabled: true,  geminiEnabled: true,  elevenLabsEnabled: true  },
  disable_gemini:   { geminiEnabled: false },
  enable_gemini:    { geminiEnabled: true  },
  disable_tts:      { elevenLabsEnabled: false },
  enable_tts:       { elevenLabsEnabled: true  },
  status:           null, // read-only
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { action, passcode } = body;

  // Fail closed: with no configured passcode, no request can ever be
  // valid — never fall through to a comparison against a hardcoded value.
  if (!PASSCODE) {
    console.error("kill-switch: SHUTDOWN_PASSCODE is not configured — refusing all requests.");
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Server not configured" }) };
  }

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
      if (r.status === 404) return { statusCode: 200, headers: CORS, body: JSON.stringify({ allEnabled: true, geminiEnabled: true, elevenLabsEnabled: true }) };
      const doc = await r.json();
      const f   = doc.fields ?? {};
      return { statusCode: 200, headers: CORS, body: JSON.stringify({
        allEnabled:       f.allEnabled?.booleanValue       ?? true,
        geminiEnabled:    f.geminiEnabled?.booleanValue    ?? true,
        elevenLabsEnabled: f.elevenLabsEnabled?.booleanValue ?? true,
        updatedAt:        f.updatedAt?.integerValue        ?? null,
        lastAction:       f.action?.stringValue            ?? null,
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
