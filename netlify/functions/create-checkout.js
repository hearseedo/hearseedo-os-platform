// Security hardening (2026-09-09): two issues fixed here.
// 1. planId used to come straight from the client with no cross-check
//    against priceId — a caller could request checkout for the cheapest
//    real Stripe price but set planId: "all_access" in the request body;
//    stripe-webhook.js trusts metadata.planId when granting access, so
//    that would have paid for the cheap plan and been granted the
//    expensive one. planId is now derived server-side from priceId via
//    PRICE_TO_PLAN (see _pricePlanMap.js) — the client-supplied planId is
//    no longer trusted for anything.
// 2. uid used to come straight from the client body too. It now comes from
//    a verified Firebase ID token, same pattern as the AI endpoints.
const { verifyIdToken, firestoreFetch } = require("./_firebaseAdmin");
const PRICE_TO_PLAN = require("./_pricePlanMap");

const STRIPE_SECRET         = process.env.STRIPE_SECRET_KEY;
const FOUNDING_COUPON_ID    = process.env.STRIPE_FOUNDING_COUPON_ID;
const APP_URL               = process.env.APP_URL || "https://app.hsdos.ai";
const FOUNDING_DISCOUNT_MAX = 200;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Returns current founding counter from Firestore
async function getSignupCount() {
  try {
    const res = await firestoreFetch("/meta/signups");
    if (res.status === 404) return 0;
    const doc = await res.json();
    return parseInt(doc.fields?.count?.integerValue ?? "0", 10);
  } catch { return 0; }
}

async function getFoundingStatus(uid) {
  try {
    // First check if user already has a founding number assigned.
    // (Previously read via a bare API key with no auth token — that read
    // was silently denied by firestore.rules even before the Phase 0
    // hardening, since users/{uid} always required request.auth != null.
    // It degraded gracefully to the count-only check below rather than
    // erroring, so this was a quiet correctness bug, not a crash: an
    // existing founding member could be mis-evaluated once the signup
    // count passed 200. Fixed by reading via the service account.)
    const res = await firestoreFetch(`/users/${uid}`);
    if (!res.ok) {
      // No existing number — check if window is still open
      const count = await getSignupCount();
      return { isFoundingDiscount: count < FOUNDING_DISCOUNT_MAX, memberNumber: null };
    }
    const doc    = await res.json();
    const number = parseInt(doc.fields?.foundingMemberNumber?.integerValue ?? "0", 10);
    if (number > 0 && number <= FOUNDING_DISCOUNT_MAX) {
      return { isFoundingDiscount: true, memberNumber: number };
    }
    // No number yet — check if window is still open
    const count = await getSignupCount();
    return { isFoundingDiscount: count < FOUNDING_DISCOUNT_MAX, memberNumber: null };
  } catch {
    return { isFoundingDiscount: false, memberNumber: null };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  try {
    const { priceId, idToken, email, billing } = JSON.parse(event.body);

    if (!priceId || !idToken || !email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing required fields" }) };
    }

    let uid;
    try {
      uid = await verifyIdToken(idToken);
    } catch {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
    }

    // planId is derived from the actual Stripe price being charged, never
    // trusted from the client — see the top-of-file comment.
    const planId = PRICE_TO_PLAN[priceId];
    if (!planId) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Unrecognized priceId." }) };
    }

    // Check if user qualifies for founding member discount
    const { isFoundingDiscount, memberNumber } = await getFoundingStatus(uid);
    const applyDiscount = isFoundingDiscount && !!FOUNDING_COUPON_ID;

    const params = new URLSearchParams({
      "mode":                               "subscription",
      "line_items[0][price]":               priceId,
      "line_items[0][quantity]":            "1",
      "customer_email":                     email,
      "success_url":                        `${APP_URL}/dashboard?payment=success&plan=${planId}&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url":                         `${APP_URL}/plans?payment=cancelled`,
      "metadata[uid]":                      uid,
      "metadata[planId]":                   planId,
      "metadata[billing]":                  billing || "monthly",
      "metadata[foundingMember]":           memberNumber ? String(memberNumber) : "",
      "subscription_data[metadata][uid]":   uid,
      "subscription_data[metadata][planId]": planId,
      "locale":                             "ja",
    });

    if (applyDiscount) {
      // Auto-apply founding discount — disable manual promo codes when discount is applied
      params.set("discounts[0][coupon]", FOUNDING_COUPON_ID);
    } else {
      params.set("allow_promotion_codes", "true");
    }

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${STRIPE_SECRET}`,
        "Content-Type":  "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (!res.ok) throw new Error(session.error?.message || "Stripe error");

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url, foundingDiscount: applyDiscount }),
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
