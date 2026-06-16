// Cloudflare Pages Function — Stripe Customer Portal session

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

  const { customerId, email } = body;

  // Look up customer by email if no customerId provided
  let stripeCustomerId = customerId;
  if (!stripeCustomerId && email) {
    const search = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:"${encodeURIComponent(email)}"&limit=1`,
      { headers: { Authorization: `Bearer ${STRIPE_KEY}` } }
    );
    const result = await search.json();
    stripeCustomerId = result.data?.[0]?.id;
  }

  if (!stripeCustomerId) {
    return new Response(JSON.stringify({ error: "No Stripe customer found for this account." }), {
      status: 404, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    const params = new URLSearchParams({
      customer:     stripeCustomerId,
      return_url:   `${APP_URL}/dashboard`,
    });

    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
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
