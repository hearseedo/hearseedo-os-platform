// Authenticated read/write endpoint for EIKEN Monkey progress data.
// Uses the shared _firebaseAdmin.js REST helper (JWT-signed service-account
// OAuth2 token, split across FIREBASE_SA_KEY_A/B) so writes succeed
// regardless of Firestore security rules (learnerProfiles/{uid} correctly
// denies direct client writes — this endpoint is the trusted server-side
// path around that). Not using the firebase-admin SDK/a single JSON
// credential env var: that approach blew past AWS Lambda's 4KB per-function
// env var limit combined with this site's other env vars and broke deploys.
//
// POST { idToken, memberId?, op: "init"|"get"|"update"|"logRecord", data?, collection?, docId? }
//
// Individual accounts (no memberId) write into the shared learnerProfiles/{uid}
// doc — the platform's existing cross-app confidence/skills system — but only
// ever merge the `eiken` namespace and `skills` map, never other fields.
// Family accounts (memberId set) write into a dedicated per-child doc at
// users/{uid}/familyMembers/{memberId}/eikenProfile/current, mirroring the
// existing familyMembers/{memberId}/learningPath/current convention used
// elsewhere in this codebase.
//
// logRecord writes to one of a fixed set of subcollections under the profile
// doc (interactions/eikenPlacementResults/eikenMockAttempts/eikenAchievements/
// monkeyPartySessions) — genuinely separate record types, matching the
// existing interactions/confidenceHistory precedent from the platform-wide
// learnerProfile.js.
// Pass docId to upsert a specific document (e.g. achievement id, so repeat
// unlock checks don't create duplicates); omit it for an auto-id append log
// (placement attempts, mock attempts, interactions).

const {
  firestoreFetch, verifyIdToken,
  toFirestoreFields, fromFirestoreFields,
} = require("./_firebaseAdmin");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_SKILLS = {
  vocabulary: 50, grammar: 50, pronunciation: 50, speaking: 50,
  listening: 50, reading: 50, writing: 50, interview: 50, mindset: 50,
};

const DEFAULT_EIKEN = {
  grade: null, gradeUnlocked: [], missionsCompleted: 0, lastLessonAt: null, readinessScore: 0,
};

const ALLOWED_COLLECTIONS = ["interactions", "eikenPlacementResults", "eikenMockAttempts", "eikenAchievements", "monkeyPartySessions"];

function ok(payload) {
  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}
function fail(statusCode, error, extra = {}) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error, ...extra }) };
}

// Individual accounts share learnerProfiles/{uid} with every other app —
// never let an EIKEN write clobber unrelated platform-wide profile fields.
function namespaceForSharedProfile(data) {
  const patch = {};
  if (data.eiken)  patch.eiken  = data.eiken;
  if (data.skills) patch.skills = data.skills;
  return patch;
}

function profilePath(uid, memberId) {
  return memberId
    ? `/users/${uid}/familyMembers/${memberId}/eikenProfile/current`
    : `/learnerProfiles/${uid}`;
}

async function getDocument(path) {
  const res = await firestoreFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET failed: ${await res.text()}`);
  const doc = await res.json();
  return fromFirestoreFields(doc.fields);
}

// PATCH with updateMask = a merge-set over the given top-level field keys
// (Firestore REST's equivalent of the SDK's `.set(data, {merge:true})`).
async function mergeSet(path, data) {
  const maskParams = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
  const res = await firestoreFetch(`${path}?${maskParams}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore PATCH failed: ${await res.text()}`);
}

// POST to a collection path — Firestore REST auto-generates the document id.
async function addDocument(collectionPath, data) {
  const res = await firestoreFetch(collectionPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore POST failed: ${await res.text()}`);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return fail(405, "Method not allowed");

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return fail(400, "Invalid JSON"); }

  const { idToken, memberId, op, data, collection, docId } = body;
  if (!idToken || !op) return fail(400, "idToken and op required");

  let uid;
  try {
    uid = await verifyIdToken(idToken);
  } catch (e) {
    console.error("eiken-progress auth error:", e.message);
    return fail(401, "Invalid session. Please sign in again.");
  }

  const path = profilePath(uid, memberId);
  const isSharedProfile = !memberId;
  const now = new Date().toISOString();

  try {
    if (op === "get") {
      const profile = await getDocument(path);
      return ok({ profile });
    }

    if (op === "init") {
      const existing = await getDocument(path);
      if (!existing) {
        const defaults = isSharedProfile
          ? { eiken: DEFAULT_EIKEN, skills: DEFAULT_SKILLS, updatedAt: now }
          : { eiken: DEFAULT_EIKEN, skills: DEFAULT_SKILLS, createdAt: now };
        await mergeSet(path, defaults);
        return ok({ profile: defaults });
      }
      return ok({ profile: existing });
    }

    if (op === "update") {
      if (!data || typeof data !== "object") return fail(400, "data object required");
      const patch = isSharedProfile ? namespaceForSharedProfile(data) : data;
      await mergeSet(path, { ...patch, updatedAt: now });

      // Denormalize a small summary onto users/{uid} so the Admin dashboard's
      // existing users listener can show EIKEN status without a second query.
      // Individual accounts only — family children don't have their own
      // users/{uid} doc to denormalize onto (same limitation as ParentView).
      if (isSharedProfile && data.eiken) {
        mergeSet(`/users/${uid}`, {
          eikenSummary: {
            grade: data.eiken.grade ?? null,
            readinessScore: data.eiken.readinessScore ?? 0,
            lastActive: now,
          },
        }).catch((e) => console.error("eiken-progress summary sync error:", e.message));
      }

      return ok({ success: true });
    }

    if (op === "logInteraction") {
      if (!data || typeof data !== "object") return fail(400, "data object required");
      await addDocument(`${path}/interactions`, { ...data, timestamp: now });
      return ok({ success: true });
    }

    if (op === "logRecord") {
      if (!data || typeof data !== "object") return fail(400, "data object required");
      const targetCollection = collection || "interactions";
      if (!ALLOWED_COLLECTIONS.includes(targetCollection)) return fail(400, `Unknown collection: ${targetCollection}`);

      if (docId) {
        await mergeSet(`${path}/${targetCollection}/${encodeURIComponent(String(docId))}`, { ...data, updatedAt: now });
      } else {
        await addDocument(`${path}/${targetCollection}`, { ...data, timestamp: now });
      }

      // Denormalize a small Monkey Party summary onto users/{uid} — same
      // reasoning as the eikenSummary sync above: cheap for the admin table
      // to read without a second live query per row. Individual accounts only.
      if (isSharedProfile && targetCollection === "monkeyPartySessions") {
        mergeSet(`/users/${uid}`, {
          monkeyPartySummary: {
            lastGameMode: data.gameMode ?? null,
            lastTopic: data.topic ?? null,
            lastScore: data.totalScore ?? 0,
            lastPlayedAt: now,
          },
        }).catch((e) => console.error("eiken-progress monkeyParty summary sync error:", e.message));
      }

      return ok({ success: true });
    }

    return fail(400, `Unknown op: ${op}`);
  } catch (err) {
    console.error("eiken-progress error:", err.message);
    return fail(500, "Failed to save progress.");
  }
};
