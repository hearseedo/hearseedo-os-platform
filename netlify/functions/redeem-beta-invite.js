// HSD Family — private beta invite redemption (Phase 4, item 2/3).
//
// NOT a second authorization system: this writes the SAME pathwayAccess
// field the Phase 1 resolver (src/lib/pathwayAccess.js) already reads,
// through the SAME service-account-authenticated write pattern every other
// privileged-field write already uses (redeem-access-code.js,
// migrate-pathway-access.js). Beta access is granted server-side only —
// there is no client path that can set pathwayAccess.family (see
// firestore.rules: privilegedUserFields()).
//
// Invite codes live in betaInvites/{code} (admin-created via the console or
// a small script — no admin UI for creating them yet, deliberately kept out
// of scope for a 20-30 family beta). Each doc: { status: "unused"|"used",
// familyLabel, createdAt, usedByUid, usedAt }.
const { verifyIdToken, firestoreFetch, fromFirestoreFields, toFirestoreValue } = require("./_firebaseAdmin");

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

  const code = (body.code || "").trim().toUpperCase();
  if (!body.idToken) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  if (!code)         return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Code is required." }) };

  let uid;
  try {
    uid = await verifyIdToken(body.idToken);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
  }

  try {
    const inviteRes = await firestoreFetch(`/betaInvites/${code}`);
    if (!inviteRes.ok) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: "invalid" }) };
    }
    const invite = fromFirestoreFields((await inviteRes.json()).fields ?? {});
    if (invite.status !== "unused") {
      return { statusCode: 409, headers: CORS, body: JSON.stringify({ success: false, error: invite.status === "used" ? "already_used" : "invalid" }) };
    }

    // Read existing pathwayAccess so we ADD family, never clobber other
    // pathways the account may already have (adult, etc.).
    const userRes = await firestoreFetch(`/users/${uid}`);
    const existing = userRes.ok ? fromFirestoreFields((await userRes.json()).fields ?? {}) : {};
    const pathwayAccess = { ...(existing.pathwayAccess ?? {}), family: { source: "beta_invite", grantedAt: new Date().toISOString(), inviteCode: code } };

    const write = await firestoreFetch(`/users/${uid}?updateMask.fieldPaths=pathwayAccess`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { pathwayAccess: toFirestoreValue(pathwayAccess) } }),
    });
    if (!write.ok) {
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to grant access." }) };
    }

    // Mark the invite consumed — one invite, one account, no reuse.
    await firestoreFetch(`/betaInvites/${code}?updateMask.fieldPaths=status&updateMask.fieldPaths=usedByUid&updateMask.fieldPaths=usedAt`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: {
        status: { stringValue: "used" },
        usedByUid: { stringValue: uid },
        usedAt: { stringValue: new Date().toISOString() },
      } }),
    }).catch(() => {});

    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error("redeem-beta-invite error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Redemption failed." }) };
  }
};
