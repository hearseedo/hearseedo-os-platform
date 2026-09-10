// HSD OS AI — server-authenticated classroom-position lookup (Phase A/B
// security correction #3, 2026-09-10).
//
// Replaces direct client reads of the `classes` collection (which would let
// any signed-in stranger enumerate every class's roster/uid/teacher). This
// function verifies the caller's own identity, confirms the requested
// profile actually belongs to them, and returns ONLY that one learner's
// resolved book/lesson — never the roster, never other users' data, never
// unrelated class documents. Uses the service account (_firebaseAdmin.js)
// to read `classes`, which the browser can no longer read directly (see
// firestore.rules — classes is admin-only client read now).
const { verifyIdToken, firestoreFetch, fromFirestoreFields, fromFirestoreValue } = require("./_firebaseAdmin");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken, profileId } = body;
  if (!idToken)  return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  if (!profileId || typeof profileId !== "string") {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "profileId is required." }) };
  }

  let uid;
  try {
    uid = await verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
  }

  try {
    // profile_id is never proof of authorization by itself — confirm the
    // requested profile actually belongs to THIS verified uid before doing
    // anything with it. "self" always belongs to the account holder; any
    // other id must be a real familyMembers doc under this uid.
    if (profileId !== "self") {
      const memberRes = await firestoreFetch(`/users/${uid}/familyMembers/${profileId}`);
      if (!memberRes.ok) {
        return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "This profile does not belong to the signed-in account." }) };
      }
    }

    const learnerKey = `${uid}:${profileId}`;
    const queryRes = await firestoreFetch(":runQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "classes" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "learnerKeys" },
              op: "ARRAY_CONTAINS",
              value: { stringValue: learnerKey },
            },
          },
          limit: 1,
        },
      }),
    });
    if (!queryRes.ok) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Lookup failed." }) };
    }
    const rows = await queryRes.json();
    const match = rows.find(r => r.document);
    if (!match) {
      // Not in any class — a completely normal state, not an error.
      return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ classroomPosition: null }) };
    }

    const cls = fromFirestoreFields(match.document.fields ?? {});
    // Deliberately minimal — never the roster, never teacherUid, never other
    // learners' keys, only what HSD Family's routing actually needs.
    const classroomPosition = {
      bookId: cls.currentBookId ?? null,
      lessonId: cls.currentLessonId ?? null,
      className: cls.name ?? null,
    };
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ classroomPosition }) };
  } catch (err) {
    console.error("get-classroom-position error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Lookup failed." }) };
  }
};
