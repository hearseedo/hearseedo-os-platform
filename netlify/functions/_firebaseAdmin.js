// Shared authenticated-Firestore-REST helper for Netlify Functions.
// Mirrors the pattern already proven in log-page-view.js: the service
// account's private key was historically split across FIREBASE_SA_KEY_A +
// FIREBASE_SA_KEY_B (avoids AWS Lambda's 4KB per-function env var limit — a
// single FIREBASE_ADMIN_CREDENTIALS var with the full service-account JSON
// blew past that limit combined with this site's other env vars and broke
// deploys). Just the private_key field alone (not the full JSON) comfortably
// fits in one variable, so FIREBASE_SA_PRIVATE_KEY (2026-09-11, credential-
// rotation hardening) is now the preferred single-variable path — set it to
// the private_key field's raw value (either real newlines or literal `\n`
// escapes both work, see below). FIREBASE_SA_KEY_A/B are still read as a
// fallback so nothing breaks mid-rotation; new rotations should use the
// single variable going forward and can leave A/B unset or blank.
// Hand-rolls the Google OAuth2 JWT-bearer exchange rather than depending on
// firebase-admin, which needs the full JSON and adds bundle weight neither of
// which fit this constraint.

const crypto = require("crypto");
const { normalizePem } = require("./_pemUtils");

// Thrown when the service account/project itself isn't usable — missing or
// malformed credentials, Google rejecting the JWT-bearer exchange, or (2026-
// 09-16, staging-isolation hardening) a deploy's FIREBASE_PROJECT_ID that
// doesn't match its own deploy context. This is never the calling user's
// fault and never something a client retry can fix on its own; callers
// (record-curriculum-progress.js) check `err.name` to route it to a distinct
// "server configuration" response instead of lumping it in with a generic
// 500 or, worse, a transient/retryable one.
class FirestoreConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "FirestoreConfigError";
  }
}

// Staging-isolation hardening (2026-09-16, corrected same-day). Netlify's
// process.env.CONTEXT ("production", "deploy-preview", "branch-deploy") is
// NOT the same concept as "which HSD environment is this" — CONTEXT means
// "the published deploy of whichever Netlify SITE this is", and a separate
// staging Netlify site's own published deploy legitimately has
// CONTEXT=production too (Netlify's "production" just means "this site's
// main, published deploy" — it says nothing about which HSD environment
// that site represents). Conflating the two would incorrectly reject a
// staging site's own normal published deployment.
//
// So there are two independent, explicit signals, both required for any
// real deploy:
//   - process.env.HSD_ENV        — "production" | "staging", HSD's own
//     identity for this deploy. No default, ever. Set once per Netlify
//     site (production site always "production", staging site always
//     "staging" — this is what actually distinguishes them, not CONTEXT).
//   - process.env.CONTEXT        — Netlify's own deploy-context signal.
//     Used only for ONE additional check: HSD_ENV=production must also be
//     the genuine published production deploy (CONTEXT=production) of the
//     PRODUCTION site, so a deploy-preview/branch-deploy accidentally
//     built with HSD_ENV=production can never reach production Firestore.
//     Staging has no such restriction — a staging site's preview/branch
//     deploys are allowed to use staging Firebase too.
//
// Neither variable is set by a plain `node --test` run or a local script —
// process.env.CONTEXT is the "is this a real deploy at all" gate, matching
// this repo's existing function tests (several require this module
// transitively with zero Firebase env configured, replacing
// firestoreFetch/verifyIdToken with fakes before invoking any handler, so
// PROJECT_ID/FS_BASE are computed but never actually used in that path).
const PRODUCTION_PROJECT_ID = "hear-see-do-os-ai";
const HSD_ENV_PRODUCTION = "production";
const HSD_ENV_STAGING = "staging";
const VALID_HSD_ENVS = [HSD_ENV_PRODUCTION, HSD_ENV_STAGING];

function resolveProjectId() {
  const envProjectId = process.env.FIREBASE_PROJECT_ID;
  const context = process.env.CONTEXT;
  const hsdEnv = process.env.HSD_ENV;

  if (!context) {
    // Not a real Netlify deploy (local test run / script) — nothing to
    // validate against. Never defaults to the production project.
    return envProjectId || null;
  }

  // A real deploy must always declare which HSD environment it is —
  // missing, empty, or an unrecognized value all fail closed the same way.
  if (!hsdEnv || !VALID_HSD_ENVS.includes(hsdEnv)) {
    throw new FirestoreConfigError(
      `HSD_ENV must be explicitly set to "production" or "staging" for the "${context}" deploy context (got ${hsdEnv ? JSON.stringify(hsdEnv) : "unset"}). Refusing to start rather than guessing.`
    );
  }
  if (!envProjectId) {
    throw new FirestoreConfigError(
      `FIREBASE_PROJECT_ID is not set for HSD_ENV="${hsdEnv}" (deploy context "${context}"). Refusing to start rather than guessing a project.`
    );
  }

  const isProductionProject = envProjectId === PRODUCTION_PROJECT_ID;

  if (hsdEnv === HSD_ENV_PRODUCTION) {
    if (!isProductionProject) {
      throw new FirestoreConfigError(
        `Refusing to start: HSD_ENV is "production" but FIREBASE_PROJECT_ID is "${envProjectId}", not "${PRODUCTION_PROJECT_ID}".`
      );
    }
    // Production Firebase may only be reached from the genuine published
    // production deploy — never a deploy-preview or branch-deploy of the
    // production site, even one that (mis)declares HSD_ENV=production.
    if (context !== "production") {
      throw new FirestoreConfigError(
        `Refusing to start: HSD_ENV is "production" but this deploy's Netlify context is "${context}", not "production". Only the genuine published production deployment may access production Firebase.`
      );
    }
    return envProjectId;
  }

  // hsdEnv === HSD_ENV_STAGING — allowed from any Netlify context on the
  // staging site (its own published deploy included — that deploy's own
  // CONTEXT is legitimately "production", meaning "this site's main
  // deploy", which is NOT the same claim as HSD_ENV=production above).
  // The one absolute rule: staging may never use the production project,
  // regardless of context.
  if (isProductionProject) {
    throw new FirestoreConfigError(
      `Refusing to start: HSD_ENV is "staging" but FIREBASE_PROJECT_ID is set to the production project ("${PRODUCTION_PROJECT_ID}"). A staging deploy must never target production.`
    );
  }
  return envProjectId;
}

const PROJECT_ID = resolveProjectId();
const SA_EMAIL   = process.env.FIREBASE_SERVICE_ACCOUNT_EMAIL || null;
const SA_KEY_B64 = (process.env.FIREBASE_SA_KEY_A || "") + (process.env.FIREBASE_SA_KEY_B || "");
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Resolves the PEM private key from whichever source is configured.
// FIREBASE_SA_PRIVATE_KEY takes priority (single-variable path, normalized
// via _pemUtils.js — see that file for the three real shapes handled);
// falls back to the legacy base64-split A+B pair.
function resolvePrivateKeyPem() {
  const single = process.env.FIREBASE_SA_PRIVATE_KEY;
  if (single && single.length > 100) {
    return normalizePem(single);
  }
  if (!SA_KEY_B64 || SA_KEY_B64.length < 100) return null;
  return Buffer.from(SA_KEY_B64, "base64").toString("utf8");
}

let cachedToken = null; // { token, expiresAt } — Netlify reuses warm containers

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;

  // A missing/unset/truncated key (whichever source) would otherwise
  // surface as an opaque Node crypto exception from sign.sign() below —
  // catch the missing-config case explicitly instead of guessing at a
  // crypto error's message shape.
  const privateKey = resolvePrivateKeyPem();
  if (!privateKey) {
    throw new FirestoreConfigError("Firebase service-account credentials are not configured.");
  }
  // SA_EMAIL has no hardcoded fallback (staging-isolation hardening,
  // 2026-09-16) — a signed JWT with a missing/wrong issuer would otherwise
  // fail opaquely at Google's token endpoint below instead of here, clearly.
  if (!SA_EMAIL) {
    throw new FirestoreConfigError("FIREBASE_SERVICE_ACCOUNT_EMAIL is not configured.");
  }
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const header  = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  const toSign  = `${header}.${payload}`;

  let jwt;
  try {
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(toSign);
    const signature = sign.sign(privateKey, "base64url");
    jwt = `${toSign}.${signature}`;
  } catch (err) {
    // A malformed (but present) key fails signing, not the length check
    // above — still a configuration problem, not a transient one.
    throw new FirestoreConfigError(`Service-account key is malformed: ${err.message}`);
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    // Google rejected the credentials (revoked/disabled service account,
    // clock skew, wrong audience, etc.) — a real config problem on our
    // side, never something the calling family can retry their way past.
    throw new FirestoreConfigError(`Token exchange rejected (${res.status}).`);
  }
  const data = await res.json();

  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.token;
}

// Authenticated Firestore REST call — same shape as fetch(), but with a
// Bearer token attached so writes to security-rules-locked paths succeed.
async function firestoreFetch(path, options = {}) {
  const token = await getAccessToken();
  return fetch(`${FS_BASE}${path}`, {
    ...options,
    headers: { ...(options.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}

// Atomic field increment via the :commit transform API — the REST equivalent
// of admin.firestore.FieldValue.increment(n) / client SDK's increment().
async function incrementField(path, fieldPath, amount = 1) {
  const token = await getAccessToken();
  const res = await fetch(`${FS_BASE}:commit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [{
        transform: {
          document: `projects/${PROJECT_ID}/databases/(default)/documents${path}`,
          fieldTransforms: [{ fieldPath, increment: { integerValue: String(amount) } }],
        },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Firestore increment failed: ${await res.text()}`);
}

// Verifies a client Firebase ID token via Google's introspection endpoint
// (same lightweight pattern chat.js already uses) — returns the uid, or
// throws if the token is invalid/expired.
async function verifyIdToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) throw new Error("Invalid ID token");
  const data = await res.json();
  const user = data.users?.[0];
  if (!user) throw new Error("Invalid ID token");
  return user.localId;
}

// ── Plain JS <-> Firestore REST typed-value conversion ──────────────────────
// The REST API wraps every value in a type tag ({"stringValue": "x"} etc.);
// the client SDK/admin SDK hide this entirely, so it has to be handled by
// hand here. Server timestamps are approximated with an ISO string computed
// at request time rather than a native sentinel — accurate enough for
// progress tracking/admin display without needing the heavier :commit
// transform API alongside a plain field PATCH.
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

function fromFirestoreValue(v) {
  if (!v) return null;
  if ("stringValue"  in v) return v.stringValue;
  if ("integerValue"  in v) return parseInt(v.integerValue, 10);
  if ("doubleValue"  in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue"    in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue"   in v) return (v.arrayValue.values ?? []).map(fromFirestoreValue);
  if ("mapValue"     in v) return fromFirestoreFields(v.mapValue.fields ?? {});
  return null;
}

function fromFirestoreFields(fields) {
  const obj = {};
  for (const [k, v] of Object.entries(fields ?? {})) obj[k] = fromFirestoreValue(v);
  return obj;
}

module.exports = {
  PROJECT_ID, FS_BASE, firestoreFetch, verifyIdToken, incrementField,
  toFirestoreValue, toFirestoreFields, fromFirestoreValue, fromFirestoreFields,
  FirestoreConfigError, resolvePrivateKeyPem,
  PRODUCTION_PROJECT_ID, resolveProjectId, getAccessToken,
  HSD_ENV_PRODUCTION, HSD_ENV_STAGING,
};
