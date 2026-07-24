const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL       = process.env.APP_URL || "https://app.hsdos.ai";
const PROJECT_ID    = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY  = process.env.FIREBASE_API_KEY || "";
const FS_BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function findStripeCustomerId(uid, email) {
  // 1. Check Firestore for a stored customer ID (populated by webhook if present)
  try {
    const res = await fetch(`${FS_BASE}/users/${uid}?key=${FIREBASE_KEY}`);
    if (res.ok) {
      const doc        = await res.json();
      const customerId = doc.fields?.stripeCustomerId?.stringValue;
      if (customerId) return customerId;
    }
  } catch (_) {}

  // 2. Fall back to Stripe customer search by email
  const res = await fetch(
    `https://api.stripe.com/v1/customers?email=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET}` } }
  );
  const data = await res.json();
  return data.data?.[0]?.id ?? null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: "Bad request" }; }

  const { uid, email } = body;
  if (!uid || !email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "uid and email required" }) };
  }

  try {
    const customerId = await findStripeCustomerId(uid, email);
    if (!customerId) {
      return {
        statusCode: 404,
        headers: CORS,
        body: JSON.stringify({ error: "No billing account found for this email." }),
      };
    }

    const params = new URLSearchParams({
      customer:   customerId,
      return_url: `${APP_URL}/dashboard`,
    });

    const res  = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await res.json();

    if (!res.ok) throw new Error(session.error?.message || "Stripe portal error");

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("customer-portal error:", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
