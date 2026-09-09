// Phase 1 lazy migration (Stage C) — computes and writes pathwayAccess for
// an existing account that doesn't have one yet, exactly once. Idempotent:
// if pathwayAccess is already present (even as an empty object), this is a
// no-op — it never overwrites an existing value, whether that value was
// set by this same migration, an admin, or a future entitlement flow.
//
// pathwayAccess is a privileged field (firestore.rules) — this must write
// via the service account, not the caller's own idToken.
const { verifyIdToken, firestoreFetch, fromFirestoreFields, toFirestoreValue } = require("./_firebaseAdmin");
const { inferLegacyPathways } = require("./_pathwayAccess");

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

  if (!body.idToken) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  }
  let uid;
  try {
    uid = await verifyIdToken(body.idToken);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
  }

  try {
    const res = await firestoreFetch(`/users/${uid}`);
    if (!res.ok) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ migrated: false, reason: "account_not_found" }) };
    }
    const doc = await res.json();
    const account = fromFirestoreFields(doc.fields ?? {});

    if (account.pathwayAccess !== undefined) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ migrated: false, reason: "already_present" }) };
    }

    const inferred = inferLegacyPathways(account);
    const pathwayAccess = {};
    for (const id of inferred) pathwayAccess[id] = { source: "legacy_migration", grantedAt: new Date().toISOString() };

    const write = await firestoreFetch(`/users/${uid}?updateMask.fieldPaths=pathwayAccess`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ fields: { pathwayAccess: toFirestoreValue(pathwayAccess) } }),
    });

    if (!write.ok) {
      const err = await write.text();
      console.error("migrate-pathway-access write failed:", write.status, err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Migration write failed." }) };
    }

    console.log("PATHWAY_ACCESS_MIGRATED", uid, inferred);
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ migrated: true, pathwayAccess: inferred }) };
  } catch (err) {
    console.error("migrate-pathway-access error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Migration failed." }) };
  }
};
