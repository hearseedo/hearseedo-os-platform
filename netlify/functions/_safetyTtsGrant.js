// Safety TTS exemption (2026-09-24) — "safety is never blocked by quota or
// normal usage limits" extends to voice. A safetyToken is only ever
// non-null when chat.js's OWN server-side risk classification fired on
// this exact reply (never a client-assertable claim — see chat.js's grant
// minting and src/lib/claude.js's onMeta plumbing). consumeSafetyGrant
// verifies the grant exists, is unused, and belongs to THIS uid, then
// immediately marks it used via the service-account-authenticated
// firestoreFetch — a client with only the bare Firebase Web API key
// cannot read/rewrite its own `used` field the way it can for the
// deliberately-open chatUsage/ttsUsage counters, so the bypass can't be
// forged or replayed. Single-use, one verified safety reply only — never
// a general voice-limit bypass.
//
// `firestoreFetch` is passed in (not required directly from
// _firebaseAdmin.js) so this module can be unit-tested with a fake
// fetcher, without a real network call or the Firestore emulator.

async function consumeSafetyGrant(firestoreFetch, uid, token) {
  if (!uid || !token || !/^[a-f0-9]{32}$/.test(token)) return false;
  try {
    const path = `/users/${uid}/safetyTtsGrants/${token}`;
    const res = await firestoreFetch(path);
    if (!res.ok) return false;
    const doc = await res.json();
    if (doc.fields?.used?.booleanValue !== false) return false; // missing, already used, or malformed — fail closed
    const markUsed = await firestoreFetch(`${path}?updateMask.fieldPaths=used`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { used: { booleanValue: true } } }),
    });
    return markUsed.ok;
  } catch {
    return false;
  }
}

module.exports = { consumeSafetyGrant };
