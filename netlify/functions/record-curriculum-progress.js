// HSD OS AI — server-authenticated curriculum-progress recorder (Phase A/B
// security correction #4/#5, 2026-09-10).
//
// Replaces the client-SDK write in src/family/curriculumProgress.js. The
// browser can no longer write curriculumProgress directly (see
// firestore.rules — write: if false there now); every write goes through
// this function instead, so every field is validated against V2's real
// curriculum ids (_curriculumIds.js) before anything reaches Firestore.
const { verifyIdToken, firestoreFetch, toFirestoreValue, fromFirestoreFields } = require("./_firebaseAdmin");
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
  // eventId is the dedup key (correction #5) — required, not optional, so
  // every write path is idempotent by construction, not by convention.
  if (!isShortString(body.eventId)) errors.push("eventId");
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

    // Idempotency (correction #5): eventId names a fixed doc under
    // processedEvents/ — if it already exists, this exact transmission was
    // already handled; return success without writing again or duplicating
    // the home-practice log. A genuinely new attempt gets a different
    // eventId from the client (see docs/CURRICULUM_PROGRESS_ARCHITECTURE.md
    // for exactly how the two are told apart), so real repeat practice is
    // never suppressed — only literal replays of the same transmission are.
    const dedupPath = `${basePath}/processedEvents/${encodeURIComponent(eventId)}`;
    const existing = await firestoreFetch(dedupPath);
    if (existing.ok) {
      return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: true }) };
    }

    // Mark this event processed BEFORE the rest of the writes — if a
    // near-simultaneous retry lands while this request is still in flight,
    // it's better to risk a rare skipped write than a duplicate one.
    await firestoreFetch(dedupPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { recordedAt: toFirestoreValue(new Date().toISOString()) } }),
    });

    await firestoreFetch(`${basePath}?updateMask.fieldPaths=curriculumId&updateMask.fieldPaths=lastBookId&updateMask.fieldPaths=lastLessonId&updateMask.fieldPaths=lastSection&updateMask.fieldPaths=lastConfidenceSignal&updateMask.fieldPaths=updatedAt`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          curriculumId: toFirestoreValue(curriculumId),
          lastBookId: toFirestoreValue(bookId),
          lastLessonId: toFirestoreValue(lessonId),
          lastSection: toFirestoreValue(section ?? null),
          lastConfidenceSignal: toFirestoreValue(confidenceSignal),
          updatedAt: toFirestoreValue(new Date().toISOString()),
        },
      }),
    });

    await firestoreFetch(`${basePath}/homePracticeLog?documentId=${encodeURIComponent(eventId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          bookId: toFirestoreValue(bookId),
          lessonId: toFirestoreValue(lessonId),
          section: toFirestoreValue(section ?? null),
          completed: toFirestoreValue(completed),
          skillsPracticed: toFirestoreValue(skillsPracticed),
          confidenceSignal: toFirestoreValue(confidenceSignal),
          timestamp: toFirestoreValue(new Date().toISOString()),
        },
      }),
    }).catch(() => {}); // best-effort — the summary write above is the one that matters for routing

    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true, duplicate: false }) };
  } catch (err) {
    console.error("record-curriculum-progress error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to record progress." }) };
  }
};

module.exports.validateEvent = validateEvent;
