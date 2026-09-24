# Profile-Scoped Context Migration — Proposal (research/design only)

**Date:** 2026-09-24
**Status:** PROPOSAL ONLY, per Jonathan's instruction. Nothing below has been implemented or migrated. No production Firestore data has been touched.
**Goal:** every HSD experience (Family, Student, Adult — **not Educator**) knows which *profile* is using it, not merely which *account* authenticated, using the account/profile architecture that already exists (`users/{uid}` + `familyMembers` + the synthesized "self" profile) — no second identity system.

**Key discovery that shapes this whole proposal:** EIKEN already solved this exact problem, and it's live, working, in production today. `src/eiken/storage.js` + `netlify/functions/eiken-progress.js` already profile-scope EIKEN's progress: no `memberId` → the legacy shared path (`learnerProfiles/{uid}`), a real `memberId` → `users/{uid}/familyMembers/{memberId}/eikenProfile/current`. This proposal is mostly **"do the same thing EIKEN already does, for Career Ready / Speak Ready / Sip Speak Learn / Jona"** — not a new pattern.

---

## 1. Current relevant Firestore paths

| Data | Current path | Scope today |
|---|---|---|
| Account/membership | `users/{uid}` | account (correct — billing stays here, see §7) |
| Family sub-profiles | `users/{uid}/familyMembers/{memberId}` | already profile-scoped |
| Self profile | synthesized in-memory by `src/lib/profiles.js`'s `buildSelfProfile()` from the account doc's own fields — **not a Firestore doc** | account (this is fine — see §3) |
| EIKEN progress | `users/{uid}/familyMembers/{memberId}/eikenProfile/current` (member) or `learnerProfiles/{uid}` (self) | **already profile-scoped** |
| Career Ready progress | `users/{uid}/careerReady/memory` | **account-only — the gap** |
| Global Ready progress | `users/{uid}/globalReady/{doc}` | **account-only — the gap** |
| Speak Ready progress | (same `users/{uid}/speakReady/...` shape, not yet inspected doc-by-doc but same pattern confirmed via `memory.js`) | **account-only — the gap** |
| Sip Speak Learn progress | not yet inspected in this pass — flagging as needing the same check before implementation | unknown, assume account-only until checked |
| `lastUsedPathway` | `users/{uid}.lastUsedPathway` (single field) | account-level, read in `pathwayAccess.js`, written in `useAuth.jsx`, used by `PathwayEntry.jsx`/`Blueprint.jsx` — small, contained surface (§4) |
| Active profile pointer | `users/{uid}.activeProfileId` | **already exists**, already what `currentProfile` resolves from |

---

## 2. Proposed profile-scoped paths

Mirror EIKEN's existing convention exactly, for consistency and because it's already proven:

- Career Ready: `users/{uid}/familyMembers/{memberId}/careerReadyProfile/current` (member) / `users/{uid}/careerReady/memory` (self, **unchanged**)
- Global Ready: `users/{uid}/familyMembers/{memberId}/globalReadyProfile/current` (member) / `users/{uid}/globalReady/{doc}` (self, **unchanged**)
- Speak Ready: `users/{uid}/familyMembers/{memberId}/speakReadyProfile/current` (member) / existing self path (**unchanged**)
- A new `getProgressPath(uid, activeProfileId)` (or equivalent) helper in each app's own `memory.js`/`storage.js`, taking the same `activeProfileId`/`currentProfile` shape `useAuth()` already provides — no new concept for callers to learn.

Firestore rules addition (small, additive — mirrors the existing `familyMembers/{memberId}/learningPath/{doc}` pattern already in the rules file):
```
match /familyMembers/{memberId} {
  // ...existing...
  match /careerReadyProfile/{doc} { allow read, write: if request.auth != null && request.auth.uid == uid; }
  match /globalReadyProfile/{doc} { allow read, write: if request.auth != null && request.auth.uid == uid; }
  match /speakReadyProfile/{doc}  { allow read, write: if request.auth != null && request.auth.uid == uid; }
}
```

## 3. Stable ID strategy for the synthesized "self" profile

Already solved and already stable: `SELF_PROFILE_ID = "self"` (`src/lib/profiles.js`) is a fixed constant, not derived from anything that could change. Proposal: **keep self as a virtual profile, do not give it a real Firestore doc.** EIKEN's precedent (self → legacy shared path, never `familyMembers/self/...`) is the right model — it means zero migration for every existing single-profile account, forever, since "self" literally never becomes a new path. `activeProfileId` defaults to `"self"` already (confirmed in `useAuth.jsx`).

## 4. Migration strategy for existing Student/Adult progress

**No data moves.** This is the core safety property of the EIKEN-precedent approach:
- An existing account with no family members, or with `activeProfileId === "self"`, keeps reading/writing the exact same path it does today (`users/{uid}/careerReady/memory`, etc.) — completely unaffected.
- A **new** family-member profile using Career Ready for the first time gets a **new**, empty doc at the new scoped path — there's no old data to migrate for a profile that's never used the app before.
- The only real "migration" question is: **does any current account already have a non-"self" family member who has been actively using Career Ready/Speak Ready under the shared account-level path?** If so, that specific profile's history currently lives in the shared doc, indistinguishable from anyone else's. Before implementing, I'd want to check whether this has actually happened in practice (likely rare/zero, since these are pathway-gated single-profile Adult/Student apps, not yet exposed to family-member switching in the UI at all) — if it has, the honest options are (a) leave the shared-doc history attributed to "self" and let the family member start fresh at the new scoped path, or (b) a one-time, explicitly-reviewed copy of that specific account's data. I'd propose (a) by default (simpler, no risk of misattributing history to the wrong person) unless you tell me a specific account needs (b).

## 5. Backward compatibility

- Every existing single-profile account: zero change, same paths, same rules, same reads.
- Every existing multi-profile Family account already using EIKEN this way: zero change (this proposal doesn't touch EIKEN, it copies its pattern).
- Any code that today calls `getMemorySummary(uid)` / `updateMemorySummary(uid, ...)` etc. with just a `uid` needs its call sites updated to also pass the active profile — a mechanical, low-risk change (adding one parameter, defaulting to `SELF_PROFILE_ID` if omitted so nothing breaks if a call site is missed).

## 6. Jona profile-context changes

Server-side (this is the part with a real security requirement, see §10):
- `chat.js` currently trusts `profileId` as "purely descriptive logging metadata... NEVER used for auth or quota decisions" (existing comment, still correct for quota) — but per your instruction, once `profileId` is used to *select which profile's context Jona sees*, the backend must verify that profile actually belongs to the caller's verified `uid` before trusting any of its data (name/level/progress). Today nothing does this lookup at all — `buildContextLine()` only receives whatever the client already assembled and sends as `context`.
- Proposed addition to `chat.js`: when a `profileId` other than `"self"` is supplied, look it up server-side at `users/{uid}/familyMembers/{profileId}` (using the already-imported `firestoreFetch`) and only use its `name`/`ageBand`/`confidenceScore`/etc. if that document actually exists under *this* verified uid. If the lookup fails (wrong owner, doesn't exist, malformed id), fall back to the account-level "self" context rather than trusting the client's claim — never silently proceed with unverified profile data.
- `buildSystemWithContext(user, lang)` in `claude.js` would need a third input — the resolved, server-trusted profile — rather than always using `user.name`/`user.confidenceScore` (the account owner's own fields) as it does today.

## 7. Jona conversation isolation

Today, `GlobalJonaAssistant`'s `messages` state is component-local React state, not persisted anywhere — it already resets on every remount/refresh, so there is currently no risk of one profile's conversation literally leaking into another's within a single browser session *unless* the component stays mounted across a profile switch without remounting. Proposal: key the assistant's mount (e.g. React `key={activeProfileId}`) so switching the active profile forces a fresh mount and a cleared `messages` array — cheap, safe, and matches "same Jona, different person, separate context" exactly. No new storage needed since conversations aren't persisted today (consistent with the earlier Jona audit's P0-E memory decision — this doesn't change that).

## 8. Profile-specific pathway changes

Proposal, scoped smallest-safe per your instruction: **keep pathway *access* (what's unlocked/paywalled) account-level — do not touch this.** Add a **separate, new, optional** `defaultPathway` field on each profile (self and family members) — purely a UI convenience: "when this profile becomes active, which pathway's Home should it land on." `resolveCurrentPathway()` would prefer the active profile's `defaultPathway` over the account's `lastUsedPathway` when both exist, falling back to today's account-level behavior otherwise. This is additive and small — `lastUsedPathway`'s existing 2-3 call sites (§ found via audit: `pathwayAccess.js`, `useAuth.jsx`, `PathwayEntry.jsx`, `Blueprint.jsx`) are a contained, auditable surface, not a sprawling dependency.

## 9. Profile-switch UX

Per your steer (subtle, not a full account-management screen): a small `{name} 👤 ▾` control in the shared header — same visual weight as the identity display just shipped on Student/Adult Home. Opening it lists `profiles` (already computed by `useAuth()`) with a name/pathway-badge each; selecting one writes `activeProfileId` (already a plain self-writable preference field per `firestore.rules`) and, per §8, optionally routes to that profile's `defaultPathway` home. No new screen, no new component beyond a small dropdown — the underlying data this needs already exists.

## 10. Security rules/backend authorization changes

- New rules additions are purely additive (§2) — no existing rule gets loosened.
- The one real *new* authorization logic is server-side in `chat.js` (§6): verify `profileId` belongs to the authenticated `uid` before trusting its data, exactly your instruction. This is a small, well-scoped addition, following the same `firestoreFetch`-lookup pattern the codebase already uses elsewhere (e.g., `AppModal.jsx`'s existing origin/source validation, `record-curriculum-progress.js`'s server-side validation).
- Firestore path structure itself (`users/{uid}/familyMembers/{memberId}/...`) already makes cross-*account* access structurally impossible — a memberId is always nested under the caller's own verified uid, so there's no path a malicious client could construct that reaches another household's data via this pattern, matching EIKEN's existing (already-proven) design.

## 11. Tests required

- Unit tests (no emulator needed, same style as `tests/safety-classifier.test.js`) for the new `chat.js` profile-lookup logic: a fabricated/foreign `profileId` must fall back to self-context, never trust unverified data.
- Firestore-rules emulator tests (extending the existing `tests/firestore-rules.test.cjs`, which already documents it needs Java + the emulator — same pre-existing environment limitation noted in that file) covering exactly the attack list in your §8: substituting another profile ID, reading/writing another household's profile, retrieving another profile's data via a crafted path.
- A regression test confirming an existing single-profile account's `careerReady/memory` doc is read from/written to the *exact same path* before and after this change (proves the "zero migration for existing users" property actually holds, not just asserted).

## 12. What can safely ship before beta vs. what should wait

**Safe before beta (small, additive, no access-control changes):**
- Profile-scoped storage paths for Career Ready/Global Ready/Speak Ready (§2), mirroring EIKEN.
- Server-side profile-ownership verification in `chat.js` (§6) — this is a security hardening, should ship regardless of the rest.
- `GlobalJonaAssistant` remount-on-profile-switch (§7) — small, low-risk.

**Should wait / needs more discussion first:**
- The profile-switcher UI itself (§9) — real UX work, and per your Section 5 instruction should be "the simplest place," which is worth a quick design look rather than me guessing the exact placement across three different pathway headers.
- `defaultPathway` per-profile (§8) — genuinely optional for beta; account-level `lastUsedPathway` continues to work fine for now, and this is purely a convenience layer on top.
- Sip Speak Learn's actual storage shape hasn't been inspected yet in this pass — needs the same check as Career/Global/Speak Ready before it's included in the same migration.

---

**Nothing above has been implemented.** Awaiting your go-ahead on which pieces from §12 to build first.
