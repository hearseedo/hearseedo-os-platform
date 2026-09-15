// Staging-isolation hardening (2026-09-16) — regression tests for
// create-custom-token.js's environment/project validation. Before this
// fix, this function minted SSO custom tokens signed with whatever
// service-account credentials happened to be configured, with no check at
// all on which Firebase project (or HSD environment) they belonged to — a
// staging deploy accidentally holding production SA credentials could mint
// valid production-identity tokens.
//
// The two new checks run BEFORE any real ID-token verification (no network
// call needed to exercise them): resolveProjectId() (imported from
// _firebaseAdmin.js — same fail-closed matrix used everywhere else) must
// succeed, and the configured FIREBASE_SERVICE_ACCOUNT_EMAIL must actually
// belong to the resolved project. Uses only fake, non-secret values — the
// "private key" here never needs to be real since these tests all fail
// before it would ever be used to sign anything. Run with:
//   node --test netlify/functions/__tests__/create-custom-token-isolation.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");

const HANDLER_PATH = require.resolve("../create-custom-token.js");
const PRODUCTION_ID = "hear-see-do-os-ai";
const STAGING_ID = "monkey-see-c4c28";

const MANAGED_KEYS = [
  "CONTEXT", "HSD_ENV", "FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_EMAIL", "FIREBASE_SA_PRIVATE_KEY",
  "FIREBASE_API_KEY", "VITE_FIREBASE_API_KEY",
];

function withEnv(vars, fn) {
  const original = {};
  for (const k of MANAGED_KEYS) original[k] = process.env[k];
  for (const k of MANAGED_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of MANAGED_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

function freshHandler() {
  delete require.cache[HANDLER_PATH];
  return require(HANDLER_PATH).handler;
}

// A syntactically-plausible but fake, non-secret placeholder — every test
// here fails before this value would ever be used to sign anything.
const FAKE_KEY = "-----BEGIN PRIVATE KEY-----\n" + "x".repeat(200) + "\n-----END PRIVATE KEY-----\n";

const baseConfig = {
  FIREBASE_SA_PRIVATE_KEY: FAKE_KEY,
  FIREBASE_API_KEY: "fake-api-key-not-a-secret-value",
};

test("staging cannot mint a token using production service-account credentials", async () => {
  await withEnv({
    ...baseConfig,
    HSD_ENV: "staging",
    CONTEXT: "production", // the staging site's own published deploy
    FIREBASE_PROJECT_ID: STAGING_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${PRODUCTION_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "irrelevant" }) });
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.parse(res.body).error, "Server not configured");
  });
});

test("production preview (deploy-preview context) cannot mint a production-identity token", async () => {
  await withEnv({
    ...baseConfig,
    HSD_ENV: "production",
    CONTEXT: "deploy-preview",
    FIREBASE_PROJECT_ID: PRODUCTION_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${PRODUCTION_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "irrelevant" }) });
    assert.equal(res.statusCode, 503);
    assert.equal(JSON.parse(res.body).error, "Server not configured");
  });
});

test("production branch-deploy cannot mint a production-identity token either", async () => {
  await withEnv({
    ...baseConfig,
    HSD_ENV: "production",
    CONTEXT: "branch-deploy",
    FIREBASE_PROJECT_ID: PRODUCTION_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${PRODUCTION_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "irrelevant" }) });
    assert.equal(res.statusCode, 503);
  });
});

test("missing HSD_ENV on a real deploy fails closed", async () => {
  await withEnv({
    ...baseConfig,
    CONTEXT: "production",
    FIREBASE_PROJECT_ID: PRODUCTION_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${PRODUCTION_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "irrelevant" }) });
    assert.equal(res.statusCode, 503);
  });
});

test("genuine production (HSD_ENV=production, CONTEXT=production, matching SA + project) passes validation and proceeds to idToken verification", async () => {
  await withEnv({
    ...baseConfig,
    HSD_ENV: "production",
    CONTEXT: "production",
    FIREBASE_PROJECT_ID: PRODUCTION_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${PRODUCTION_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    // No idToken supplied — this proves the function got PAST the
    // environment/project check (which would 503) and reached the
    // idToken-presence check (400), never touching the network.
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({}) });
    assert.equal(res.statusCode, 400);
    assert.equal(JSON.parse(res.body).error, "idToken is required");
  });
});

test("the staging site's own published deployment (CONTEXT=production, HSD_ENV=staging) with matching staging SA + project passes validation", async () => {
  await withEnv({
    ...baseConfig,
    HSD_ENV: "staging",
    CONTEXT: "production",
    FIREBASE_PROJECT_ID: STAGING_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${STAGING_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({}) });
    assert.equal(res.statusCode, 400, "should reach the idToken check, not be blocked by the environment/project check");
  });
});

test("no credential information (key material, tokens) appears in any response body", async () => {
  await withEnv({
    ...baseConfig,
    HSD_ENV: "staging",
    CONTEXT: "production",
    FIREBASE_PROJECT_ID: STAGING_ID,
    FIREBASE_SERVICE_ACCOUNT_EMAIL: `firebase-adminsdk-fbsvc@${PRODUCTION_ID}.iam.gserviceaccount.com`,
  }, async () => {
    const handler = freshHandler();
    const res = await handler({ httpMethod: "POST", body: JSON.stringify({ idToken: "irrelevant" }) });
    assert.ok(!res.body.includes(FAKE_KEY));
    assert.ok(!/BEGIN (RSA )?PRIVATE KEY/.test(res.body));
    assert.ok(!res.body.includes(PRODUCTION_ID), "the response must not even reveal which project was misconfigured");
  });
});
