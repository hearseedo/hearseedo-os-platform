// Landing page visit tracker — uses service account so Firestore rules stay locked.
// Writes to analytics/pageViews: { total, "YYYY-MM-DD": dailyCount }
// SA key split across FIREBASE_SA_KEY_A + FIREBASE_SA_KEY_B env vars (each ~1136 chars, avoids Lambda 4KB limit).

const crypto     = require("crypto");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";

const SA_EMAIL = "firebase-adminsdk-fbsvc@hear-see-do-os-ai.iam.gserviceaccount.com";
// Key split across two env vars to stay under Lambda 4KB limit; neither half is a valid PEM
const SA_KEY_B64 = (process.env.FIREBASE_SA_KEY_A || "") + (process.env.FIREBASE_SA_KEY_B || "");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

  try {
    const privateKey = Buffer.from(SA_KEY_B64, "base64").toString("utf8");
    const token      = await getAccessToken(SA_EMAIL, privateKey);

    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`,
      {
        method:  "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          writes: [{
            transform: {
              document:        `projects/${PROJECT_ID}/databases/(default)/documents/analytics/pageViews`,
              fieldTransforms: [
                { fieldPath: "total",          increment: { integerValue: "1" } },
                { fieldPath: `\`${today}\``,   increment: { integerValue: "1" } },
              ],
            },
          }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("log-page-view Firestore error:", err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Firestore write failed" }) };
    }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("log-page-view error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Internal error" }) };
  }
};
