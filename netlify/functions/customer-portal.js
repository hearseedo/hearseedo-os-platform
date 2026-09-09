// Security hardening (2026-09-09): this endpoint previously trusted a
// client-supplied uid+email with NO authentication at all — anyone who knew
// or guessed a valid uid/email pair could get back a Stripe Billing Portal
// link for that customer's subscription (view payment methods, cancel,
// etc). uid is now derived from a verified Firebase ID token.
const { verifyIdToken, firestoreFetch } = require("./_firebaseAdmin");

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL       = process.env.APP_URL || "https://app.hsdos.ai";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function findStripeCustomerId(uid, email) {
  // 1. Check Firestore for a stored customer ID (populated by webhook if present)
  try {
    const res = await firestoreFetch(`/users/${uid}`);
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

  const { idToken, email } = body;
  if (!idToken || !email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "idToken and email required" }) };
  }

  let uid;
  try {
    uid = await verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
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
