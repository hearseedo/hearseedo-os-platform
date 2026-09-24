# Profile Switcher UX Proposal + Sip Speak Learn Storage Audit

**Date:** 2026-09-24
**Status:** Design/audit only, per Jonathan's instruction — profile switcher not built, Sip Speak Learn storage not changed.

---

## Part 1 — Sip Speak Learn storage audit

**Storage technology:** localStorage only, no Firestore. No `memory.js`-equivalent exists for Sip Speak Learn — it has no persistent Jona/AI memory doc the way Career Ready / Global Ready / Speak Ready do. That makes this simpler to migrate than the other three, not harder: there's no Firestore rules change needed at all, only the localStorage-key change.

**Key functions** (`src/sipSpeakLearn/storage.js`):
```
PROGRESS_KEY    = (uid) => `ssl_progress_${uid || "guest"}`
EXPRESSIONS_KEY = (uid) => `ssl_expressions_${uid || "guest"}`
```
Same shape as Career/Global/Speak Ready's storage.js — `getProgress`, `markLessonStarted`, `markLessonCompleted`, `addSpeakingSeconds`, `recordConversationDone`, `recordConfidence`, `setDifficulty`, `recordGamePlayed`, `getSavedExpressions`, `saveExpression`, `removeExpression`, all taking `uid` as the first argument.

**One thing the other three don't have:** a `"guest"` fallback when `uid` is falsy — Sip Speak Learn's storage functions degrade gracefully to a shared `guest` bucket rather than silently no-op'ing. Worth understanding why before migrating (possibly related to Table/Host Mode's `sslEvents`/`sslEventCodes` participant flow, which is a separate, event-code-based feature — not itself part of this progress-storage path, but the "not always definitely signed in" pattern in this app is real and the other three apps don't have it).

**Auth model:** confirmed standard — `src/pages/SipSpeakLearn.jsx` uses `useAuth()` → `user.uid`, same as the others. Not a special/anonymous product mode for the main lesson flow.

**Blast radius:** 4 files import from `storage.js` (`SavedExpressions.jsx`, `Games.jsx`, `Lesson.jsx`, `pages/SipSpeakLearn.jsx`) — smaller than Career/Global/Speak Ready combined (16 files). `Lesson.jsx` already receives both `uid` and `user` as separate props (`const common = { lesson, season, uid, user, difficulty }`), so `user.activeProfileId` is already reachable everywhere `uid` currently flows — no new prop-threading needed.

**Does the EIKEN pattern apply cleanly?** Yes, directly — this is a localStorage-only case, so only the `profileScopedStorageUid(uid, profileId)` half of `src/lib/profileScope.js` (already built) is needed, none of the Firestore-path half. Mechanically the same fix as the three apps already migrated: swap `uid` for `profileScopedStorageUid(uid, user?.activeProfileId)` at each of the ~15-20 call sites inside those 4 files, add the import, done. I'd estimate this is the smallest of the four migrations.

**Recommendation:** safe to include in the next pass whenever you give the go-ahead — no open design questions, no rules changes, no data-migration risk beyond what's already proven for the other three apps.

---

## Part 2 — Profile switcher UX proposal (design only, not built)

### Placement

A small `{name} 👤 ▾` control in the same header row that already exists on Family/Student/Adult Home — replacing (not adding to) the plain "Hi, {name} 👋" text just shipped, so it doesn't add a second thing to look at. Concretely:

```
┌────────────────────────────────────────────┐
│ ← Switch pathway            Emma  👤 ▾      │   <- header row, existing pattern
│                                              │
│   HSD STUDENT                               │
│   [pathway content below, unchanged]        │
└────────────────────────────────────────────┘
```

Same control, same position, on Family Home, Student Home, and Adult Home — consistent placement is more important than any one screen's layout being locally "optimal." **Not on Educator**, per your instruction.

### Desktop behavior

- The `{name} 👤 ▾` text is a button. Click opens a small anchored dropdown (not a modal, not a new page) directly below it, right-aligned to the header.
- Dropdown lists every profile from `profiles` (already computed by `useAuth()`) — each row shows the profile's name and a small pathway-colored dot/badge (using the same accent colors `PATHWAYS[id].accent.primary` already defines), current profile shown checked/highlighted.
- Selecting a different profile: closes the dropdown, writes `activeProfileId` (existing, already self-writable field), and the page's own data re-renders from the new `currentProfile` — no navigation, no reload, no new screen. (Whether it also jumps to a different pathway's Home is explicitly **not** part of this — `defaultPathway` is on hold per your instruction, so switching profiles for now just changes identity/context on the *current* pathway's Home; if the new profile can't access that pathway, `PathwayRoute`'s existing access-gate logic already handles that redirect, unmodified.)
- Closes on outside click / Escape, standard dropdown behavior.

### Mobile behavior

- Same control, same position — the header row already exists and is already narrow/responsive on these pages (they're already mobile-tested per the FamilyHome/StudentHome/AdultHome pattern).
- Dropdown becomes a bottom sheet instead of an anchored popover (more thumb-reachable, standard mobile pattern, and avoids the awkwardness of a top-right dropdown extending off-screen on a narrow viewport) — full-width, rounded top corners, same row content as desktop (name + pathway badge + checkmark for current).
- Large enough tap targets (44px+ row height) — directly relevant to your "difficult for a young child to accidentally misuse" requirement: a young child using an Elementary/Early Years profile is very unlikely to be the one operating this control in the first place (a parent typically hands the device over already on the right profile), but if they do tap it, nothing destructive happens — it only ever switches to another profile *this account already authorized*, never creates, deletes, or exposes anything new.

### Accidental-misuse safeguards

- No delete/remove action lives in this control at all — it's read/select only. Managing profiles (add/edit/remove) stays wherever that already happens today (Family's existing child-profile management), not folded into this switcher.
- Switching to a profile that then can't access the current app/pathway fails safe into the existing `LockedView`/`PathwayRoute` gating — never a broken or blank screen.
- No confirmation dialog needed for a plain switch (low-stakes, instantly reversible by switching back) — consistent with your "subtle enough not to clutter HSD" instruction; a confirmation step would be the kind of friction the simplicity directive explicitly asked me to remove elsewhere.

### What this does NOT include (intentionally, per your scoping)

- No `defaultPathway` routing on switch (on hold).
- No Educator integration.
- No new "account management" screen — profile creation/editing stays where it already lives.
- No change to billing/allowance display — this control is identity-only, not account/subscription management.

---

## Part 3 — Unexpected dependencies discovered during implementation

Flagging as requested, in case any of these change your prioritization:

1. **A real pre-existing cross-profile data leak, now fixed as part of this work.** Before this change, `claude.js`'s client-built system prompt unconditionally embedded `user.familyMembers.map(...)` — every family member's name, age, and confidence score — into *every* Jona request, regardless of which profile was actually talking. That means, today (pre-fix), a session as Emma could have surfaced Miley's confidence score to Jona's prompt context. This wasn't something the directive named directly, but it's exactly the kind of leak §6 of your last message was asking me to prevent — I removed the whole "Current user context" block from the client and moved profile identity server-side (§6 of this session's implementation) as part of the same change, rather than filing it as a separate task.
2. **Sip Speak Learn's `"guest"` localStorage fallback** (Part 1 above) — not fully explained by anything I read; worth a quick confirmation from you on whether Table/Host Mode ever runs a lesson without a signed-in user, since that shapes whether `profileScopedStorageUid`'s `!uid` case needs special handling there later.
3. **`careerReady`/`globalReady`/`speakReady` top-level Firestore collections are directly client-writable** (`allow read, write: if request.auth != null && request.auth.uid == uid`), unlike EIKEN's fully server-mediated writes. This proposal/implementation kept that same trust level for the new profile-scoped subcollections (consistent, not a new gap) — flagging only because it's a real architectural difference from EIKEN worth knowing about if a future security pass wants everything server-mediated.

---

**Nothing in Part 1 or Part 2 has been implemented.** Part 3 items are informational only, describing what the already-shipped P0 work touched.
