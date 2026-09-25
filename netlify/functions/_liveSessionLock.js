// Talk with Jona (Gemini Live) — one-active-session-per-account
// concurrency lock (2026-09-25). Shared by live-token.js (acquire, before
// minting) and live-session-end.js (release, on every end path). Real
// atomicity via _firebaseAdmin.js's createIfAbsent :commit precondition,
// not a read-then-write race — two devices racing to start Live
// simultaneously cannot both succeed.
const { firestoreFetch, createIfAbsent, deleteDoc } = require("./_firebaseAdmin");

const LOCK_PATH = (uid) => `/users/${uid}/liveActiveSession/current`;

// A stale lock (past its expiresAt — set to maxSessionSeconds + a grace
// window at acquire time) is cleared before re-attempting, so a crashed
// tab/browser close/network loss can never leave an account permanently
// locked out, even if live-session-end.js's own release call never runs.
async function acquireSessionLock(uid, sessionId, maxSessionSeconds) {
  const path = LOCK_PATH(uid);
  try {
    const res = await firestoreFetch(path);
    if (res.ok) {
      const doc = await res.json();
      const expiresAtStr = doc.fields?.expiresAt?.timestampValue;
      const expiresAt = expiresAtStr ? new Date(expiresAtStr).getTime() : 0;
      if (expiresAt > Date.now()) {
        return false; // a real, still-valid lock held by another device
      }
      await deleteDoc(path).catch(() => {});
    }
  } catch { /* treat as absent and attempt to acquire below */ }

  const graceSeconds = 30;
  const expiresAt = new Date(Date.now() + (maxSessionSeconds + graceSeconds) * 1000).toISOString();
  return createIfAbsent(path, {
    sessionId: { stringValue: sessionId },
    startedAt: { timestampValue: new Date().toISOString() },
    expiresAt: { timestampValue: expiresAt },
  });
}

// Only releases the lock if it's still this exact session's lock — never
// touches a newer session's lock (e.g. a late/duplicate end call for a
// session that already expired and was superseded).
async function releaseSessionLockIfOwned(uid, sessionId) {
  const path = LOCK_PATH(uid);
  try {
    const res = await firestoreFetch(path);
    if (!res.ok) return;
    const doc = await res.json();
    if (doc.fields?.sessionId?.stringValue !== sessionId) return;
    await deleteDoc(path);
  } catch (e) {
    console.error("live session lock release failed (non-blocking):", e.message);
  }
}

module.exports = { LOCK_PATH, acquireSessionLock, releaseSessionLockIfOwned };
