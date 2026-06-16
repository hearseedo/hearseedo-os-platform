// Cloudflare Pages Function — Stripe Checkout session creator

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const STRIPE_KEY = env.STRIPE_SECRET_KEY;
  const APP_URL    = env.APP_URL || "https://hearseedo-app.pages.dev";

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS }); }

  const { priceId, planId, uid, email, billing } = body;
  if (!priceId || !uid || !email) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: CORS });
  }

  try {
    const params = new URLSearchParams({
      "mode":                              "subscription",
      "line_items[0][price]":              priceId,
      "line_items[0][quantity]":           "1",
      "customer_email":                    email,
      "success_url":                       `${APP_URL}/dashboard?payment=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url":                        `${APP_URL}/plans?payment=cancelled`,
      "metadata[uid]":                     uid,
      "metadata[planId]":                  planId,
      "metadata[billing]":                 billing || "monthly",
      "subscription_data[metadata][uid]":  uid,
      "subscription_data[metadata][planId]": planId,
      "allow_promotion_codes":             "true",
      "locale":                            "ja",
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_KEY}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (!res.ok) throw new Error(session.error?.message || "Stripe error");

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
