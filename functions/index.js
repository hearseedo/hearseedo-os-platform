const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const stripe    = require("stripe")(process.env.STRIPE_SECRET_KEY);

admin.initializeApp();

// ── Replace price_XXX values with real Stripe Price IDs ──────────────────────
const PLAN_APP_MAP = {
  // Individual apps
  "price_PHONICS_INDIVIDUAL":    { plan: "individual", apps: ["phonics"]                                           },
  "price_EIKEN_INDIVIDUAL":      { plan: "individual", apps: ["eiken"]                                             },
  "price_SPEAK_INDIVIDUAL":      { plan: "individual", apps: ["speak"]                                             },
  "price_WONDERCAMP_INDIVIDUAL": { plan: "individual", apps: ["wondercamp"]                                        },
  "price_FAMILY_INDIVIDUAL":     { plan: "individual", apps: ["family"]                                            },
  "price_SIPSWITCH_INDIVIDUAL":  { plan: "individual", apps: ["sipswitch"]                                         },
  "price_INNERKEY_INDIVIDUAL":   { plan: "individual", apps: ["innerkey"]                                          },
  // Bundles
  "price_KIDS_STARTER":          { plan: "kids_starter",  apps: ["phonics", "wondercamp"]                          },
  "price_ENGLISH_BOOST":         { plan: "english_boost", apps: ["eiken", "speak"]                                 },
  "price_ADULT_GROWTH":          { plan: "adult_growth",  apps: ["sipswitch", "innerkey"]                          },
  "price_FAMILY_FULL":           { plan: "family_full",   apps: ["phonics", "wondercamp", "family", "speak"]       },
  "price_ALL_ACCESS":            { plan: "all_access",    apps: ["phonics","eiken","speak","wondercamp","family","sipswitch","innerkey"] },
};

exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── checkout.session.completed ──────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session        = event.data.object;
    const customerEmail  = session.customer_details?.email;
    const customerName   = session.customer_details?.name ?? customerEmail.split("@")[0];
    const stripeCustomerId = session.customer;

    // Retrieve line items to get price ID
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 });
    const priceId   = lineItems.data[0]?.price?.id;
    const planData  = PLAN_APP_MAP[priceId];

    if (!planData) {
      console.warn("Unknown priceId:", priceId);
      return res.status(200).send("Unknown price ID — no action taken");
    }

    // Get or create Firebase Auth user
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(customerEmail);
    } catch {
      userRecord = await admin.auth().createUser({
        email:       customerEmail,
        displayName: customerName,
        password:    generateTempPassword(),
      });
    }

    // Upsert Firestore profile
    const userRef  = admin.firestore().collection("users").doc(userRecord.uid);
    const existing = await userRef.get();

    if (existing.exists) {
      const currentApps = existing.data().subscriptions ?? [];
      await userRef.update({
        plan:             planData.plan,
        subscriptions:    [...new Set([...currentApps, ...planData.apps])],
        stripeCustomerId,
        updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.set({
        uid:              userRecord.uid,
        name:             customerName,
        email:            customerEmail,
        role:             "user",
        plan:             planData.plan,
        subscriptions:    planData.apps,
        stripeCustomerId,
        confidenceScore:  0,
        streak:           0,
        hoursLearned:     0,
        lessonsCompleted: 0,
        xpEarned:         0,
        familyMembers:    [],
        createdAt:        admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt:      null,
      });
    }

    // Trigger welcome email via Firebase Trigger Email extension
    await admin.firestore().collection("mail").add({
      to: customerEmail,
      template: {
        name: "welcome",
        data: {
          name:     customerName.split(" ")[0],
          plan:     planData.plan,
          loginUrl: `${process.env.PLATFORM_URL}/`,
          apps:     planData.apps.join(", "),
        },
      },
    });

    console.log(`✓ User provisioned: ${customerEmail} → ${planData.plan}`);
  }

  // ── customer.subscription.deleted ──────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const customerId = event.data.object.customer;
    const snap = await admin.firestore()
      .collection("users")
      .where("stripeCustomerId", "==", customerId)
      .limit(1)
      .get();

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        plan:          "cancelled",
        subscriptions: [],
        updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✓ Access revoked for Stripe customer: ${customerId}`);
    }
  }

  res.status(200).send("OK");
});

function generateTempPassword() {
  const a = Math.random().toString(36).slice(-8);
  const b = Math.random().toString(36).slice(-8).toUpperCase();
  return `${a}${b}!1`;
}
