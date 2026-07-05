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
  const SERVICE_ACCOUNT_KEY   = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const FIREBASE_API_KEY      = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

  if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_KEY || !FIREBASE_API_KEY) {
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
