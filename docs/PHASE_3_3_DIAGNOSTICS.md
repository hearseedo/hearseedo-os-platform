# Phase 3.3 — Staging `permission-denied` Diagnostics (2026-09-12)

Summary of the three `permission-denied` errors diagnosed on `/family/home`
in Phase 3.3, referenced by several Phase 3.4 code comments. Full diagnosis
was done by cross-referencing every Firestore client call reachable from
`/family/home` against `firestore.rules`; no Firestore emulator was
available in this environment (no Java runtime), so `tests/firestore-rules.test.cjs`
could not be executed — findings below are from static code/rule
cross-reference only.

## 1. `users/{uid}/appProgress/{module}` write — `src/components/AppModal.jsx`

Op: `setDoc`. No allow-rule exists for `appProgress` anywhere in
`firestore.rules`; falls through to the catch-all `allow read, write: if false`.
Already isolated as of the Phase 3.2 commit (`fe15028`) via
`src/lib/progressMessageHandler.js`'s `handleProgressMessage()`, so it never
blocked curriculum-progress recording — only a sanitized `console.warn`.
**This is the known legacy `appProgress` write.**

Confirmed via full-repo grep: nothing anywhere reads `appProgress`. Removed
outright in Phase 3.4 (see `docs/PHASE_3_4_DATA_MODEL.md`).

## 2. `learnerProfiles/{uid}` create — `src/lib/learnerProfile.js`'s `initLearnerProfile()`

Called unconditionally on every sign-in from `src/hooks/useAuth.jsx`, with
**no `.catch()` anywhere** — a genuine unhandled-promise-rejection, not a
swallowed warning like #1. `firestore.rules` denies all client writes to
`learnerProfiles/{uid}` (`allow write: if false`); the rule's own comment
claims a server-side writer exists via `/api/intelligence`/`/api/chat`, but
no such write exists in this codebase (`/api/intelligence` has a dead
`netlify.toml` redirect to a function file that doesn't exist; `chat.js`
never touches `learnerProfiles`). Not the known `appProgress` write —
distinct collection, distinct function, distinct failure mode.

Fixed in Phase 3.4: `initLearnerProfile()` removed; profile creation is now
on-demand and server-side (`record-engagement-event.js`).

## 3. `learnerProfiles/{uid}` (+ `interactions`, `confidenceHistory`) writes — `src/lib/appEvents.js`'s `processAppEvent()`

Called from `AppModal.jsx`'s `HSD_OS_PROGRESS` handler on every Family
iframe-app interaction. Three denied writes per event: `updateDoc` on
`learnerProfiles/{uid}`, `setDoc` on `learnerProfiles/{uid}/interactions/{id}`,
`setDoc` on `learnerProfiles/{uid}/confidenceHistory/{date}` — same
`write: if false` rule as #2. Caught internally
(`catch (err) { console.error(...) }`), so it never blocked the user-facing
flow or curriculum-position tracking (which already went through the
server-authenticated `record-curriculum-progress.js` independently and was
unaffected) — but it meant generic engagement/skill/confidence tracking for
every Family activity silently never worked, and (separately) always
attributed whatever it would have written to the PARENT's uid rather than
the specific child profile that generated the event.

Fixed in Phase 3.4: `processAppEvent()` now calls the server-authenticated
`record-engagement-event.js`, which writes to the correct
self-vs-child-scoped location. See `docs/PHASE_3_4_DATA_MODEL.md`.

## Also noted, out of scope for Phase 3.4

`src/lib/learnerProfile.js`'s `updateProfileAfterChat()`, `refreshRecommendations()`,
and `updateSkill()` also write to `learnerProfiles/{uid}`/`interactions` and
would fail the same way if ever called — but a full-repo grep found zero
callers of any of the three. Left untouched (dead code, not part of any
active error path); flagged here for a future cleanup pass.

The hardcoded-English `AccountLoadError` screen
(`src/components/PathwayRoute.jsx`) found during Phase 3.3 verification was
localized in Phase 3.4.
