// HSD OS AI — server-authenticated curriculum-progress recorder (Phase A/B
// security correction #4/#5, 2026-09-10).
//
// Replaces the client-SDK write in src/family/curriculumProgress.js. The
// browser can no longer write curriculumProgress directly (see
// firestore.rules — write: if false there now); every write goes through
// this function instead, so every field is validated against V2's real
// curriculum ids (_curriculumIds.js) before anything reaches Firestore.
const { verifyIdToken, firestoreFetch, PROJECT_ID, toFirestoreValue, fromFirestoreFields, FirestoreConfigError } = require("./_firebaseAdmin");
const { VALID_CURRICULUM_IDS, VALID_SECTIONS, VALID_CONFIDENCE_SIGNALS, VALID_SKILLS, isValidLessonId, bookIdForLesson } = require("./_curriculumIds");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_SKILLS = 8;          // generous upper bound — no real lesson touches more than a handful
const MAX_STRING_LEN = 64;     // ids/sections are short fixed vocabulary, never free text

function isShortString(v) {
  return typeof v === "string" && v.length > 0 && v.length <= MAX_STRING_LEN;
}

// Event-id format (correction, 2026-09-10): the client generates this with
// crypto.randomUUID() (36-char hex+hyphen) or, only if that API is
// unavailable, a base36-timestamp+random fallback (see V2's
// generateAttemptId()). Both shapes are plain [a-zA-Z0-9-], so a charset +
// length check here rejects anything malformed or oversized without
// hard-coding the UUID shape specifically — the id is an opaque idempotency
// key, never parsed for meaning.
const EVENT_ID_PATTERN = /^[a-zA-Z0-9-]{8,64}$/;

function isValidEventId(v) {
  return typeof v === "string" && EVENT_ID_PATTERN.test(v);
}

// ── Firestore commit error classification (correction, 2026-09-10) ─────────
//
// A generic HTTP 400 or 409 from Firestore's :commit endpoint is NOT proof
// of a duplicate — Firestore maps several unrelated google.rpc.Code values
// onto those same HTTP statuses (ALREADY_EXISTS -> 409, but so does the
// unrelated ABORTED transaction-conflict code; INVALID_ARGUMENT and
// FAILED_PRECONDITION both -> 400). Treating "any 409" as "duplicate" would
// have silently swallowed real transaction conflicts and reported false
// success. The commit response body's own `error.status` field (the
// canonical google.rpc.Code name, e.g. "ALREADY_EXISTS") is the only
// reliable signal — this function classifies on that, falling back to the
// bare HTTP status only when no parseable status is present, and NEVER
// defaults an unrecognized failure to "duplicate".
//
// Because this request's `writes` array sets exactly one precondition
// (`currentDocument: { exists: false }` on the processedEvents marker),
// an ALREADY_EXISTS response can only refer to that one precondition —
// there is no ambiguity about which write it names.
const RETRYABLE_GOOGLE_STATUSES = new Set([
  "ABORTED",           // transaction/contention conflict
  "RESOURCE_EXHAUSTED", // rate limiting / quota
  "UNAVAILABLE",        // transient Firestore outage
  "DEADLINE_EXCEEDED",  // timeout
  "INTERNAL",           // Firestore 500-series
  "UNKNOWN",            // Firestore 500-series, unclassified
  "DATA_LOSS",
]);

/**
 * Classifies a failed :commit response into one of a fixed set of
 * categories the client can act on honestly. Exported for direct unit
 * testing against synthetic Firestore error bodies, without a live
 * Firestore call.
 */
function classifyCommitFailure(httpStatus, googleStatus) {
  if (googleStatus === "ALREADY_EXISTS") return "duplicate";
  if (googleStatus === "UNAUTHENTICATED") return "authentication_error";
  if (googleStatus === "PERMISSION_DENIED") return "permission_error";
  if (RETRYABLE_GOOGLE_STATUSES.has(googleStatus)) return "retryable";
  if (googleStatus === "INVALID_ARGUMENT" || googleStatus === "FAILED_PRECONDITION" || googleStatus === "NOT_FOUND" || googleStatus === "OUT_OF_RANGE") {
    return "server_error";
  }
  // No parseable google.rpc.Code (unexpected response shape, or a non-JSON
  // body) — fall back to coarse HTTP-status buckets, but a bare 400/409
  // here is deliberately NOT treated as a duplicate; it's an unexpected
  // response, reported as a server error rather than assumed successful.
  if (httpStatus >= 500) return "retryable";
  if (httpStatus === 401) return "authentication_error";
  if (httpStatus === 403) return "permission_error";
  if (httpStatus === 429) return "retryable";
  return "server_error";
}

// Client-facing responses for each category — deliberately generic. No
// Firestore internals, document paths, project ids, or raw error text ever
// reach the browser; the full detail is only ever console.error'd
// server-side (Netlify function logs), never included in a response body.
const ERROR_RESPONSES = {
  server_error:               { statusCode: 500, body: { success: false, error: "Failed to record progress." } },
  authentication_error:       { statusCode: 401, body: { success: false, error: "Authentication failed." } },
  permission_error:           { statusCode: 403, body: { success: false, error: "Permission denied." } },
  server_configuration_error: { statusCode: 500, body: { success: false, error: "Server temporarily unavailable." } },
  retryable:                  { statusCode: 503, body: { success: false, error: "Temporary failure — please retry.", retryable: true } },
};

function errorResponse(category) {
  const resp = ERROR_RESPONSES[category] ?? ERROR_RESPONSES.server_error;
  return { statusCode: resp.statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(resp.body) };
}

// Distinguishes a network-level failure (the request never reached
// Firestore at all — offline, DNS failure, connection reset, timeout) from
// a genuine application error. Node's fetch throws a TypeError for these;
// undici also attaches a `cause`. Checked defensively by message pattern
// too, since not every runtime/polyfill throws the same error subclass.
function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError) return true;
  if (err.cause) return true;
  return typeof err.message === "string" && /fetch failed|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|network/i.test(err.message);
}

/**
 * Validates the full event body against real, known values — never trusts
 * a client-supplied bookId/section/skill list at face value. Exported for
 * direct unit testing without needing a live Firestore/HTTP call.
 */
function validateEvent(body) {
  const errors = [];
  if (!isShortString(body.profileId)) errors.push("profileId");
  if (!isShortString(body.curriculumId) || !VALID_CURRICULUM_IDS.has(body.curriculumId)) errors.push("curriculumId");
  if (!isShortString(body.lessonId) || !isValidLessonId(body.lessonId)) errors.push("lessonId");
  if (body.section !== undefined && body.section !== null && !VALID_SECTIONS.has(body.section)) errors.push("section");
  if (body.completed !== undefined && typeof body.completed !== "boolean") errors.push("completed");
  if (body.confidenceSignal !== undefined && body.confidenceSignal !== null && !VALID_CONFIDENCE_SIGNALS.has(body.confidenceSignal)) errors.push("confidenceSignal");
  if (body.skillsPracticed !== undefined) {
    if (!Array.isArray(body.skillsPracticed) || body.skillsPracticed.length > MAX_SKILLS
      || !body.skillsPracticed.every(s => typeof s === "string" && VALID_SKILLS.has(s))) {
      errors.push("skillsPracticed");
    }
  }
  // eventId is the dedup key (correction #5) — required, format-checked,
  // never trusted as proof of authentication or ownership by itself (that
  // comes from idToken verification below; the id is scoped to this
  // request's own uid/profileId path, never used to look anything up on
  // its own).
  if (!isValidEventId(body.eventId)) errors.push("eventId");
  return errors;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  if (!body.idToken) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };

  const errors = validateEvent(body);
  if (errors.length) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid fields.", fields: errors }) };
  }

  let uid;
  try {
    uid = await verifyIdToken(body.idToken);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
  }

  const { profileId, curriculumId, lessonId, section, eventId } = body;
  const completed = !!body.completed;
  const skillsPracticed = Array.isArray(body.skillsPracticed) ? body.skillsPracticed : [];
  const confidenceSignal = body.confidenceSignal ?? null;
  // bookId is derived from the validated lessonId server-side — never
  // trusted from the client, so a mismatched/forged bookId can't sneak in
  // alongside a valid lessonId.
  const bookId = bookIdForLesson(lessonId);

  const basePath = profileId === "self"
    ? `/users/${uid}/curriculumProgress/${curriculumId}`
    : `/users/${uid}/familyMembers/${profileId}/curriculumProgress/${curriculumId}`;

  try {
    // profile_id is never proof of authorization by itself — confirm
    // ownership before writing anywhere under it.
    if (profileId !== "self") {
      const memberRes = await firestoreFetch(`/users/${uid}/familyMembers/${profileId}`);
      if (!memberRes.ok) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "This profile does not belong to the signed-in account." }) };
      }
    }

    const now = new Date().toISOString();
    const docName = (p) => `projects/${PROJECT_ID}/databases/(default)/documents${p}`;

    // Atomic idempotent write (correction, 2026-09-10): a single Firestore
    // :commit call, not a sequential read-then-write. The processedEvents
    // marker write below carries `currentDocument: { exists: false }` —
    // Firestore evaluates that precondition and applies every write in
    // this request as one all-or-nothing unit. Because the precondition
    // check and the write happen inside the same atomic commit (this is
    // Firestore's documented commit contract, not something built on top
    // of it), two simultaneous requests carrying the same eventId cannot
    // both succeed: whichever reaches Firestore first wins and creates the
    // marker + summary + log entry together; the other's precondition
    // fails and NONE of its writes apply (not just the marker) — so there
    // is no window where a partial/duplicate write can land. This is the
    // "equivalent atomic operation" the design calls for in place of an
    // explicit beginTransaction/commit pair, which isn't needed here since
    // we never need to read a value first — only to assert non-existence.
    const commitRes = await firestoreFetch(":commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [
          {
            update: {
              name: docName(`${basePath}/processedEvents/${eventId}`),
              fields: { recordedAt: toFirestoreValue(now) },
            },
            currentDocument: { exists: false },
          },
          {
            update: {
              name: docName(basePath),
              fields: {
                curriculumId: toFirestoreValue(curriculumId),
                lastBookId: toFirestoreValue(bookId),
                lastLessonId: toFirestoreValue(lessonId),
                lastSection: toFirestoreValue(section ?? null),
                lastConfidenceSignal: toFirestoreValue(confidenceSignal),
                updatedAt: toFirestoreValue(now),
              },
            },
            updateMask: {
              fieldPaths: ["curriculumId", "lastBookId", "lastLessonId", "lastSection", "lastConfidenceSignal", "updatedAt"],
            },
          },
          {
            // The event id doubles as the home-practice log document id —
            // the cleanest structure that keeps "one genuine attempt = one
            // log entry" true by construction, with no separate id needed.
            update: {
              name: docName(`${basePath}/homePracticeLog/${eventId}`),
              fields: {
                bookId: toFirestoreValue(bookId),
                lessonId: toFirestoreValue(lessonId),
                section: toFirestoreValue(section ?? null),
                completed: toFirestoreValue(completed),
                skillsPracticed: toFirestoreValue(skillsPracticed),
                confidenceSignal: toFirestoreValue(confidenceSignal),
                timestamp: toFirestoreValue(now),
              },
            },
          },
        ],
      }),
    });

    if (!commitRes.ok) {
      // Parse the actual google.rpc.Code out of the response body — never
      // classify from the bare HTTP status alone (see classifyCommitFailure
      // above for exactly why a 400/409 is ambiguous on its own).
      let googleStatus = null;
      try {
        const errJson = await commitRes.json();
        googleStatus = errJson?.error?.status ?? null;
      } catch {
        // Body wasn't parseable JSON — classifyCommitFailure falls back to
        // the HTTP status bucket, still never defaulting to "duplicate".
      }

      const category = classifyCommitFailure(commitRes.status, googleStatus);
      // Full detail server-side only — never forwarded to the client.
      console.error(`record-curriculum-progress commit failed: httpStatus=${commitRes.status} googleStatus=${googleStatus ?? "unknown"} category=${category}`);

      if (category === "duplicate") {
        // Confirmed by Firestore itself: the processedEvents/{eventId}
        // precondition failed because that exact event was already
        // processed. Treated as a successful sync — no further writes, no
        // error shown to the family.
        return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: true }) };
      }
      return errorResponse(category);
    }

    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: false }) };
  } catch (err) {
    if (err instanceof FirestoreConfigError) {
      console.error("record-curriculum-progress config error:", err.message);
      return errorResponse("server_configuration_error");
    }
    if (isNetworkError(err)) {
      console.error("record-curriculum-progress network error:", err.message);
      return errorResponse("retryable");
    }
    // Anything else is an unexpected/unclassified failure — never told to
    // the client as "saved", never leaking err.message/stack to the browser.
    console.error("record-curriculum-progress error:", err.message);
    return errorResponse("server_error");
  }
};

module.exports.validateEvent = validateEvent;
module.exports.isValidEventId = isValidEventId;
module.exports.classifyCommitFailure = classifyCommitFailure;
module.exports.isNetworkError = isNetworkError;
