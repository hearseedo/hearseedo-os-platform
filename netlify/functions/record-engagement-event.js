// HSD OS AI — server-authenticated app-engagement recorder (Phase 3.4,
// 2026-09-12; rewritten to a fully atomic transaction and versioned,
// server-only progression derivation in the same-day correctness review).
//
// Replaces two client-SDK Firestore write paths that firestore.rules
// already denies and always has (see docs/PHASE_3_3_DIAGNOSTICS.md):
//   1. src/lib/appEvents.js's processAppEvent() — direct client writes to
//      learnerProfiles/{uid} (+ its interactions/confidenceHistory
//      subcollections), attempted on every HSD_OS_PROGRESS event.
//   2. src/lib/learnerProfile.js's initLearnerProfile() — an eager,
//      uncaught client write on every sign-in, also always denied.
//
// See docs/PHASE_3_4_DATA_MODEL.md for the full data-model writeup (self
// vs. child profile storage location, why learnerProfiles/{uid} is never
// renamed/migrated, TTL/retention plan, and reader-compatibility notes).
// This file's own comments below focus on WHY it's built the way it is.
//
// ── Atomicity (correctness-review correction, 2026-09-12) ─────────────────
//
// Every write this function makes for one event — the idempotency marker,
// the profile-summary upsert (which also creates the profile doc on first
// use), the interaction log entry, the daily confidenceHistory snapshot,
// AND the persisted rate-limit counter — happens inside ONE real Firestore
// interactive transaction (:beginTransaction / reads with ?transaction=.../
// :commit), not a bundle of independent writes. This replaces an earlier
// version of this file that read the profile doc BEFORE a plain :commit
// call, which left a window where two concurrent events for the same
// profile could each read the same "before" state and one increment could
// be silently lost — flagged as incorrect in the Phase 3.4 correctness
// review and fixed here.
//
// Firestore's transaction contract does the actual atomicity work: if any
// document this transaction READ is modified by another transaction that
// commits first, this transaction's own :commit fails with google.rpc.Code
// ABORTED — never a partial write. runTransactionAttempt() below retries
// automatically (bounded, MAX_TRANSACTION_ATTEMPTS) on ABORTED, re-reading
// fresh state each time, which is exactly what the official Firestore
// client SDKs do internally for their own transactions — this hand-rolled
// REST version reproduces the same retry contract deliberately.
//
// Consequences, each covered by netlify/functions/__tests__/
// record-engagement-event-idempotency.test.cjs:
//   - A failure before :commit (bad ownership check, thrown exception,
//     rate limit, or a confirmed duplicate) writes NOTHING — transactions
//     don't write anything until :commit is called, and every early-exit
//     path below explicitly rolls back first.
//   - A failure DURING processing (an exception after beginTransaction but
//     before commit) can never leave a processedEvents/{eventId} marker
//     behind — the marker is only ever written as part of the same commit
//     as everything else, so a half-finished attempt marks nothing as done.
//   - Retrying the identical event after a failure succeeds exactly once:
//     either the original attempt never committed (retry proceeds
//     normally) or it did commit (retry's transactional read of
//     processedEvents/{eventId} sees it and reports a confirmed duplicate).
//   - Two concurrent identical (same eventId) submissions: both begin
//     transactions, both see "not yet processed", but only one can win the
//     commit race — the loser gets ABORTED, retries, and on retry sees the
//     marker and reports duplicate:true. Never double-counted.
//   - Two concurrent DIFFERENT events for the same profile: both read the
//     same starting totals; whichever commits first wins; the other is
//     ABORTED and retries against the now-updated totals. Both events are
//     eventually reflected, correctly, serialized — neither silently
//     overwrites the other's contribution.
const {
  verifyIdToken, firestoreFetch, PROJECT_ID,
  toFirestoreValue, fromFirestoreFields, FirestoreConfigError,
} = require("./_firebaseAdmin");
const {
  isValidAppId, isValidLessonType, skillsForApp, engagementDeltaFor,
  ENGAGEMENT_RULES_VERSION, MAX_REPORTED_XP, MAX_REPORTED_SCORE,
} = require("./_appEventAllowlist");
const { computeConfidenceTrend } = require("./_confidenceTrend");
const { resolveLearnerProfilePath, SELF_PROFILE_ID } = require("./_learnerProfilePath");

// ── CORS (defense-in-depth only — NOT the security boundary) ──────────────
//
// Correctness-review correction: this used to be a blanket
// "Access-Control-Allow-Origin: *", same as every other function in this
// codebase (chat.js, record-curriculum-progress.js, etc. — an existing,
// unrelated platform-wide pattern this file does not otherwise change).
// Reflecting back only a known app origin is strictly weaker than real
// authorization and must never be described as one: CORS is enforced by
// BROWSERS, not by this server, so any non-browser caller (curl, a script,
// a server-to-server request) ignores it completely. The actual security
// boundary for this endpoint is, and remains, the verified Firebase ID
// token plus the profile-ownership check below. This header is included
// only to stop a malicious THIRD-PARTY WEB PAGE from using a signed-in
// user's browser session to fire requests here cross-origin — a real, if
// narrow, defense-in-depth improvement over "*".
//
// A more robust, PLATFORM-level abuse control (proposed, not implemented
// here — needs Firebase console configuration, out of scope for a local-
// only phase) would be Firebase App Check on this endpoint, which
// cryptographically attests that requests come from the real app binary/
// origin rather than a scripted client — CORS can't do that on its own.
const APP_URL = process.env.APP_URL || "https://app.hsdos.ai";
const ALLOWED_ORIGINS = new Set([APP_URL, "http://localhost:5173", "http://localhost:4173"]);

function corsHeadersFor(event) {
  const origin = event?.headers?.origin || event?.headers?.Origin;
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  return {
    "Access-Control-Allow-Origin":  allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

const MAX_STRING_LEN = 64;

function isShortString(v) {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_STRING_LEN;
}

// Same opaque-idempotency-key contract as record-curriculum-progress.js's
// EVENT_ID_PATTERN — client-generated (crypto.randomUUID(), or a fallback),
// never parsed for meaning, just format/length-checked.
const EVENT_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;
function isValidEventId(v) {
  return typeof v === "string" && EVENT_ID_PATTERN.test(v);
}

// Strict allowlist of top-level body fields (correctness-review item 5:
// "reject unexpected fields"). A field outside this set is rejected before
// anything else runs — this is also what structurally guarantees the
// payload can never carry a child's name, email, free text, audio, or a
// transcript: those simply have no field name that would ever be accepted.
const ALLOWED_BODY_KEYS = new Set([
  "idToken", "profileId", "appId", "lessonType", "isCorrect",
  "reportedXp", "reportedScore", "eventId",
]);

function hasOnlyAllowedKeys(body) {
  return Object.keys(body).every((k) => ALLOWED_BODY_KEYS.has(k));
}

/**
 * Validates the full request body against real, known values. Exported for
 * direct unit testing without a live Firestore/HTTP call. `reportedXp`/
 * `reportedScore` are bounded evidence fields ONLY — see _appEventAllowlist.js's
 * header comment for why they never influence engagementDeltaFor().
 */
function validateEvent(body) {
  const errors = [];
  if (!hasOnlyAllowedKeys(body)) errors.push("unexpectedFields");
  if (!isShortString(body.profileId)) errors.push("profileId");
  if (!isValidAppId(body.appId)) errors.push("appId");
  if (!isValidLessonType(body.lessonType)) errors.push("lessonType");
  if (body.isCorrect !== undefined && typeof body.isCorrect !== "boolean") errors.push("isCorrect");
  if (body.reportedXp !== undefined && (typeof body.reportedXp !== "number" || !Number.isFinite(body.reportedXp) || body.reportedXp < 0 || body.reportedXp > MAX_REPORTED_XP)) errors.push("reportedXp");
  if (body.reportedScore !== undefined && body.reportedScore !== null && (typeof body.reportedScore !== "number" || !Number.isFinite(body.reportedScore) || Math.abs(body.reportedScore) > MAX_REPORTED_SCORE)) errors.push("reportedScore");
  if (!isValidEventId(body.eventId)) errors.push("eventId");
  return errors;
}

// ── In-memory per-(uid,profileId) pre-filter — BEST-EFFORT ONLY ───────────
//
// Correctness-review correction: this used to be described (implicitly, by
// being the only rate limit in the file) as the rate limit. It is not a
// security guarantee and must never be treated as one — it lives in one
// serverless instance's memory, so a cold start or a second concurrent
// instance resets or bypasses it entirely. It exists purely as a cheap,
// fast, defense-in-depth pre-filter that avoids spending a Firestore
// transaction on an obviously-abusive burst. THE AUTHORITATIVE, RELIABLE
// limit is the persisted, transactional rateLimit/current document written
// inside runTransactionAttempt() below — see that function for the real
// control. Keyed by uid+profileId (not uid alone) so one child's activity
// can never throttle a sibling on the same account.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS = 30; // generous for genuine use, well below a scripted-abuse rate
const memoryRateLimitLog = new Map(); // "uid:profileId" -> timestamps (ms) within the current window

function rateLimitKey(uid, profileId) {
  return `${uid}:${profileId}`;
}

function isRateLimitedInMemory(uid, profileId, now = Date.now()) {
  const key = rateLimitKey(uid, profileId);
  const recent = (memoryRateLimitLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  memoryRateLimitLog.set(key, recent);
  return recent.length > RATE_LIMIT_MAX_EVENTS;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

const ERROR_RESPONSES = {
  server_error:               { statusCode: 500, body: { success: false, error: "Failed to record activity." } },
  authentication_error:       { statusCode: 401, body: { success: false, error: "Authentication failed." } },
  permission_error:           { statusCode: 403, body: { success: false, error: "Permission denied." } },
  server_configuration_error: { statusCode: 500, body: { success: false, error: "Server temporarily unavailable." } },
  retryable:                  { statusCode: 503, body: { success: false, error: "Temporary failure — please retry.", retryable: true } },
  rate_limited:               { statusCode: 429, body: { success: false, error: "Too many events — please slow down.", retryable: true } },
};

function errorResponse(category, event) {
  const resp = ERROR_RESPONSES[category] ?? ERROR_RESPONSES.server_error;
  return { statusCode: resp.statusCode, headers: { ...corsHeadersFor(event), "Content-Type": "application/json" }, body: JSON.stringify(resp.body) };
}

// Same google.rpc.Code classification as record-curriculum-progress.js —
// duplicated rather than imported to keep each function's failure-handling
// self-contained and independently testable.
function classifyCommitFailure(httpStatus, googleStatus) {
  if (googleStatus === "ALREADY_EXISTS") return "duplicate";
  if (googleStatus === "UNAUTHENTICATED") return "authentication_error";
  if (googleStatus === "PERMISSION_DENIED") return "permission_error";
  if (["ABORTED", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "DEADLINE_EXCEEDED", "INTERNAL", "UNKNOWN", "DATA_LOSS"].includes(googleStatus)) return "retryable";
  if (["INVALID_ARGUMENT", "FAILED_PRECONDITION", "NOT_FOUND", "OUT_OF_RANGE"].includes(googleStatus)) return "server_error";
  if (httpStatus >= 500) return "retryable";
  if (httpStatus === 401) return "authentication_error";
  if (httpStatus === 403) return "permission_error";
  if (httpStatus === 429) return "retryable";
  return "server_error";
}

function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  if (err.cause) return true;
  return typeof err.message === "string" && /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(err.message);
}

// ── Firestore transaction helpers (thin wrappers over firestoreFetch) ─────
// ":beginTransaction"/":rollback"/":commit" are valid Firestore REST RPC
// path suffixes, handled by firestoreFetch exactly like ":commit" already
// was pre-Phase-3.4 — no changes to _firebaseAdmin.js needed.
async function beginTransaction() {
  const res = await firestoreFetch(":beginTransaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: { readWrite: {} } }),
  });
  if (!res.ok) throw new Error(`beginTransaction failed: ${res.status}`);
  const data = await res.json();
  return data.transaction;
}

async function rollbackTransaction(transaction) {
  if (!transaction) return;
  await firestoreFetch(":rollback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transaction }),
  }).catch(() => {}); // best-effort — Firestore also expires abandoned transactions on its own
}

async function readInTransaction(path, transaction) {
  const res = await firestoreFetch(`${path}?transaction=${encodeURIComponent(transaction)}`);
  if (!res.ok) return null; // 404 (or any non-ok) => treated as "doesn't exist yet"
  const json = await res.json();
  return fromFirestoreFields(json.fields ?? {});
}

const MAX_TRANSACTION_ATTEMPTS = 3;

// Retention/TTL (correctness-review item 5 — see docs/PHASE_3_4_DATA_MODEL.md
// for the full retention plan). `expiresAt` is written on both records;
// actually PURGING old documents requires a Firestore TTL policy enabled
// on these collection groups in the Firebase console — that's an infra
// step this local-only phase cannot perform, tracked there as a follow-up.
const PROCESSED_EVENT_TTL_MS = 1000 * 60 * 60 * 24 * 90; // 90 days — generous idempotency window
const RATE_LIMIT_TTL_MS = RATE_LIMIT_WINDOW_MS * 5; // a few windows past relevance

/**
 * One attempt at the whole atomic operation. Returns a discriminated
 * result object; the caller (the exported handler) decides whether to
 * retry based on `kind`. Never partially applies anything — every non-
 * "success" path rolls back before returning.
 */
async function runTransactionAttempt({ uid, profileId, basePath, appId, lessonType, isCorrect, reportedXp, reportedScore, eventId }) {
  const transaction = await beginTransaction();
  try {
    if (profileId !== SELF_PROFILE_ID) {
      // profileId is never proof of authorization by itself — confirm the
      // profile actually belongs to THIS authenticated account before
      // reading or writing anywhere under it. Read inside the SAME
      // transaction so a profile deleted mid-flight can't race this check.
      const memberRes = await firestoreFetch(`/users/${uid}/familyMembers/${profileId}?transaction=${encodeURIComponent(transaction)}`);
      if (!memberRes.ok) {
        await rollbackTransaction(transaction);
        return { kind: "forbidden" };
      }
    }

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const [existing, historyDoc, processedEventDoc, rateLimitDoc] = await Promise.all([
      readInTransaction(basePath, transaction),
      readInTransaction(`${basePath}/confidenceHistory/${today}`, transaction),
      readInTransaction(`${basePath}/processedEvents/${eventId}`, transaction),
      readInTransaction(`${basePath}/rateLimit/current`, transaction),
    ]);

    if (processedEventDoc) {
      // Confirmed by our own transactional read: this exact event was
      // already fully committed. No writes, reported as a successful sync.
      await rollbackTransaction(transaction);
      return { kind: "duplicate" };
    }

    // ── Authoritative, persisted, per-(uid,profileId) rate limit ─────────
    // Reliable across cold starts and multiple concurrent instances
    // (unlike the in-memory pre-filter above) because it's a real Firestore
    // document read/written as part of THIS SAME transaction — a burst of
    // concurrent requests can't all read "under the limit" and all commit;
    // Firestore's optimistic-concurrency check serializes them exactly
    // like it does for the profile doc itself (see file header).
    const nowMs = Date.now();
    let windowStartMs = rateLimitDoc?.windowStart ? Date.parse(rateLimitDoc.windowStart) : null;
    let count = rateLimitDoc?.count ?? 0;
    if (!windowStartMs || Number.isNaN(windowStartMs) || nowMs - windowStartMs >= RATE_LIMIT_WINDOW_MS) {
      windowStartMs = nowMs;
      count = 0;
    }
    count += 1;
    if (count > RATE_LIMIT_MAX_EVENTS) {
      await rollbackTransaction(transaction);
      return { kind: "rate_limited" };
    }

    const totalInteractions = (existing?.totalInteractions ?? 0) + 1;
    const appUsage = { ...(existing?.appUsage ?? {}), [appId]: ((existing?.appUsage?.[appId] ?? 0) + 1) };

    // Engagement delta comes ONLY from the versioned, server-only table —
    // never from a client-supplied number. See _appEventAllowlist.js.
    const engagementDelta = engagementDeltaFor(lessonType, isCorrect);
    const prevEngagement  = existing?.engagementScore ?? 50;
    const newEngagement   = clamp(Math.round(prevEngagement * 0.85 + (prevEngagement + engagementDelta) * 0.15), 0, 100);

    const skills = { ...(existing?.skills ?? {}) };
    for (const skill of skillsForApp(appId)) {
      const prev  = skills[skill] ?? 50;
      const delta = isCorrect ? 2 : -1;
      skills[skill] = clamp(prev + delta, 0, 100);
    }

    const trend = computeConfidenceTrend(historyDoc ? [historyDoc] : []);
    const now = new Date().toISOString();
    const docName = (p) => `projects/${PROJECT_ID}/databases/(default)/documents${p}`;

    const commitRes = await firestoreFetch(":commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction,
        writes: [
          {
            // Idempotency marker. Committed atomically with everything
            // else below — see file header for the full "why" of this.
            update: {
              name: docName(`${basePath}/processedEvents/${eventId}`),
              fields: {
                recordedAt: toFirestoreValue(now),
                expiresAt:  toFirestoreValue(new Date(Date.now() + PROCESSED_EVENT_TTL_MS).toISOString()),
              },
            },
          },
          {
            // Upsert: first-ever event for this profile creates the doc.
            update: {
              name: docName(basePath),
              fields: {
                totalInteractions: toFirestoreValue(totalInteractions),
                appUsage:          toFirestoreValue(appUsage),
                engagementScore:   toFirestoreValue(newEngagement),
                confidenceTrend:   toFirestoreValue(trend),
                skills:            toFirestoreValue(skills),
                updatedAt:         toFirestoreValue(now),
              },
            },
            updateMask: {
              fieldPaths: ["totalInteractions", "appUsage", "engagementScore", "confidenceTrend", "skills", "updatedAt"],
            },
          },
          {
            // Interaction log — no raw message/content, name, email, audio,
            // or transcript (the request body has no field that could ever
            // carry one — see ALLOWED_BODY_KEYS). reportedXp/reportedScore
            // are stored as labeled, client-REPORTED evidence, clearly
            // separate from the server-derived engagementScore/skills
            // above — they never feed back into progression.
            update: {
              name: docName(`${basePath}/interactions/${eventId}`),
              fields: {
                appId: toFirestoreValue(appId),
                lessonType: toFirestoreValue(lessonType),
                isCorrect: toFirestoreValue(isCorrect),
                reportedXp: toFirestoreValue(reportedXp),
                reportedScore: toFirestoreValue(reportedScore),
                engagementRulesVersion: toFirestoreValue(ENGAGEMENT_RULES_VERSION),
                engagementDelta: toFirestoreValue(engagementDelta),
                engagementScore: toFirestoreValue(newEngagement),
                timestamp: toFirestoreValue(now),
              },
            },
          },
          {
            // Daily snapshot — unconditional overwrite (see file header):
            // the latest engagement score for today replaces any earlier
            // snapshot from the same day.
            update: {
              name: docName(`${basePath}/confidenceHistory/${today}`),
              fields: { date: toFirestoreValue(today), score: toFirestoreValue(newEngagement), timestamp: toFirestoreValue(now) },
            },
            updateMask: { fieldPaths: ["date", "score", "timestamp"] },
          },
          {
            update: {
              name: docName(`${basePath}/rateLimit/current`),
              fields: {
                windowStart: toFirestoreValue(new Date(windowStartMs).toISOString()),
                count:       toFirestoreValue(count),
                expiresAt:   toFirestoreValue(new Date(windowStartMs + RATE_LIMIT_TTL_MS).toISOString()),
              },
            },
            updateMask: { fieldPaths: ["windowStart", "count", "expiresAt"] },
          },
        ],
      }),
    });

    if (!commitRes.ok) {
      let googleStatus = null;
      try {
        const errJson = await commitRes.json();
        googleStatus = errJson?.error?.status ?? null;
      } catch { /* non-JSON body — classifyCommitFailure falls back to HTTP status */ }
      return { kind: "commit_failed", httpStatus: commitRes.status, googleStatus };
    }

    return { kind: "success", newEngagement };
  } catch (err) {
    await rollbackTransaction(transaction);
    throw err;
  }
}

exports.handler = async (event) => {
  const cors = corsHeadersFor(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: cors, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  if (!body.idToken) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Authentication required." }) };

  const errors = validateEvent(body);
  if (errors.length) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Invalid fields.", fields: errors }) };
  }

  let uid;
  try {
    uid = await verifyIdToken(body.idToken);
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: "Invalid or expired session." }) };
  }

  const { profileId, appId, eventId } = body;
  const lessonType     = body.lessonType ?? "practice";
  const isCorrect       = body.isCorrect !== false; // matches prior client default (true unless explicitly false)
  const reportedXp      = typeof body.reportedXp === "number" ? body.reportedXp : null;
  const reportedScore   = body.reportedScore ?? null;

  // Cheap, best-effort pre-filter only — see its own comment above for why
  // this can never be the real rate limit.
  if (isRateLimitedInMemory(uid, profileId)) {
    return errorResponse("rate_limited", event);
  }

  const basePath = resolveLearnerProfilePath(uid, profileId);

  try {
    let result = null;
    for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt++) {
      result = await runTransactionAttempt({ uid, profileId, basePath, appId, lessonType, isCorrect, reportedXp, reportedScore, eventId });
      if (result.kind !== "commit_failed") break;
      const category = classifyCommitFailure(result.httpStatus, result.googleStatus);
      console.error(`record-engagement-event commit failed (attempt ${attempt + 1}/${MAX_TRANSACTION_ATTEMPTS}): httpStatus=${result.httpStatus} googleStatus=${result.googleStatus ?? "unknown"} category=${category}`);
      if (category !== "retryable") return errorResponse(category, event);
      // else loop: fresh beginTransaction + fresh reads next attempt
    }

    if (result.kind === "forbidden") {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: "This profile does not belong to the signed-in account." }) };
    }
    if (result.kind === "duplicate") {
      return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: true }) };
    }
    if (result.kind === "rate_limited") {
      return errorResponse("rate_limited", event);
    }
    if (result.kind === "commit_failed") {
      // Every retry attempt was exhausted, still failing.
      return errorResponse("retryable", event);
    }
    return { statusCode: 200, headers: { ...cors, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: false, engagementScore: result.newEngagement }) };
  } catch (err) {
    if (err instanceof FirestoreConfigError) {
      console.error("record-engagement-event config error:", err.message);
      return errorResponse("server_configuration_error", event);
    }
    if (isNetworkError(err)) {
      console.error("record-engagement-event network error:", err.message);
      return errorResponse("retryable", event);
    }
    console.error("record-engagement-event error:", err.message);
    return errorResponse("server_error", event);
  }
};

module.exports.validateEvent = validateEvent;
module.exports.isValidEventId = isValidEventId;
module.exports.classifyCommitFailure = classifyCommitFailure;
module.exports.isNetworkError = isNetworkError;
module.exports.isRateLimitedInMemory = isRateLimitedInMemory;
module.exports.resolveLearnerProfilePath = resolveLearnerProfilePath;
module.exports.RATE_LIMIT_MAX_EVENTS = RATE_LIMIT_MAX_EVENTS;
module.exports.RATE_LIMIT_WINDOW_MS = RATE_LIMIT_WINDOW_MS;
module.exports.corsHeadersFor = corsHeadersFor;
module.exports.ALLOWED_ORIGINS = ALLOWED_ORIGINS;
// Test-only: clears the in-memory pre-filter log so unit tests don't bleed
// state into each other across cases run in the same process.
module.exports.__resetRateLimitForTests = () => memoryRateLimitLog.clear();
