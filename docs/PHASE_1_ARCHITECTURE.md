# Phase 1 — Shared Account / Profile / Pathway Architecture

**Date:** 2026-09-09
**Scope:** Data model, account model, pathway model, and safe migration only. No pathway dashboards, no UI redesign, no destructive migration.

---

## 1. Audit of the two pre-existing learner models

Per the original platform audit, two partially-overlapping learner data models existed before this phase:

### Model A — `users/{uid}.familyMembers[]` array + `users/{uid}/familyMembers/{id}` subcollection
- **Used by:** `FamilySetup.jsx` (creation), `Dashboard.jsx` (display, leaderboard), `EIKEN` (`eikenMemory`/`eikenProfile` sub-docs via `eiken-progress.js`), `ParentView.jsx` (read).
- **Fields (confirmed from `FamilySetup.jsx`):** `name, age, primaryApp, confidenceScore, cefr, assessmentDone, createdAt, consentGiven, consentedAt, consentedByUid`.
- **Drift:** `users/{uid}.familyMembers` (a denormalized array, used for quick display/leaderboard reads) is kept in **manual sync** with the real `familyMembers` subcollection — two representations of the same data that can drift if one write path is missed.
- **Covers:** the account owner's children/additional members. Does **not** cover the account owner's own learner data (that lives directly on the root `users/{uid}` doc: `confidenceScore`, `streak`, `cefr`, etc.).

### Model B — `learnerProfiles/{uid}` (top-level collection, keyed by account uid)
- **Used by:** `src/lib/learnerProfile.js` (`getLearnerProfile`, `updateProfileAfterChat`, `getConfidenceHistory`, `getRecentInteractions`), read by `ParentView.jsx` and `Admin.jsx`.
- **Fields:** `confidenceScore, confidenceTrend, confidenceComponents, engagementScore, totalInteractions, skills{}, appUsage{}, recommendations{}`, plus subcollections `interactions/`, `confidenceHistory/`.
- **Covers:** only the account owner's own interaction/engagement intelligence — **never** family members. A child profile has no equivalent record in this model at all.
- **New finding during this audit:** `initLearnerProfile(uid)` is called from `useAuth.jsx` on every login via the **client SDK**, but `firestore.rules` sets `learnerProfiles/{uid}` to `allow write: if false` (server-only) — meaning this client-side initialization call has almost certainly been silently failing (uncaught promise rejection, non-blocking) since it was written. This is a **pre-existing correctness bug**, independent of Phase 0/1, not fixed here (out of this phase's scope — flagged as remaining technical debt below).

### Duplicate/conflicting fields
`confidenceScore` exists in **three** places for the same person: `users/{uid}.confidenceScore` (root, owner), `users/{uid}/familyMembers/{id}.confidenceScore` (per child), and `learnerProfiles/{uid}.confidenceScore` (owner's own "intelligence" score — conceptually the same thing as the root field, tracked separately). No field naming conflicts were found beyond this redundancy.

### Migration risk assessment
- **Model A (familyMembers):** Actively used, real data, multiple live features depend on it. Any physical rename/move is **high risk** for a same-session change — many callers, some (EIKEN sub-docs) with their own nested writes.
- **Model B (learnerProfiles):** Likely thin/mostly-empty in production today given the write-path bug above, but the **collection and its rules already exist**, and `ParentView.jsx`/`Admin.jsx` read from it — cannot be deleted without checking those call sites first.

### Recommendation (canonical long-term representation)
**Model A (`familyMembers`) becomes the canonical Learner/Profile primitive**, extended with the new optional `profileType`/`relationship` fields introduced in this phase. Model B (`learnerProfiles`) should eventually either (a) be re-keyed by `profileId` instead of account `uid` so it can cover family members too, or (b) be merged into the profile doc itself as a subcollection under each profile. **Neither is done in Phase 1** — it's a real migration (rewriting a working collection's key structure) and explicitly out of scope ("do NOT perform a destructive data rewrite").

### Smallest safe consolidation implemented in Phase 1
Rather than touching either model's physical structure, `src/lib/profiles.js` introduces a **compatibility adapter**: `getProfiles(account, familyMembers)` returns one unified list combining (a) a *synthesized, non-persisted* "self" profile built from the root account doc's existing fields, and (b) the real `familyMembers` subcollection docs, unchanged. Every new pathway/profile-aware code path (the `useAuth` context, `PathwayLab.jsx`) goes through this adapter — nothing reads `familyMembers` directly except this one module and the pre-existing call sites, which are untouched.

---

## 2. Account model implemented

The Firebase-authenticated `uid` remains the root ACCOUNT identity — unchanged, per the requirement that authentication identity must not be duplicated across profiles.

`users/{uid}` (existing root doc), additive fields only:

```
users/{uid}
├── (existing) email, name, plan, subscriptions, accountType, isAdmin, ...
├── pathwayAccess   { family: {source, grantedAt} | null, student: ..., adult: ..., educator: ... }   — PRIVILEGED
├── roles           string[]   — e.g. ["parent"], ["teacher"]  — descriptive only, NOT an access gate
├── lastUsedPathway "family" | "student" | "adult" | "educator" | null   — self-writable preference
└── activeProfileId "self" | "<familyMembers doc id>"                    — self-writable preference
```

`pathwayAccess` is the **only** new privileged (server/admin-only-write) field — everything else new is a plain user preference, same tier as the existing `nickname`/`setupDone` fields.

---

## 3. Profile / Learner model implemented

No new collection. `users/{uid}/familyMembers/{memberId}` (existing) remains the physical store for non-owner profiles; `src/lib/profiles.js` is the new canonical accessor:

- `buildSelfProfile(account)` — synthesizes the owner's own "profile" from account fields (not a Firestore doc).
- `getProfiles(account, familyMembers)` — `[self, ...familyMembers]`.
- `createProfile`/`updateProfile` — thin wrappers over the existing subcollection writes, with two new **optional** fields (`profileType`, `relationship`) added going forward; existing docs without them are treated as `profileType: "child"` by default, so nothing existing breaks.

Age data: existing `familyMembers` docs already store `age` as a plain integer (not a birth date) — already the minimal-necessary shape per item 9's guidance; left unchanged.

---

## 4. Pathway model implemented

`src/constants/pathways.js` — the single source of truth for what a pathway *is* (id, display name, route, description). All four pathways are marked `enabled: false` — no dedicated pathway experience exists yet (that's Phase 2+); this file exists so later phases have one place to flip that flag and add routing.

`src/lib/pathwayAccess.js` — the **one authoritative resolver**, `getAccessiblePathways(account, isAdmin)`:
1. Admin → every pathway.
2. Explicit `account.pathwayAccess` present and non-empty → use it exactly.
3. Otherwise → `inferLegacyPathways(account)`, a conservative compatibility mapping from existing `subscriptions[]`/`accountType`/`plan` (kids apps → family, university apps → student, adult apps → adult, any other paying plan → adult as a conservative default, **never** infers educator — no reliable existing signal for it).

Server-side mirror: `netlify/functions/_pathwayAccess.js` (CommonJS, used only by the migration function — see below; kept in sync manually, same constraint as the pre-existing `_pricePlanMap.js`).

---

## 5. Role vs. pathway

Kept as two independent fields by design: `roles: string[]` (descriptive, self-reported, e.g. `["parent"]`, `["teacher"]`) never gates access on its own; `pathwayAccess`/`accessiblePathways` (entitlement) is the only thing that grants or denies a pathway. A teacher with `roles: ["teacher"]` and no `pathwayAccess.educator` grant still cannot access the (not-yet-built) Educator pathway.

---

## 6-7. Last used pathway / active profile / application state

Extended `useAuth.jsx` (not a new state library — per item 16's preference to extend existing hooks) to expose, alongside the existing `user`/`isAdmin`/`loading`:

```
accessiblePathways   — string[], from getAccessiblePathways()
profiles             — Profile[], from getProfiles()
currentProfile        — resolved from user.activeProfileId (defaults to "self")
currentPathway         — resolved from user.lastUsedPathway, but ONLY if still in accessiblePathways;
                          null if never set — deliberately NOT auto-selected/auto-redirected (item 6)
setActivePathway(id)  — validates + persists lastUsedPathway + fires pathway_selected/pathway_switched
setActiveProfile(id)  — validates + persists activeProfileId + fires profile_selected
```

`currentAccount` is simply the existing `user` object — no change needed there, it already represents the account.

---

## 8-9. Family-ready profile relationships / child data

`createProfile()` now accepts an optional `relationship` (defaults to `"child"`), stored alongside a `profileType` field. Ownership is implicit and already enforced correctly: every `familyMembers` doc lives under `users/{ownerUid}/familyMembers/{id}`, and `firestore.rules` already restricted that whole subcollection to `request.auth.uid == uid` (the owner) before this phase — verified un-weakened by a new rules test (`profile ownership: a user cannot read another account's familyMembers profile`). No household/relationship graph was added — deliberately kept to the single owner→profile shape needed for the December beta, per item 8's explicit instruction not to over-build this.

---

## 10-11. Pathway configuration / access resolver

Covered above (`constants/pathways.js`, `lib/pathwayAccess.js`). `worldCategories.js` (the audit's cited precedent) was reviewed and deliberately **not** modified or merged into the new pathway config — it groups individual *apps* for the Worlds page UI, a different concern from the pathway *product* concept, though the two map closely and a future pass could derive one from the other (noted in a comment in `pathways.js`, not executed now to keep this change additive).

---

## 12-13. Compatibility & migration strategy

Implemented exactly the staged pattern requested:

- **Stage A (done):** the app understands both old (no `pathwayAccess`) and new (`pathwayAccess` present) schema simultaneously — `getAccessiblePathways()` handles both branches today.
- **Stage B:** N/A yet — no sign-up flow writes `pathwayAccess` directly yet, since no pathway-selection UI exists (Phase 2). New accounts today simply have no `pathwayAccess` field and are served by the same inference path as existing accounts, which is safe and correct.
- **Stage C (done):** `netlify/functions/migrate-pathway-access.js` — called once per session from `useAuth.jsx` (best-effort, non-blocking) whenever an account's `pathwayAccess` field is `undefined`. It's **idempotent**: computes the inferred pathways server-side and writes them via the service account **only if the field is still absent** — never overwrites an existing value, whether set by this migration, an admin, or a future entitlement flow.
- **Stage D/E:** not applicable yet — no bulk migration tooling was run, and no compatibility code has been removed (nor should it be, until Phase 2+ actually needs to force the question).

No production user document was bulk-modified. The only write path is the lazy, one-at-a-time, idempotent migration above, and it has not been exercised against production yet (would happen only when a real user with no `pathwayAccess` field logs in against a deployed build with this code).

---

## 14. Firestore structure — why this shape

```
users/{uid}                          — ACCOUNT (existing root, extended additively)
users/{uid}/familyMembers/{id}       — PROFILES (existing, unchanged physically; new optional fields)
users/{uid}/familyMembers/{id}/learningPath  — existing, unchanged
learnerProfiles/{uid}                — legacy learner-intelligence data; untouched, documented as debt
pathwayEvents/{eventId}              — NEW, append-only analytics log (pathway_selected/switched/profile_selected)
```

No new `users/{uid}/pathways/{pathwayId}` subcollection was created. `pathwayAccess` is a single bounded map field (max 4 keys — one per pathway) on the account doc instead. Reasoning: a subcollection is the right shape for an open-ended, growing set of documents; pathway access is a small, fixed-cardinality set that's always read in full together (the resolver never wants "just one pathway's data" without needing to reconcile the WHOLE map to decide the account's accessible list) — a single field is cheaper (no extra read), simpler to secure (one field-name check, reusing the exact `privilegedUserFields()` mechanism from Phase 0), and avoids a second no-op collection to maintain.

---

## 15. Security rules changes

- `pathwayAccess` added to `privilegedUserFields()` — same enforcement mechanism as Phase 0's billing fields (owner cannot self-write it; only admin or the service account can).
- New `pathwayEvents/{eventId}` collection rule: `create` requires `request.auth.uid == request.resource.data.uid` (can only log events about yourself), `read` admin-only, `update`/`delete` denied — mirrors the existing `adminLogs` pattern.
- No existing rule was weakened. `familyMembers` ownership (owner-only read/write, no admin carve-out) was verified unchanged and covered by new tests.
- 21/21 rules tests pass (12 from Phase 0 + 9 new Phase 1 tests) against the local Firestore emulator.

---

## 16-19. Application state / profile & pathway switcher foundation / analytics

Covered above. `src/pages/PathwayLab.jsx` (route: `/dev/pathway-lab`, login-required, not linked from any nav — same convention as the existing `/dev/phonics-v2`) is the minimal functional UI for validating profile/pathway switching end-to-end; deliberately unstyled.

`src/lib/pathwayAnalytics.js` — `logPathwayEvent()`, reusing the exact append-only-collection pattern already used for `adminLogs`/`geminiActivity` rather than any new analytics platform. `pathway_selected`/`pathway_switched`/`profile_selected` are wired into `setActivePathway`/`setActiveProfile`. `profile_created` is defined but not yet wired into `FamilySetup.jsx`'s existing child-creation flow — a small follow-up, not done here to keep this change scoped to the account/profile/pathway model itself rather than touching an existing onboarding flow.

---

## Remaining technical debt (see also final report)

1. `learnerProfiles/{uid}` client-side `initLearnerProfile()` write is almost certainly silently failing today (rules require server auth, call is client-side) — pre-existing bug, not fixed in Phase 1.
2. `users/{uid}.familyMembers[]` array vs. the `familyMembers` subcollection remain two representations of the same data, manually kept in sync — not consolidated in Phase 1 (would require touching every existing write site).
3. `learnerProfiles/{uid}` remains keyed by account uid, not profile id — cannot yet represent a child's own interaction intelligence separately from the owner's.
4. `pathway_created`/`profile_created` analytics event not yet wired into `FamilySetup.jsx`.
5. No pathway currently has `enabled: true` or a real route — by design, that's Phase 2's job.
