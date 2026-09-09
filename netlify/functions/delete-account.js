// Account deletion — verifies ID token, wipes Firestore docs, deletes the
// Firebase Auth user itself.
// POST { idToken }
//
// Security/correctness hardening (2026-09-09): two issues fixed here.
// 1. deleteDoc/listSubcollectionDocs previously used a bare API key with no
//    auth token. Under firestore.rules, a request with no auth token has
//    request.auth == null, so these DELETE/GET calls to users/{uid} (which
//    require request.auth.uid == uid) would have been silently denied —
//    meaning account "deletion" may never have actually removed Firestore
//    data. Fixed by authenticating via the service account (_firebaseAdmin.js),
//    which bypasses rules by design.
// 2. The comment above used to say "client handles Auth deletion" — a
//    client-only step that's unreliable if the tab closes or the call is
//    skipped, leaving a "ghost" Auth account with an emptied Firestore
//    profile. This function now deletes the Firebase Auth user itself,
//    server-side, using the same idToken the caller already verified with
//    (Identity Toolkit's accounts:delete accepts a user's own idToken for
//    self-deletion — no service account needed for this specific call).
const { firestoreFetch } = require("./_firebaseAdmin");

const API_KEY = process.env.FIREBASE_API_KEY || "";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function verifyIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) throw new Error("Invalid token");
  const data = await res.json();
  return data.users?.[0]?.localId;
}

async function deleteFirebaseAuthUser(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  return res.ok;
}

async function deleteDoc(path) {
  const res = await firestoreFetch(`/${path}`, { method: "DELETE" });
  return res.ok || res.status === 404;
}

async function listSubcollectionDocs(path) {
  const res = await firestoreFetch(`/${path}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.documents ?? []).map(d => d.name.split("/documents/")[1]);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken } = body;
  if (!idToken) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing idToken" }) };

  try {
    const uid = await verifyIdToken(idToken);
    if (!uid) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Unauthorized" }) };

    // Delete subcollections first
    const subcollections = ["familyMembers", "interactions", "confidenceHistory"];
    for (const sub of subcollections) {
      const docs = await listSubcollectionDocs(`users/${uid}/${sub}`);
      await Promise.all(docs.map(path => deleteDoc(path)));
    }

    // Delete root user document
    await deleteDoc(`users/${uid}`);

    // Log deletion via the service account (Firestore rules already allow
    // any authenticated user to create an adminLogs entry, but using the
    // same authenticated helper as everything else above keeps this one
    // consistent and avoids relying on the idToken still being valid after
    // the Auth user itself is deleted below).
    const now = new Date().toISOString();
    await firestoreFetch("/adminLogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        action:    { stringValue: "account_deleted" },
        uid:       { stringValue: uid },
        deletedAt: { stringValue: now },
      }}),
    }).catch(() => {}); // non-blocking — don't fail the deletion over a log write

    // Delete the Firebase Auth user itself — previously left to the client,
    // which could be skipped (closed tab, network error) and leave a "ghost"
    // Auth account with an emptied Firestore profile.
    const authDeleted = await deleteFirebaseAuthUser(idToken).catch(() => false);
    if (!authDeleted) {
      console.error("ACCOUNT_DELETED_FIRESTORE_ONLY — Auth user deletion failed, uid:", uid);
    }

    console.log("ACCOUNT_DELETED", uid);
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("delete-account error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Deletion failed" }) };
  }
};
