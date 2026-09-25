# Talk with Jona — Concurrency-Lock Orphan Recovery Fix

**Date:** 2026-09-25
**Status:** Deployed. Server-side change only where possible; the concurrency guarantee itself is unchanged.

## The problem

The one-active-session-per-account lock (`users/{uid}/liveActiveSession/current`) originally held for a flat `maxSessionSeconds + 30s` (up to 5.5 minutes) from the moment it was acquired, regardless of whether the client that acquired it was still actually connected. If a session ended abnormally — tab closed, network dropped, device slept, browser crashed — without `live-session-end.js` successfully releasing the lock, the account couldn't start a new Talk with Jona session until that full window elapsed. Confirmed via production Firestore inspection: a lock acquired at 11:08:00 UTC blocked a retry until it self-expired at 11:13:30 UTC.

## Two root causes, not one

1. **The lock release itself was fire-and-forget.** `live-session-end.js` called `releaseSessionLockIfOwned(uid, sessionId).catch(() => {})` without `await`. A serverless function's execution environment can be frozen or torn down immediately after the HTTP response is returned — an un-awaited promise has no guarantee of completing first. This meant even a *clean* end (user tapped "End conversation") could sometimes fail to release the lock in time. **Fixed: this call is now awaited** before the response returns.
2. **A hard tab close doesn't reliably run cleanup in time.** React's unmount effect cleanup, and the `fetch()` inside it, can be interrupted by the browser tearing down the page before the request completes. There was no dedicated handling for "the user just closed the tab."

## The fix

- **`live-session-end.js`** now awaits the lock release (see above) — the single highest-impact fix, since it means every *clean* end path (user_end, idle_timeout, session_limit, profile_switch, logout, route_change) now reliably releases the lock immediately, not just "usually."
- **A `pagehide` listener** in `TalkWithJona.jsx` calls `endSession("route_change")` when the tab is closed or navigated away outright — `pagehide` fires reliably in this case (unlike `beforeunload`, which is unreliable on mobile Safari and increasingly restricted by browsers).
- **`reportEnd`'s fetch now uses `keepalive: true`**, so the release request has a real chance to reach the server even as the page is torn down.
- **The lock is now a short, renewable lease instead of a long fixed hold.** `config/liveBetaPolicy` gained `lockLeaseSeconds` (default 75) and `heartbeatIntervalSeconds` (default 20). `live-token.js` acquires the lock with a 75-second lease, not `maxSessionSeconds + 30s`. A new endpoint, **`live-session-heartbeat.js`**, is called by the client every ~20 seconds while a session is genuinely open, extending the lease. `_liveSessionLock.js` gained `renewSessionLock()` for this — it only ever extends a lock the calling session already owns (same ownership check as release), never creates a new one.

## Why this is safe (doesn't allow two genuinely active sessions)

The three mechanisms work together, not as alternatives:
- If a session ends **cleanly** (any of the 6+ normal reasons), the lock releases **immediately** (fixed root cause #1) — the heartbeat/lease timing never even comes into play.
- If the client is **still alive** but the tab is being closed, `pagehide` + `keepalive` gives the clean-end path a real chance to fire anyway.
- If the client **genuinely disappears** without any of the above completing (crash, force-quit, device sleep, hard network loss) — the only case left — the lock now self-expires within about one lease window (~75s) of the **last successful heartbeat**, not up to 5.5 minutes. A session that's still genuinely running keeps renewing its own lease every 20s, so it is never at risk of losing its own lock to this mechanism; only a session that has actually stopped sending heartbeats (because the client is gone) loses it.

## Cost

The heartbeat is a single small Firestore read+write per call, no Gemini API involvement at all, called at most every ~20 seconds for a session that runs at most ~5 minutes (≈15 calls/session worst case). Negligible.

## What did NOT change

The Gemini Live model, voice, barge-in behavior, the floating Jona UX, monthly allowance, 5-minute session maximum, daily session limit, the *existence* of the concurrency lock, Ask Jona, and the safety architecture are all untouched. The server remains fully authoritative for whether a session may start.
