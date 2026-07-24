// Emergency API kill-switch — passcode-protected
// Sets flags in Firestore config/killSwitch that all AI functions check before executing.
const PROJECT_ID   = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
const FS_BASE      = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const PASSCODE     = process.env.SHUTDOWN_PASSCODE   || "HSD-STOP-2026";

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

  if (!passcode || passcode !== PASSCODE) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Invalid passcode" }) };
  }

  if (!(action in ACTIONS)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unknown action" }) };
  }

  // status action — just read and return current state
  if (action === "status") {
    try {
      const r = await fetch(`${FS_BASE}/config/killSwitch?key=${FIREBASE_KEY}`);
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

  const r = await fetch(`${FS_BASE}/config/killSwitch?key=${FIREBASE_KEY}`, {
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
