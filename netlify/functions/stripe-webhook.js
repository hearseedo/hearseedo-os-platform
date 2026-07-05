const crypto = require("crypto");

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const PROJECT_ID     = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY   = process.env.FIREBASE_API_KEY    || "";
const FS_BASE        = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const FOUNDING_LIMIT = 200; // first 200 paying users get the Founding Member badge

const ALL_APPS = ["phonics", "eiken", "speak", "sipswitch", "wondercamp", "innerkey"];

const PLAN_APPS = {
  // ── Active plans ──────────────────────────────────────────────────────────────
  individual:     ALL_APPS,
  family:         [...ALL_APPS, "family"],
  // ── Legacy (kept for existing subscribers) ────────────────────────────────────
  phonics:        ["phonics"],
  eiken:          ["eiken"],
  sipswitch:      ["sipswitch"],
  speak:          ["speak"],
  innerkey:       ["innerkey"],
  wondercamp:     ["wondercamp"],
  kids_starter:   ["phonics", "wondercamp"],
  english_boost:  ["eiken", "sipswitch"],
  adult_growth:   ["speak", "sipswitch"],
  family_full:    ["family", "phonics", "wondercamp"],
  adult_complete: ["eiken", "sipswitch", "innerkey"],
  all_access:     ["phonics", "eiken", "speak", "sipswitch", "wondercamp", "family", "innerkey"],
  family_core:    ["wondercamp", "phonics"],
  family_plus:    ["wondercamp", "phonics", "eiken", "speak", "sipswitch"],
  family_premium: ["wondercamp", "phonics", "eiken", "speak", "sipswitch", "innerkey"],
  adult_bundle:   ["speak", "sipswitch", "innerkey"],
};

const AI_LIMITS = {
  // ── Active plans ──────────────────────────────────────────────────────────────
  individual: 50,
  family:     100,
  // ── Legacy ───────────────────────────────────────────────────────────────────
  phonics: 15, eiken: 15, sipswitch: 15, speak: 15, innerkey: 15, wondercamp: 15,
  kids_starter: 30, english_boost: 30, adult_growth: 30,
  family_full: 30, adult_complete: 30, all_access: 100,
  family_core:    30,
  family_plus:    60,
  family_premium: 100,
  adult_bundle:   30,
};

// ── Stripe signature verification ─────────────────────────────────────────────
function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  try {
    const parts      = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
    const timestamp  = parts.t;
    const signatures = sigHeader.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const expected      = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
    return signatures.some(sig => crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex")));
  } catch { return false; }
}

// ── Firestore helpers ─────────────────────────────────────────────────────────
async function fsGet(path) {
  const res = await fetch(`${FS_BASE}/${path}?key=${FIREBASE_KEY}`);
  if (res.status === 404) return null;
  const json = await res.json();
  return json.error ? null : json;
}

async function fsPatch(path, fields, fieldMask) {
  const mask = fieldMask.map(f => `updateMask.fieldPaths=${f}`).join("&");
  await fetch(`${FS_BASE}/${path}?${mask}&key=${FIREBASE_KEY}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ fields }),
  });
}

async function fsIncrement(docPath, ...fieldPaths) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${FIREBASE_KEY}`,
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        writes: [{ transform: {
          document:        `projects/${PROJECT_ID}/databases/(default)/documents/${docPath}`,
          fieldTransforms: fieldPaths.map(fp => ({ fieldPath: fp, increment: { integerValue: "1" } })),
        }}],
      }),
    }
  );
}

async function fsGetCount(path, field) {
  const doc = await fsGet(path);
  return parseInt(doc?.fields?.[field]?.integerValue ?? "0", 10);
}

// ── Plan update ───────────────────────────────────────────────────────────────
async function updateFirestore(uid, planId, status, subscriptionId) {
  const isActive = status === "active";
  const apps     = isActive ? (PLAN_APPS[planId] || []) : [];
  const aiLimit  = isActive ? (AI_LIMITS[planId] || 5) : 5;

  await fsPatch(`users/${uid}`,
    {
      plan:          { stringValue: isActive ? planId : "free" },
      subscriptions: { arrayValue: { values: apps.map(a => ({ stringValue: a })) } },
      aiMsgLimit:    { integerValue: String(aiLimit) },
      stripeSubId:   { stringValue: subscriptionId || "" },
      planStatus:    { stringValue: status },
      planUpdatedAt: { stringValue: new Date().toISOString() },
    },
    ["plan", "subscriptions", "aiMsgLimit", "stripeSubId", "planStatus", "planUpdatedAt"]
  );
}

// ── Founding Member — first 200 paying users ──────────────────────────────────
async function claimFoundingSlot(uid) {
  try {
    // Check if user already has a founding number
    const userDoc = await fsGet(`users/${uid}`);
    if (!userDoc) return;
    if (userDoc.fields?.foundingMemberNumber?.integerValue) return; // already claimed

    // Read current count
    const current = await fsGetCount("meta/signups", "count");
    if (current >= FOUNDING_LIMIT) return; // window closed

    // Atomic increment
    await fsIncrement("meta/signups", "count");
    const number = current + 1;

    // Mark user as founding member
    await fsPatch(`users/${uid}`,
      {
        foundingMemberNumber: { integerValue: String(number) },
        isFoundingMember:     { booleanValue: true },
        foundingClaimedAt:    { stringValue: new Date().toISOString() },
      },
      ["foundingMemberNumber", "isFoundingMember", "foundingClaimedAt"]
    );

    console.log(`FOUNDING_MEMBER_CLAIMED uid=${uid} number=${number}`);
  } catch (err) {
    console.error("claimFoundingSlot error:", err);
  }
}

// ── Referral badge thresholds ─────────────────────────────────────────────────
function computeReferralBadge(activeCount) {
  if (activeCount >= 250) return { badge: "visionary",  commissionRate: 0,    customPartnership: true  };
  if (activeCount >= 100) return { badge: "pioneer",    commissionRate: 0.07, customPartnership: false };
  if (activeCount >= 50)  return { badge: "ambassador", commissionRate: 0.06, customPartnership: false };
  if (activeCount >= 25)  return { badge: "starter",    commissionRate: 0.05, customPartnership: false };
  return                         { badge: "none",        commissionRate: 0,    customPartnership: false };
}

// ── Credit referrer on first payment ─────────────────────────────────────────
async function creditReferrer(referredUid) {
  try {
    const userDoc    = await fsGet(`users/${referredUid}`);
    const referredBy = userDoc?.fields?.referredBy?.stringValue; // referrer's UID
    if (!referredBy) return;

    // Prevent double-crediting: check if this user was already counted
    const referralDoc = await fsGet(`referrals/${referredBy}`);
    const credited    = referralDoc?.fields?.creditedUids?.arrayValue?.values ?? [];
    if (credited.some(v => v.stringValue === referredUid)) return;

    // Atomically increment referral counts
    await fsIncrement(`referrals/${referredBy}`, "activeCount", "lifetimeReferrals");

    // Add to credited list (prevents double-counting)
    const newCredited = [...credited.map(v => v.stringValue), referredUid];
    const newCount    = parseInt(referralDoc?.fields?.activeCount?.integerValue ?? "0", 10) + 1;
    const { badge, commissionRate, customPartnership } = computeReferralBadge(newCount);

    await fsPatch(`referrals/${referredBy}`,
      {
        badgeLevel:         { stringValue: badge },
        commissionRate:     { doubleValue: commissionRate },
        customPartnership:  { booleanValue: customPartnership },
        lastBadgeUpdatedAt: { stringValue: new Date().toISOString() },
        creditedUids:       { arrayValue: { values: newCredited.map(u => ({ stringValue: u })) } },
      },
      ["badgeLevel", "commissionRate", "customPartnership", "lastBadgeUpdatedAt", "creditedUids"]
    );

    console.log(`REFERRAL_CREDITED referrer=${referredBy} referredUid=${referredUid} newBadge=${badge}`);
  } catch (err) {
    console.error("creditReferrer error:", err);
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  const rawBody   = event.body;
  const sigHeader = event.headers["stripe-signature"];

  if (!verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    console.error("Stripe signature verification failed");
    return { statusCode: 400, body: "Invalid signature" };
  }

  let stripeEvent;
  try { stripeEvent = JSON.parse(rawBody); }
  catch (err) { return { statusCode: 400, body: `Parse error: ${err.message}` }; }

  const obj = stripeEvent.data?.object;

  try {
    switch (stripeEvent.type) {

      case "checkout.session.completed": {
        const uid    = obj.metadata?.uid;
        const planId = obj.metadata?.planId;
        if (uid && planId) {
          await updateFirestore(uid, planId, "active", obj.subscription);
          await claimFoundingSlot(uid);  // first 200 paying → Founding Member badge
          await creditReferrer(uid);     // credit whoever referred them
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
