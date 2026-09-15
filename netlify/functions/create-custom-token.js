// Secure SSO bridge: verifies a Firebase ID token, then mints a custom token
// so sub-apps (Wondercamp, etc.) can sign in as the same user.
//
// Flow:
//   1. Platform passes user's Firebase ID token to sub-app via URL (?id_token=...)
//   2. Sub-app POSTs { idToken } to this function
//   3. Function verifies the ID token with Firebase Auth REST API
//   4. If valid, mints a custom token signed with the service account private key
//   5. Sub-app calls signInWithCustomToken(auth, customToken)
//
// Security properties:
//   - ID tokens are cryptographically signed by Google — unforgeable
//   - ID tokens expire in 1 hour — short-lived by design
//   - The uid is extracted server-side from the verified token, never trusted from the client
//   - Only real Firebase users of this project can get a custom token

const crypto = require("crypto");
const { normalizePem } = require("./_pemUtils");
// Staging-isolation hardening (2026-09-16) — this function mints a custom
// Firebase Auth token signed with the service account's own private key.
// Before this fix it never validated WHICH Firebase project that service
// account belongs to, or whether HSD_ENV/CONTEXT even permit that project —
// a staging deploy accidentally holding production SA credentials would
// have minted valid production-identity tokens with no check at all. Reuses
// the exact same fail-closed resolver every other function uses.
const { resolveProjectId } = require("./_firebaseAdmin");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function base64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function mintCustomToken(uid, serviceAccountEmail, privateKeyPem) {
  const now     = Math.floor(Date.now() / 1000);
  const header  = base64url(Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64url(Buffer.from(JSON.stringify({
    iss: serviceAccountEmail,
    sub: serviceAccountEmail,
    aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    iat: now,
    exp: now + 3600,
    uid,
  })));

  const signingInput = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signingInput);
  return `${signingInput}.${base64url(sign.sign(privateKeyPem))}`;
}

async function verifyIdToken(idToken, firebaseApiKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0]?.localId ?? null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  const SERVICE_ACCOUNT_EMAIL = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  // Credential-rotation hardening (2026-09-11) — FIREBASE_SA_PRIVATE_KEY
  // (single variable, raw PEM, real or \n-escaped newlines) takes priority;
  // falls back to the legacy base64-split A+B pair, then the older unused
  // FIREBASE_SERVICE_ACCOUNT_KEY single-var convention. Mirrors
  // _firebaseAdmin.js's resolvePrivateKeyPem() — kept as a separate literal
  // here rather than importing it, since this function intentionally has no
  // dependency on _firebaseAdmin.js's Firestore-REST helper (it only needs
  // the key for the Google OAuth2 exchange below, not any of that module's
  // other exports).
  const singleVarKey = process.env.FIREBASE_SA_PRIVATE_KEY;
  const rawKey = (process.env.FIREBASE_SA_KEY_A || "") + (process.env.FIREBASE_SA_KEY_B || "");
  const SERVICE_ACCOUNT_KEY = (singleVarKey && singleVarKey.length > 100)
    ? normalizePem(singleVarKey)
    : rawKey
      ? Buffer.from(rawKey, "base64").toString("utf8")
      : process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const FIREBASE_API_KEY      = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY || !FIREBASE_API_KEY) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Server not configured" }) };
  }

  // Staging-isolation hardening (2026-09-16) — refuse to mint any token at
  // all unless this deploy's HSD_ENV/CONTEXT/FIREBASE_PROJECT_ID combination
  // is valid (see resolveProjectId in _firebaseAdmin.js for the full
  // matrix), AND the configured service-account email actually belongs to
  // that same resolved project. The second check closes a gap the first
  // one alone wouldn't catch: an operator could correctly set
  // FIREBASE_PROJECT_ID=monkey-see-c4c28 for a staging deploy while
  // accidentally leaving FIREBASE_SERVICE_ACCOUNT_EMAIL/
  // FIREBASE_SA_PRIVATE_KEY set to production's real values — resolveProjectId()
  // alone wouldn't notice that mismatch, since it never inspects the SA
  // credentials. Every real Firebase/GCP default service account email is
  // "...@<project-id>.iam.gserviceaccount.com", so this is a reliable,
  // non-secret check. Both failures are logged server-side only — never
  // returned to the caller.
  let resolvedProjectId;
  try {
    resolvedProjectId = resolveProjectId();
  } catch (err) {
    console.error("create-custom-token: refusing to mint — deploy environment is misconfigured:", err.message);
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Server not configured" }) };
  }
  if (resolvedProjectId && !SERVICE_ACCOUNT_EMAIL.endsWith(`@${resolvedProjectId}.iam.gserviceaccount.com`)) {
    console.error(`create-custom-token: refusing to mint — configured service account does not belong to the resolved project "${resolvedProjectId}".`);
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Server not configured" }) };
  }

  let idToken;
  try {
    const body = JSON.parse(event.body || "{}");
    idToken = body.idToken;
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  if (!idToken) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "idToken is required" }) };
  }

  // Verify the ID token and extract uid — never trust client-supplied uid
  const uid = await verifyIdToken(idToken, FIREBASE_API_KEY);
  if (!uid) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired ID token" }) };
  }

  try {
    const privateKeyPem = SERVICE_ACCOUNT_KEY.replace(/\\n/g, "\n");
    const customToken   = mintCustomToken(uid, SERVICE_ACCOUNT_EMAIL, privateKeyPem);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ customToken }),
    };
  } catch (err) {
    console.error("Custom token mint error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to mint token" }) };
  }
};
