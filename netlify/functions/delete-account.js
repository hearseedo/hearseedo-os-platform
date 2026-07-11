// Account deletion — verifies ID token, wipes Firestore docs, client handles Auth deletion.
// POST { idToken }

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const API_KEY    = process.env.FIREBASE_API_KEY    || "";
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

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

async function deleteDoc(path) {
  const res = await fetch(`${FS_BASE}/${path}?key=${API_KEY}`, { method: "DELETE" });
  return res.ok || res.status === 404;
}

async function listSubcollectionDocs(path) {
  const res = await fetch(`${FS_BASE}/${path}?key=${API_KEY}`);
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

    // Log deletion — pass user's idToken as Bearer so Firestore rules allow the write
    const now = new Date().toISOString();
    await fetch(
      `${FS_BASE}/adminLogs?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ fields: {
          action:    { stringValue: "account_deleted" },
          uid:       { stringValue: uid },
          deletedAt: { stringValue: now },
        }}),
      }
    );

    console.log("ACCOUNT_DELETED", uid);
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error("delete-account error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Deletion failed" }) };
  }
};
