const crypto = require("crypto");

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PROJECT_ID     = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY   = process.env.FIREBASE_API_KEY    || "";
const FS_BASE        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const PLAN_APPS = {
  phonics:        ["phonics"],
  eiken:          ["eiken"],
  sipswitch:      ["sipswitch"],
  speak:          ["speak"],
  innerkey:       ["innerkey"],
  kids_starter:   ["phonics", "wondercamp"],
  english_boost:  ["eiken", "sipswitch"],
  adult_growth:   ["speak", "sipswitch"],
  family_full:    ["family", "phonics", "wondercamp"],
  adult_complete: ["eiken", "sipswitch", "innerkey"],
  all_access:     ["phonics", "eiken", "speak", "sipswitch", "wondercamp", "family", "innerkey"],
};

const AI_LIMITS = {
  phonics: 15, eiken: 15, sipswitch: 15, speak: 15, innerkey: 15,
  kids_starter: 30, english_boost: 30, adult_growth: 30,
  family_full: 30, adult_complete: 30, all_access: 100,
};

// Full Stripe webhook HMAC-SHA256 signature verification
function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  try {
    const parts = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
    const timestamp = parts.t;
    const signatures = sigHeader.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    // Reject events older than 5 minutes (replay attack protection)
    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
    return signatures.some(sig => crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")));
  } catch {
    return false;
  }
}

async function updateFirestore(uid, planId, status, subscriptionId) {
  const isActive = status === "active";
  const apps     = isActive ? (PLAN_APPS[planId] || []) : [];
  const aiLimit  = isActive ? (AI_LIMITS[planId] || 5) : 5;

  await fetch(
    `${FS_BASE}/users/${uid}?` +
    ["plan","subscriptions","aiMsgLimit","stripeSubId","planStatus","planUpdatedAt"]
      .map(f => `updateMask.fieldPaths=${f}`).join("&") +
    `&key=${FIREBASE_KEY}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          plan:          { stringValue: isActive ? planId : "free" },
          subscriptions: { arrayValue: { values: apps.map(a => ({ stringValue: a })) } },
          aiMsgLimit:    { integerValue: String(aiLimit) },
          stripeSubId:   { stringValue: subscriptionId || "" },
          planStatus:    { stringValue: status },
          planUpdatedAt: { stringValue: new Date().toISOString() },
        },
      }),
    }
  );
}

function computeBadge(activeCount) {
  if (activeCount >= 200) return { badge: "Visionary",  commissionRate: 0,    customPartnership: true };
  if (activeCount >= 100) return { badge: "Pioneer",    commissionRate: 0.07, customPartnership: false };
  if (activeCount >= 50)  return { badge: "Ambassador", commissionRate: 0.06, customPartnership: false };
  if (activeCount >= 25)  return { badge: "Founder",    commissionRate: 0.05, customPartnership: false };
  return                         { badge: "Member",     commissionRate: 0,    customPartnership: false };
}

async function creditReferrer(referredUid) {
  try {
    const userRes = await fetch(`${FS_BASE}/users/${referredUid}?key=${FIREBASE_KEY}`);
    const userData = await userRes.json();
    const referredBy = userData.fields?.referredBy?.stringValue;
    if (!referredBy) return;

    const refRes = await fetch(`${FS_BASE}/referralLinks/${referredBy}?key=${FIREBASE_KEY}`);
    const refData = await refRes.json();
    const ownerUid = refData.fields?.ownerUid?.stringValue;
    if (!ownerUid) return;

    // Atomic increment of activeCount and lifetimeReferrals
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${FIREBASE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writes: [{ transform: {
          document: `projects/${PROJECT_ID}/databases/(default)/documents/referrals/${ownerUid}`,
          fieldTransforms: [
            { fieldPath: "activeCount",      increment: { integerValue: "1" } },
            { fieldPath: "lifetimeReferrals",increment: { integerValue: "1" } },
          ],
        }}]}),
      }
    );

    // Read new count to compute badge
    const statsRes  = await fetch(`${FS_BASE}/referrals/${ownerUid}?key=${FIREBASE_KEY}`);
    const statsData = await statsRes.json();
    const newCount  = parseInt(statsData.fields?.activeCount?.integerValue ?? "0", 10);
    const { badge, commissionRate, customPartnership } = computeBadge(newCount);

    const mask = ["badgeLevel","commissionRate","customPartnership","lastBadgeUpdatedAt"]
      .map(f => `updateMask.fieldPaths=${f}`).join("&");
    await fetch(
      `${FS_BASE}/referrals/${ownerUid}?${mask}&key=${FIREBASE_KEY}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          badgeLevel:         { stringValue: badge },
          commissionRate:     { doubleValue: commissionRate },
          customPartnership:  { booleanValue: customPartnership },
          lastBadgeUpdatedAt: { stringValue: new Date().toISOString() },
        }}),
      }
    );
  } catch (err) {
    console.error("creditReferrer error:", err);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const rawBody  = event.body;
  const sigHeader = event.headers["stripe-signature"];

  if (!verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    console.error("Stripe signature verification failed");
    return { statusCode: 400, body: "Invalid signature" };
  }

  let stripeEvent;
  try {
    stripeEvent = JSON.parse(rawBody);
  } catch (err) {
    return { statusCode: 400, body: `Parse error: ${err.message}` };
  }

  const obj = stripeEvent.data?.object;

  try {
    switch (stripeEvent.type) {

      case "checkout.session.completed": {
        const uid    = obj.metadata?.uid;
        const planId = obj.metadata?.planId;
        if (uid && planId) {
          await updateFirestore(uid, planId, "active", obj.subscription);
          await creditReferrer(uid);
        }
        break;
      }

      case "customer.subscription.updated": {
        const uid    = obj.metadata?.uid;
        const planId = obj.metadata?.planId;
        const status = obj.status;
        if (uid && planId) {
          await updateFirestore(uid, planId, status === "active" ? "active" : "inactive", obj.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const uid    = obj.metadata?.uid;
        const planId = obj.metadata?.planId;
        if (uid) await updateFirestore(uid, planId, "cancelled", obj.id);
        break;
      }

      case "invoice.payment_failed": {
        const uid    = obj.subscription_details?.metadata?.uid;
        const planId = obj.subscription_details?.metadata?.planId;
        if (uid) await updateFirestore(uid, planId, "past_due", null);
        break;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (err) {
    console.error("Webhook handler error:", err);
    return { statusCode: 500, body: err.message };
  }
};
