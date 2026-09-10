// HSD OS AI — server-authenticated curriculum-progress recorder (Phase A/B
// security correction #4/#5, 2026-09-10).
//
// Replaces the client-SDK write in src/family/curriculumProgress.js. The
// browser can no longer write curriculumProgress directly (see
// firestore.rules — write: if false there now); every write goes through
// this function instead, so every field is validated against V2's real
// curriculum ids (_curriculumIds.js) before anything reaches Firestore.
const { verifyIdToken, firestoreFetch, PROJECT_ID, toFirestoreValue, fromFirestoreFields } = require("./_firebaseAdmin");
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
      // A failed-precondition here means the processedEvents marker already
      // existed — i.e. this exact eventId was already processed (either a
      // genuine prior success, or we lost a race to a concurrent identical
      // request). Either way the correct response is the same: report the
      // duplicate, write nothing further. Any other failure is a real error.
      if (commitRes.status === 409 || commitRes.status === 400) {
        return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: true }) };
      }
      const errText = await commitRes.text().catch(() => "");
      throw new Error(`Firestore commit failed (${commitRes.status}): ${errText}`);
    }

    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: false }) };
  } catch (err) {
    console.error("record-curriculum-progress error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to record progress." }) };
  }
};

module.exports.validateEvent = validateEvent;
module.exports.isValidEventId = isValidEventId;
