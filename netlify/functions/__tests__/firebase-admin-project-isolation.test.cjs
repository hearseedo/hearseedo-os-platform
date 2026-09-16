// Staging-isolation hardening (2026-09-16, corrected twice same-day) —
// unit tests for resolveProjectId()/PROJECT_ID/SA_EMAIL in _firebaseAdmin.js.
//
// Two independent, explicit signals are required for any real deploy:
//   - process.env.HSD_ENV            — "production" | "staging", HSD's own
//     identity for this deploy. No default, ever.
//   - process.env.HSD_DEPLOY_CONTEXT — "published" | "deploy-preview" |
//     "branch-deploy" | "preview-server". WE set this explicitly per
//     deploy context on each Netlify site — it is never inferred from
//     Netlify's own process.env.CONTEXT, which was found to be a
//     build-time-only variable not reliably present in a deployed
//     Function's runtime (confirmed via /api/config-status on the real
//     staging deploy, which reported CONTEXT as simply absent). A signal
//     that isn't reliably present at runtime can't gate access to Firebase
//     credentials, hence the switch to an explicit variable WE control.
//
// Neither HSD_ENV nor HSD_DEPLOY_CONTEXT is set by a plain `node --test`
// run or a local script — every test below supplies its own explicit
// configuration rather than relying on either variable's mere absence to
// mean "local execution"; the "local execution" scenarios themselves are
// exercised as their own explicit test cases (see the "no real-deploy
// signal at all" section below).
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
  const keys = ["CONTEXT", "HSD_ENV", "HSD_DEPLOY_CONTEXT", "FIREBASE_PROJECT_ID", "FIREBASE_SERVICE_ACCOUNT_EMAIL"];
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
// Fetched ONCE via a safe (no real-deploy signal) require — resolveProjectId()
// itself re-reads process.env fresh on every call, so the same function
// reference can be reused across every scenario below without re-requiring.
// This matters because the module ALSO calls resolveProjectId() eagerly at
// its own top level (to compute PROJECT_ID) — re-requiring with an
// intentionally-bad env, as these tests need to, would throw during the
// require() itself, before ever reaching the function this section means
// to exercise directly.
const { resolveProjectId, FirestoreConfigError } = withEnv({}, () => freshRequire());

// ── No real-deploy signal at all (explicit local/test-run scenarios) ────

test("no HSD_ENV and no HSD_DEPLOY_CONTEXT (a plain local/test run) resolves to null, never to production", () => {
  withEnv({}, () => {
    assert.equal(resolveProjectId(), null);
  });
});

test("no HSD_ENV/HSD_DEPLOY_CONTEXT but an explicit FIREBASE_PROJECT_ID (local override) is honored as-is", () => {
  withEnv({ FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("Netlify's own CONTEXT is never consulted — setting it alone (with neither HSD var set) still resolves as a local run", () => {
  withEnv({ CONTEXT: "production", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

// ── Genuine production ───────────────────────────────────────────────────

test("production + published + production Firebase → PASS", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "published", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.equal(resolveProjectId(), PRODUCTION_ID);
  });
});

test("production + deploy-preview + production Firebase → FAIL", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "deploy-preview", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("production + branch-deploy + production Firebase → FAIL", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "branch-deploy", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("production + preview-server + production Firebase → FAIL", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "preview-server", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("production pointing at staging: HSD_ENV=production, HSD_DEPLOY_CONTEXT=published, project=staging → FAIL CLOSED", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "published", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── HSD staging ───────────────────────────────────────────────────────────

test("staging + published + staging Firebase → PASS", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "published", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging + deploy-preview + staging Firebase → PASS", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "deploy-preview", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging + branch-deploy + staging Firebase → PASS", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "branch-deploy", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging + preview-server + staging Firebase → PASS", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "preview-server", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.equal(resolveProjectId(), STAGING_ID);
  });
});

test("staging + any context + production Firebase → FAIL", () => {
  for (const deployContext of ["published", "deploy-preview", "branch-deploy", "preview-server"]) {
    withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: deployContext, FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
      assert.throws(() => resolveProjectId(), FirestoreConfigError, `deployContext=${deployContext} must be rejected`);
    });
  }
});

// ── Missing / invalid HSD_ENV ────────────────────────────────────────────

test("missing HSD_ENV on a real deploy fails closed", () => {
  withEnv({ HSD_DEPLOY_CONTEXT: "published", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("empty-string HSD_ENV fails closed", () => {
  withEnv({ HSD_DEPLOY_CONTEXT: "published", HSD_ENV: "", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("an unrecognized HSD_ENV value fails closed", () => {
  withEnv({ HSD_DEPLOY_CONTEXT: "published", HSD_ENV: "test123", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── Missing / invalid HSD_DEPLOY_CONTEXT ─────────────────────────────────

test("missing HSD_DEPLOY_CONTEXT on a real deploy fails closed", () => {
  withEnv({ HSD_ENV: "staging", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("empty-string HSD_DEPLOY_CONTEXT fails closed", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

test("an unrecognized HSD_DEPLOY_CONTEXT value fails closed", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "production", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    // "production" is Netlify's own CONTEXT vocabulary, not a valid
    // HSD_DEPLOY_CONTEXT value — must be rejected, not silently accepted.
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── Missing project id (retained) ────────────────────────────────────────

test("valid HSD_ENV/HSD_DEPLOY_CONTEXT but FIREBASE_PROJECT_ID missing fails closed rather than guessing", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "published" }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "published" }, () => {
    assert.throws(() => resolveProjectId(), FirestoreConfigError);
  });
});

// ── Module-load-time PROJECT_ID: proves require() itself is safe/unsafe
// in exactly the right circumstances ──────────────────────────────────

test("requiring the module with no real-deploy signal never throws (existing test suite safety)", () => {
  withEnv({}, () => {
    assert.doesNotThrow(() => freshRequire());
  });
});

test("requiring the module in a simulated genuine-production deploy succeeds", () => {
  withEnv({ HSD_ENV: "production", HSD_DEPLOY_CONTEXT: "published", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
    assert.doesNotThrow(() => freshRequire());
  });
});

test("requiring the module in a simulated staging site's published deploy succeeds", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "published", FIREBASE_PROJECT_ID: STAGING_ID }, () => {
    const { PROJECT_ID } = freshRequire();
    assert.equal(PROJECT_ID, STAGING_ID);
  });
});

test("requiring the module in a simulated real deploy with a bad project id throws at load time — refuses to start", () => {
  withEnv({ HSD_ENV: "staging", HSD_DEPLOY_CONTEXT: "branch-deploy", FIREBASE_PROJECT_ID: PRODUCTION_ID }, () => {
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
