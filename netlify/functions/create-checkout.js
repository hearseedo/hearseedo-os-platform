const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.APP_URL || "https://hearseedo-app.netlify.app";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  try {
    const { priceId, planId, uid, email, billing } = JSON.parse(event.body);

    if (!priceId || !uid || !email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    const params = new URLSearchParams({
      "mode": "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "customer_email": email,
      "success_url": `${APP_URL}/dashboard?payment=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `${APP_URL}/plans?payment=cancelled`,
      "metadata[uid]": uid,
      "metadata[planId]": planId,
      "metadata[billing]": billing || "monthly",
      "subscription_data[metadata][uid]": uid,
      "subscription_data[metadata][planId]": planId,
      "allow_promotion_codes": "true",
      "locale": "ja",
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (!res.ok) throw new Error(session.error?.message || "Stripe error");

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error("create-checkout error:", err);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
