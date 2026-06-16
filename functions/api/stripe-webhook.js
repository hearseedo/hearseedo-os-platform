// Cloudflare Pages Function — Stripe webhook with HMAC-SHA256 verification

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

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret || !sigHeader) return false;
  try {
    const pairs     = Object.fromEntries(sigHeader.split(",").map(p => p.split("=")));
    const timestamp = pairs.t;
    const sigs      = sigHeader.split(",").filter(p => p.startsWith("v1=")).map(p => p.slice(3));
    if (!timestamp || !sigs.length) return false;

    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
    if (age > 300) return false; // replay protection

    const signed  = `${timestamp}.${payload}`;
    const keyData = new TextEncoder().encode(secret);
    const key     = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sigBuf  = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
    const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2,"0")).join("");
    return sigs.includes(expected);
  } catch { return false; }
}

async function updateFirestore(projectId, apiKey, uid, planId, status, subscriptionId) {
  const isActive = status === "active";
  const apps     = isActive ? (PLAN_APPS[planId] || []) : [];
  const aiLimit  = isActive ? (AI_LIMITS[planId] || 5) : 5;

  const mask = ["plan","subscriptions","aiMsgLimit","stripeSubId","planStatus","planUpdatedAt"]
    .map(f => `updateMask.fieldPaths=${f}`).join("&");

  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${mask}&key=${apiKey}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        plan:          { stringValue: isActive ? planId : "free" },
        subscriptions: { arrayValue: { values: apps.map(a => ({ stringValue: a })) } },
        aiMsgLimit:    { integerValue: String(aiLimit) },
        stripeSubId:   { stringValue: subscriptionId || "" },
        planStatus:    { stringValue: status },
        planUpdatedAt: { stringValue: new Date().toISOString() },
      }}),
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

async function creditReferrer(projectId, apiKey, referredUid) {
  try {
    const userRes  = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${referredUid}?key=${apiKey}`);
    const userData = await userRes.json();
    const code     = userData.fields?.referredBy?.stringValue;
    if (!code) return;

    const refRes  = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/referralLinks/${code}?key=${apiKey}`);
    const refData = await refRes.json();
    const ownerUid = refData.fields?.ownerUid?.stringValue;
    if (!ownerUid) return;

    // Atomic increment then read new count
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ writes: [{ transform: {
          document: `projects/${projectId}/databases/(default)/documents/referrals/${ownerUid}`,
          fieldTransforms: [
            { fieldPath: "activeCount",      increment: { integerValue: "1" } },
            { fieldPath: "lifetimeReferrals",increment: { integerValue: "1" } },
          ],
        }}]}),
      }
    );

    // Read updated count to compute badge
    const statsRes  = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/referrals/${ownerUid}?key=${apiKey}`);
    const statsData = await statsRes.json();
    const newCount  = parseInt(statsData.fields?.activeCount?.integerValue ?? "0", 10);
    const { badge, commissionRate, customPartnership } = computeBadge(newCount);

    // Write badge and commission back
    const mask = ["badgeLevel","commissionRate","customPartnership","lastBadgeUpdatedAt"]
      .map(f => `updateMask.fieldPaths=${f}`).join("&");
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/referrals/${ownerUid}?${mask}&key=${apiKey}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          badgeLevel:          { stringValue: badge },
          commissionRate:      { doubleValue: commissionRate },
          customPartnership:   { booleanValue: customPartnership },
          lastBadgeUpdatedAt:  { stringValue: new Date().toISOString() },
        }}),
      }
    );
  } catch (err) { console.error("creditReferrer:", err); }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
  const FIREBASE_KEY   = env.FIREBASE_API_KEY;
  const PROJECT_ID     = env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";

  const rawBody   = await request.text();
  const sigHeader = request.headers.get("stripe-signature");

  if (!await verifyStripeSignature(rawBody, sigHeader, WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let evt;
  try { evt = JSON.parse(rawBody); }
  catch { return new Response("Parse error", { status: 400 }); }

  const obj = evt.data?.object;
  try {
    switch (evt.type) {
      case "checkout.session.completed": {
        const uid = obj.metadata?.uid, planId = obj.metadata?.planId;
        if (uid && planId) { await updateFirestore(PROJECT_ID, FIREBASE_KEY, uid, planId, "active", obj.subscription); await creditReferrer(PROJECT_ID, FIREBASE_KEY, uid); }
        break;
      }
      case "customer.subscription.updated": {
        const uid = obj.metadata?.uid, planId = obj.metadata?.planId;
        if (uid && planId) await updateFirestore(PROJECT_ID, FIREBASE_KEY, uid, planId, obj.status === "active" ? "active" : "inactive", obj.id);
        break;
      }
      case "customer.subscription.deleted": {
        const uid = obj.metadata?.uid, planId = obj.metadata?.planId;
        if (uid) await updateFirestore(PROJECT_ID, FIREBASE_KEY, uid, planId, "cancelled", obj.id);
        break;
      }
      case "invoice.payment_failed": {
        const uid = obj.subscription_details?.metadata?.uid, planId = obj.subscription_details?.metadata?.planId;
        if (uid) await updateFirestore(PROJECT_ID, FIREBASE_KEY, uid, planId, "past_due", null);
        break;
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(err.message, { status: 500 });
  }
}
