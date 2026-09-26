// Eco-demo funnel event tracker (Phase 1, 2026-09-26) — auth-free, same
// service-account pattern as log-page-view.js (that endpoint takes no
// event name/metadata at all, and track-event.js requires a real
// learnerProfiles/{uid} doc that an anonymous demo visitor doesn't have —
// neither fits an anonymous public demo). Writes named, allowlisted-
// metadata-only counters to analytics/ecoDemoFunnel/{event} — never free
// text, never conversation content, never anything that could identify a
// visitor. Metadata values are restricted to booleans/short ids/enums.
const crypto = require("crypto");
const { normalizePem } = require("./_pemUtils");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";

const SA_EMAIL = "firebase-adminsdk-fbsvc@hear-see-do-os-ai.iam.gserviceaccount.com";
const SA_KEY_B64 = (process.env.FIREBASE_SA_KEY_A || "") + (process.env.FIREBASE_SA_KEY_B || "");

function resolvePrivateKeyPem() {
  const single = process.env.FIREBASE_SA_PRIVATE_KEY;
  if (single && single.length > 100) return normalizePem(single);
  return Buffer.from(SA_KEY_B64, "base64").toString("utf8");
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Fixed allowlist — an event name/pathway/meta key not on this list is
// rejected rather than silently written, so this can never become a
// free-form logging sink.
const VALID_EVENTS = new Set([
  "eco_demo_entry", "eco_demo_pathway_selected", "eco_demo_cta_clicked", "eco_demo_error",
  "students_first_attempt_submitted", "students_help_requested", "students_retry_submitted",
  "students_task_completed", "students_next_question_started",
]);
const VALID_PATHWAYS = new Set(["family", "student", "adult", "educator"]);
const VALID_META_KEYS = new Set(["pathwayId", "hasReason", "promptId", "questionsCompleted", "addedReason", "target", "code"]);

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== "object") return {};
  const clean = {};
  for (const [key, value] of Object.entries(meta)) {
    if (!VALID_META_KEYS.has(key)) continue;
    if (typeof value === "boolean" || typeof value === "number") clean[key] = value;
    else if (typeof value === "string" && value.length <= 64) clean[key] = value;
  }
  return clean;
}

async function getAccessToken(clientEmail, privateKey) {
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const toSign  = `${header}.${payload}`;
  const sign      = crypto.createSign("RSA-SHA256");
  sign.update(toSign);
  const signature = sign.sign(privateKey, "base64url");
  const jwt       = `${toSign}.${signature}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { event: eventName, pathwayId, meta } = body;
  if (!eventName || !VALID_EVENTS.has(eventName)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unrecognized event" }) };
  }
  if (pathwayId && !VALID_PATHWAYS.has(pathwayId)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unrecognized pathwayId" }) };
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const cleanMeta = sanitizeMeta(meta);

  try {
    const privateKey = resolvePrivateKeyPem();
    const token      = await getAccessToken(SA_EMAIL, privateKey);

    const fieldTransforms = [
      { fieldPath: "total",        increment: { integerValue: "1" } },
      { fieldPath: `\`${today}\``, increment: { integerValue: "1" } },
    ];
    if (pathwayId) {
      fieldTransforms.push({ fieldPath: `\`byPathway.${pathwayId}\``, increment: { integerValue: "1" } });
    }

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method:  "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          writes: [{
            transform: {
              document:        `projects/${PROJECT_ID}/databases/(default)/documents/analytics/ecoDemoFunnel_${eventName}`,
              fieldTransforms,
            },
          }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("track-demo-event Firestore error:", err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Firestore write failed" }) };
    }

    // cleanMeta is intentionally not written anywhere yet — reserved for a
    // future per-event breakdown doc if needed; kept out of Firestore for
    // now so this endpoint's write shape stays as simple/auditable as
    // log-page-view.js's, and no metadata (even allowlisted) accumulates
    // until there's an actual reporting need for it.
    void cleanMeta;

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("track-demo-event error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Internal error" }) };
  }
};
