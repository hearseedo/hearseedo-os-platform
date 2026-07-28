const STRIPE_SECRET         = process.env.STRIPE_SECRET_KEY;
const FOUNDING_COUPON_ID    = process.env.STRIPE_FOUNDING_COUPON_ID;
const APP_URL               = process.env.APP_URL || "https://app.hsdos.ai";
const PROJECT_ID            = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_API_KEY      = process.env.FIREBASE_API_KEY || "";
const FOUNDING_DISCOUNT_MAX = 200;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Returns current founding counter from Firestore
async function getSignupCount() {
  try {
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/meta/signups?key=${FIREBASE_API_KEY}`
    );
    if (res.status === 404) return 0;
    const doc = await res.json();
    return parseInt(doc.fields?.count?.integerValue ?? "0", 10);
  } catch { return 0; }
}

async function getFoundingStatus(uid) {
  try {
    // First check if user already has a founding number assigned
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}?key=${FIREBASE_API_KEY}`
    );
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
    const { priceId, planId, uid, email, billing } = JSON.parse(event.body);

    if (!priceId || !uid || !email) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing required fields" }) };
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
