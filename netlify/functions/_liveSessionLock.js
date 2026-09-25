// Talk with Jona (Gemini Live) — one-active-session-per-account
// concurrency lock (2026-09-25, revised same day — see
// docs/JONA_LIVE_LOCK_RECOVERY_2026-09-25.md). Shared by live-token.js
// (acquire, before minting), TalkWithJona.jsx via live-session-heartbeat.js
// (periodic renew, while a session is genuinely alive), and
// live-session-end.js (release, on every clean end path). Real atomicity
// on acquire via _firebaseAdmin.js's createIfAbsent :commit precondition,
// not a read-then-write race — two devices racing to start Live
// simultaneously cannot both succeed.
//
// REVISION NOTE: the lock originally held for a flat
// "maxSessionSeconds + 30s" (up to 5.5 minutes) regardless of whether the
// client was still actually connected, so an abnormal disconnect (tab
// closed, network dead, crash) could leave an account unable to start a
// new session for that whole window. It's now a SHORT lease (~75s,
// config/liveBetaPolicy.lockLeaseSeconds) that a live client must renew
// periodically (~every 20s) — an orphaned lock self-expires within about
// one lease window of the last real heartbeat, not up to 5.5 minutes.
const { firestoreFetch, createIfAbsent, deleteDoc } = require("./_firebaseAdmin");

const LOCK_PATH = (uid) => `/users/${uid}/liveActiveSession/current`;

// A stale lock (past its expiresAt) is cleared before re-attempting, so a
// crashed tab/browser close/network loss can never leave an account
// permanently locked out, even if nothing ever renews or releases it.
async function acquireSessionLock(uid, sessionId, leaseSeconds) {
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

  const expiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
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

// Extends expiresAt for a still-alive session's own lock — called
// periodically by live-session-heartbeat.js. Only ever extends a lock
// this exact sessionId already owns (same ownership check as release);
// never creates a new lock and never touches a different session's lock.
// Returns true if renewed, false if this session no longer owns the lock
// (already released, expired and reclaimed by someone else, etc.) — the
// caller should stop heartbeating and treat the session as ended if so.
async function renewSessionLock(uid, sessionId, leaseSeconds) {
  const path = LOCK_PATH(uid);
  try {
    const res = await firestoreFetch(path);
    if (!res.ok) return false;
    const doc = await res.json();
    if (doc.fields?.sessionId?.stringValue !== sessionId) return false;
    const expiresAt = new Date(Date.now() + leaseSeconds * 1000).toISOString();
    const startedAt = doc.fields?.startedAt?.timestampValue ?? new Date().toISOString();
    await firestoreFetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: { sessionId: { stringValue: sessionId }, startedAt: { timestampValue: startedAt }, expiresAt: { timestampValue: expiresAt } } }),
    });
    return true;
  } catch (e) {
    console.error("live session lock renew failed (non-blocking):", e.message);
    return false;
  }
}

module.exports = { LOCK_PATH, acquireSessionLock, releaseSessionLockIfOwned, renewSessionLock };
