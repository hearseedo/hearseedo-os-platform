// Monkeys Unlock — cross-device save sync.
// The sub-app has no client-side Firebase Auth session (same deliberate
// choice as hsd-eiken — see ssoBridge.ts), so it can't write Firestore
// directly under firestore.rules' owner-write model. This function is the
// only writer of users/{uid}/monkeysUnlock/save, authenticated via the same
// idToken + service-account pattern as monkeys-evaluate.js / eiken-evaluate.js.
//
// The save blob (current world/room, inventory, unlocked costumes, XP) is
// opaque game state, not something Firestore needs to query into — it's
// stored as a single JSON string field rather than mapped to typed Firestore
// fields, so the engine's save shape can evolve without touching this file.
//
// GET  /api/monkeys-save?idToken=...          -> { state: <parsed JSON | null> }
// POST /api/monkeys-save { idToken, state }   -> { ok: true }

const { firestoreFetch, verifyIdToken, toFirestoreFields, fromFirestoreFields } = require("./_firebaseAdmin");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function ok(payload) {
  return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify(payload) };
}
function fail(statusCode, error) {
  return { statusCode, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error }) };
}

const MAX_STATE_BYTES = 200_000; // generous headroom over Firestore's 1MiB doc limit

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  if (event.httpMethod === "GET") {
    const idToken = event.queryStringParameters?.idToken;
    if (!idToken) return fail(401, "Authentication required.");

    let uid;
    try { uid = await verifyIdToken(idToken); }
    catch (e) { console.error("monkeys-save auth error:", e.message); return fail(401, "Invalid session. Please sign in again."); }

    try {
      const res = await firestoreFetch(`/users/${uid}/monkeysUnlock/save`);
      if (!res.ok) return ok({ state: null });
      const doc = await res.json();
      const fields = fromFirestoreFields(doc.fields);
      const state = fields.state ? JSON.parse(fields.state) : null;
      return ok({ state });
    } catch (e) {
      console.error("monkeys-save read error:", e.message);
      return fail(500, "Could not load save.");
    }
  }

  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); }
    catch { return fail(400, "Invalid JSON"); }

    const { idToken, state } = body;
    if (!idToken) return fail(401, "Authentication required.");
    if (state === undefined) return fail(400, "state is required");

    let uid;
    try { uid = await verifyIdToken(idToken); }
    catch (e) { console.error("monkeys-save auth error:", e.message); return fail(401, "Invalid session. Please sign in again."); }

    const serialized = JSON.stringify(state);
    if (Buffer.byteLength(serialized, "utf8") > MAX_STATE_BYTES) {
      return fail(413, "Save state too large.");
    }

    try {
      const fields = toFirestoreFields({ state: serialized, updatedAt: new Date().toISOString() });
      const mask = ["state", "updatedAt"].map(f => `updateMask.fieldPaths=${f}`).join("&");
      const res = await firestoreFetch(`/users/${uid}/monkeysUnlock/save?${mask}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      if (!res.ok) throw new Error(await res.text());
      return ok({ ok: true });
    } catch (e) {
      console.error("monkeys-save write error:", e.message);
      return fail(500, "Could not save.");
    }
  }

  return fail(405, "Method not allowed");
};
