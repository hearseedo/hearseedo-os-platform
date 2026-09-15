// Staging-isolation hardening (2026-09-16, corrected same-day) — unit tests
// for resolveProjectId()/PROJECT_ID/SA_EMAIL in _firebaseAdmin.js.
//
// Two independent signals are required for any real deploy:
//   - process.env.HSD_ENV  — "production" | "staging", HSD's own identity
//     for this deploy. No default, ever.
//   - process.env.CONTEXT  — Netlify's own deploy-context signal
//     ("production" | "deploy-preview" | "branch-deploy"), automatically
//     set on every real deploy, never set for a plain `node --test` run.
//
// The critical distinction this correction fixes: Netlify's CONTEXT=
// "production" means "the published deploy of whichever site this is" —
// NOT "this is HSD's production Firebase project". A separate staging
// Netlify site's own normal published deployment legitimately has
// CONTEXT=production while correctly needing HSD_ENV=staging and
// FIREBASE_PROJECT_ID=monkey-see-c4c28. The original (same-day, prior)
// version of this fix conflated the two and would have wrongly rejected
// exactly that combination — see the "staging site's own published
// deployment" test below, which is the one this correction exists for.
//
// Uses only fake, non-secret project ids/emails. Run with:
//   node --test netlify/functions/__tests__/firebase-admin-project-isolation.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const ADMIN_PATH = require.resolve("../_firebaseAdmin.js");
const PRODUCTION_ID = "hear-see-do-os-ai";
const STAGING_ID = "monkey-see-c4c28";

// A freshly-generated, throwaway RSA keypair — never a real credential —
// needed only where a test exercises the actual JWT-signing code path
// (crypto.createSign().sign() rejects a non-PEM fake string outright).
const { privateKey: FAKE_REAL_PEM } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function withEnv(vars, fn) {
  const keys = ["CONTEXT", "HSD_ENV", "FIREBASE_PROJECT_ID", "FIREBASE_SERVICE_ACCOUNT_EMAIL"];
  const original = {};
  for (const k of keys) original[k] = process.env[k];
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    return fn();
  } finally {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  }
}

function freshRequire() {
  delete require.cache[ADMIN_PATH];
  return require(ADMIN_PATH);
}

// ── resolveProjectId(): the pure decision function, called directly ─────
// Fetched ONCE via a safe (no-CONTEXT) require — resolveProjectId() itself
// re-reads process.env fresh on every call, so the same function reference
// can be reused across every scenario below without re-requiring. This
// matters because the module ALSO calls resolveProjectId() eagerly at its
// own top level (to compute PROJECT_ID) — re-requiring with an
// intentionally-bad env, as these tests need to, would throw during the
// require() itself, before ever reaching the function this section means
// to exercise directly.
const { resolveProjectId, FirestoreConfigError } = withEnv({}, () => freshRequire());

test("no CONTEXT at all (a plain local/test run) resolves to null, never to production, regardless of HSD_ENV", () => {
  withEnv({}, () => {
    assert.equal(resolveProjectId(), null);
  });
});

test("no CONTEXT but an explicit FIREBASE_PROJECT_ID (local override) is honored as-is", () => {
  withEnv({ FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

// ── Genuine production ───────────────────────────────────────────────────

test("genuine production: HSD_ENV=production, CONTEXT=production, project=production → PASS", () => {
  withEnv({ HSD_ENV: "production", CONTEXT: "production", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.equal(resolveProjectId(), PRODUCTION_ID);
  });
});

test("production preview attempting production access: HSD_ENV=production, CONTEXT=deploy-preview → FAIL CLOSED", () => {
  withEnv({ HSD_ENV: "production", CONTEXT: "deploy-preview", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("production branch-deploy attempting production access: HSD_ENV=production, CONTEXT=branch-deploy → FAIL CLOSED", () => {
  withEnv({ HSD_ENV: "production", CONTEXT: "branch-deploy", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("production pointing at staging: HSD_ENV=production, CONTEXT=production, project=staging → FAIL CLOSED", () => {
  withEnv({ HSD_ENV: "production", CONTEXT: "production", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── HSD staging — including the case this correction exists for ────────

test("CRITICAL: the separate staging site's own published deployment — HSD_ENV=staging, CONTEXT=production, project=staging → PASS", () => {
  // Netlify's CONTEXT=production here means only "this is the staging
  // site's own main/published deploy" — it is NOT a claim about HSD
  // production. This must be allowed.
  withEnv({ HSD_ENV: "staging", CONTEXT: "production", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging preview: HSD_ENV=staging, CONTEXT=deploy-preview, project=staging → PASS", () => {
  withEnv({ HSD_ENV: "staging", CONTEXT: "deploy-preview", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging branch-deploy: HSD_ENV=staging, CONTEXT=branch-deploy, project=staging → PASS", () => {
  withEnv({ HSD_ENV: "staging", CONTEXT: "branch-deploy", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging attempting production Firebase is rejected under every Netlify context", () => {
  for (const context of ["production", "deploy-preview", "branch-deploy"]) {
    withEnv({ HSD_ENV: "staging", CONTEXT: context, FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
      assert.throws(() => resolveProjectId(), FirestoreConfigError, `context=${context} must be rejected`);
    });
  }
});

// ── Missing / invalid HSD_ENV ────────────────────────────────────────────

test("missing HSD_ENV on a real deploy fails closed", () => {
  withEnv({ CONTEXT: "production", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("empty-string HSD_ENV fails closed", () => {
  withEnv({ CONTEXT: "production", HSD_ENV: "", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("an unrecognized HSD_ENV value fails closed", () => {
  withEnv({ CONTEXT: "production", HSD_ENV: "test123", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── Missing project id (retained) ────────────────────────────────────────

test("valid HSD_ENV but FIREBASE_PROJECT_ID missing fails closed rather than guessing", () => {
  withEnv({ HSD_ENV: "production", CONTEXT: "production" }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
  withEnv({ HSD_ENV: "staging", CONTEXT: "production" }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── Module-load-time PROJECT_ID: proves require() itself is safe/unsafe
// in exactly the right circumstances ──────────────────────────────────

test("requiring the module with no CONTEXT never throws (existing test suite safety)", () => {
  withEnv({}, () => {
    assert.doesNotThrow(() => freshRequire());
  });
});

test("requiring the module in a simulated genuine-production deploy succeeds", () => {
  withEnv({ HSD_ENV: "production", CONTEXT: "production", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.doesNotThrow(() => freshRequire());
  });
});

test("requiring the module in a simulated staging site's published deploy succeeds (CONTEXT=production, HSD_ENV=staging)", () => {
  withEnv({ HSD_ENV: "staging", CONTEXT: "production", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    const { PROJECT_ID } = freshRequire();
    assert.equal(PROJECT_ID, STAGING_ID);
  });
});

test("requiring the module in a simulated real deploy with a bad project id throws at load time — refuses to start", () => {
  withEnv({ HSD_ENV: "staging", CONTEXT: "branch-deploy", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => freshRequire());
  });
});

// ── SA_EMAIL: no hardcoded production fallback (retained) ────────────────

test("SA_EMAIL has no hardcoded fallback — unset when FIREBASE_SERVICE_ACCOUNT_EMAIL is unset", () => {
  withEnv({}, () => {
    freshRequire();
    // SA_EMAIL isn't exported directly; getAccessToken() is the one place
    // that uses it, and it must refuse to proceed without it (next test).
  });
});

test("getAccessToken() throws a clear config error when SA_EMAIL is missing, even with a private key present", async () => {
  const originalKey = process.env.FIREBASE_SA_PRIVATE_KEY;
  await withEnv({}, async () => {
    process.env.FIREBASE_SA_PRIVATE_KEY = FAKE_REAL_PEM;
    const { getAccessToken, FirestoreConfigError: ExportedError } = freshRequire();
    await assert.rejects(() => getAccessToken(), (err) => {
      assert.ok(err instanceof ExportedError);
      assert.match(err.message, /FIREBASE_SERVICE_ACCOUNT_EMAIL/);
      return true;
    });
  });
  if (originalKey === undefined) delete process.env.FIREBASE_SA_PRIVATE_KEY;
  else process.env.FIREBASE_SA_PRIVATE_KEY = originalKey;
});

test("getAccessToken() throws a clear config error when the private key is missing", async () => {
  const originalKey = process.env.FIREBASE_SA_PRIVATE_KEY;
  const originalA = process.env.FIREBASE_SA_KEY_A;
  const originalB = process.env.FIREBASE_SA_KEY_B;
  delete process.env.FIREBASE_SA_PRIVATE_KEY;
  delete process.env.FIREBASE_SA_KEY_A;
  delete process.env.FIREBASE_SA_KEY_B;
  await withEnv({ FIREBASE_SERVICE_ACCOUNT_EMAIL: "fake@example.invalid" }, async () => {
    const { getAccessToken, FirestoreConfigError: ExportedError } = freshRequire();
    await assert.rejects(() => getAccessToken(), (err) => {
      assert.ok(err instanceof ExportedError);
      assert.match(err.message, /credentials are not configured/);
      return true;
    });
  });
  if (originalKey === undefined) delete process.env.FIREBASE_SA_PRIVATE_KEY; else process.env.FIREBASE_SA_PRIVATE_KEY = originalKey;
  if (originalA === undefined) delete process.env.FIREBASE_SA_KEY_A; else process.env.FIREBASE_SA_KEY_A = originalA;
  if (originalB === undefined) delete process.env.FIREBASE_SA_KEY_B; else process.env.FIREBASE_SA_KEY_B = originalB;
});

// ── Token caching: "initialized once per warm runtime" (retained) ───────

test("getAccessToken() reuses a cached token instead of re-fetching on every call", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.FIREBASE_SA_PRIVATE_KEY;
  const originalEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  let tokenFetchCount = 0;
  try {
    await withEnv({ FIREBASE_SERVICE_ACCOUNT_EMAIL: "fake@example.invalid" }, async () => {
      process.env.FIREBASE_SA_PRIVATE_KEY = FAKE_REAL_PEM;
      global.fetch = async (url) => {
        tokenFetchCount++;
        return {
          ok: true,
          json: async () => ({ access_token: "fake-token", expires_in: 3600 }),
        };
      };
      const { getAccessToken } = freshRequire();
      const first = await getAccessToken();
      const second = await getAccessToken();
      assert.equal(first, "fake-token");
      assert.equal(second, "fake-token");
      assert.equal(tokenFetchCount, 1, "the token endpoint must only be hit once while the cached token is still valid");
    });
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FIREBASE_SA_PRIVATE_KEY; else process.env.FIREBASE_SA_PRIVATE_KEY = originalKey;
    if (originalEmail === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL; else process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL = originalEmail;
  }
});

// ── No credential leakage ─────────────────────────────────────────────────

test("FirestoreConfigError messages never include the private key or a token", async () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.FIREBASE_SA_PRIVATE_KEY;
  const originalEmail = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL;
  try {
    await withEnv({ FIREBASE_SERVICE_ACCOUNT_EMAIL: "fake@example.invalid" }, async () => {
      process.env.FIREBASE_SA_PRIVATE_KEY = FAKE_REAL_PEM;
      global.fetch = async () => ({ ok: false, status: 401, text: async () => "unauthorized" });
      const { getAccessToken } = freshRequire();
      await assert.rejects(() => getAccessToken(), (err) => {
        assert.ok(!err.message.includes(FAKE_REAL_PEM));
        assert.ok(!/BEGIN (RSA )?PRIVATE KEY/.test(err.message));
        return true;
      });
    });
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FIREBASE_SA_PRIVATE_KEY; else process.env.FIREBASE_SA_PRIVATE_KEY = originalKey;
    if (originalEmail === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL; else process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL = originalEmail;
  }
});
