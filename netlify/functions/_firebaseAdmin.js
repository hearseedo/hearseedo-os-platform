// Shared authenticated-Firestore-REST helper for Netlify Functions.
// Mirrors the pattern already proven in log-page-view.js: the service
// account's private key is split across FIREBASE_SA_KEY_A + FIREBASE_SA_KEY_B
// (avoids AWS Lambda's 4KB per-function env var limit — a single
// FIREBASE_ADMIN_CREDENTIALS var with the full service-account JSON blew past
// that limit combined with this site's other env vars and broke deploys).
// Hand-rolls the Google OAuth2 JWT-bearer exchange rather than depending on
// firebase-admin, which needs the full JSON and adds bundle weight neither of
// which fit this constraint.

const crypto = require("crypto");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const SA_EMAIL   = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || "firebase-adminsdk-fbsvc@hear-see-do-os-ai.iam.gserviceaccount.com";
const SA_KEY_B64 = (process.env.FIREBASE_SA_KEY_A || "") + (process.env.FIREBASE_SA_KEY_B || "");
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let cachedToken = null; // { token, expiresAt } — Netlify reuses warm containers

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;

  const privateKey = Buffer.from(SA_KEY_B64, "base64").toString("utf8");
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const toSign  = `${header}.${payload}`;

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(toSign);
  const signature = sign.sign(privateKey, "base64url");
  const jwt = `${toSign}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = await res.json();

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

// Authenticated Firestore REST call — same shape as fetch(), but with a
// Bearer token attached so writes to security-rules-locked paths succeed.
async function firestoreFetch(path, options = {}) {
  const token = await getAccessToken();
  return fetch(`${FS_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

// Atomic field increment via the :commit transform API — the REST equivalent
// of admin.firestore.FieldValue.increment(n) / client SDK's increment().
async function incrementField(path, fieldPath, amount = 1) {
  const token = await getAccessToken();
  const res = await fetch(`${FS_BASE}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [{
        transform: {
          document: `projects/${PROJECT_ID}/databases/(default)/documents${path}`,
          fieldTransforms: [{ fieldPath, increment: { integerValue: String(amount) } }],
        },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Firestore increment failed: ${await res.text()}`);
}

// Verifies a client Firebase ID token via Google's introspection endpoint
// (same lightweight pattern chat.js already uses) — returns the uid, or
// throws if the token is invalid/expired.
async function verifyIdToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) throw new Error("Invalid ID token");
  const data = await res.json();
  const user = data.users?.[0];
  if (!user) throw new Error("Invalid ID token");
  return user.localId;
}

// ── Plain JS <-> Firestore REST typed-value conversion ──────────────────────
// The REST API wraps every value in a type tag ({"stringValue": "x"} etc.);
// the client SDK/admin SDK hide this entirely, so it has to be handled by
// hand here. Server timestamps are approximated with an ISO string computed
// at request time rather than a native sentinel — accurate enough for
// progress tracking/admin display without needing the heavier :commit
// transform API alongside a plain field PATCH.
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

function fromFirestoreValue(v) {
  if (!v) return null;
  if ("stringValue"  in v) return v.stringValue;
  if ("integerValue"  in v) return parseInt(v.integerValue, 10);
  if ("doubleValue"  in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue"    in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue"   in v) return (v.arrayValue.values ?? []).map(fromFirestoreValue);
  if ("mapValue"     in v) return fromFirestoreFields(v.mapValue.fields ?? {});
  return null;
}

function fromFirestoreFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields ?? {})) obj[k] = fromFirestoreValue(v);
  return obj;
}

module.exports = {
  PROJECT_ID, FS_BASE, firestoreFetch, verifyIdToken, incrementField,
  toFirestoreValue, toFirestoreFields, fromFirestoreValue, fromFirestoreFields,
};
