# Phase 3.4 — Engagement/Confidence Data Model

Written before implementation, per the Phase 3.4 instruction to document
the chosen profile-key/storage structure before changing anything. Covers
only the engagement/skill/confidence tracking system (`learnerProfiles`,
`interactions`, `confidenceHistory`, and their replacement for Family child
profiles). Curriculum progress (`curriculumProgress`, `homePracticeLog`) is
untouched and out of scope here — see `record-curriculum-progress.js`.

## What existed before this phase

A single collection, `learnerProfiles/{uid}`, keyed purely by Firebase Auth
uid — i.e. by ACCOUNT, not by learner. Three consumers:

1. `src/pages/Dashboard.jsx` — reads it for the adult/single-user AI-chat
   recommendation engine (`getLearnerProfile`).
2. `src/pages/ParentView.jsx` — a public share-link view of the same
   account's profile (a different, older feature from `FamilyParentView.jsx`).
3. `src/lib/appEvents.js`'s `processAppEvent()` — wrote to it directly via
   the client Firestore SDK, for EVERY app's `HSD_OS_PROGRESS` event,
   including Family child-profile activity.

`firestore.rules` has denied client writes to `learnerProfiles/{uid}` since
the Phase 0 security hardening (2026-09-09), with a comment claiming
"server writes via /api/intelligence and /api/chat". Audited: **no such
server write exists anywhere in this codebase** (there is no
`netlify/functions/intelligence.js` at all, despite a dead `netlify.toml`
redirect for `/api/intelligence`; `chat.js` never touches
`learnerProfiles`). Every write to this collection has always failed,
silently, since Phase 0 — for adults and Family children alike. This is the
root cause of two of the three permission-denied errors diagnosed in Phase
3.3 (`docs/HSD_FAMILY_PATHWAY_AUDIT...` audit trail /
`initLearnerProfile()` and `processAppEvent()`).

Separately, and independent of the permission bug: even if the write had
succeeded, it always attributed the data to the PARENT's own uid, never to
the specific child profile that generated it. A family with two children
using two different Family apps would have both children's engagement,
skills, and interaction history silently merged into one undifferentiated
bucket, keyed by the parent's account. That's the product-level bug this
phase's data model fixes.

## Decision

**`learnerProfiles/{uid}` is preserved exactly as-is, in shape and location,
for `profileId === "self"` only.** "self" is, by construction
(`src/lib/profiles.js`'s `SELF_PROFILE_ID`), the account owner's own Family
profile — the same identity Dashboard.jsx and ParentView.jsx already track.
Nothing is renamed, migrated, or reshaped. Existing adult/single-user data
keeps working, keeps living where it already lives, and keeps being
readable by the same two existing consumers.

**A genuine child profile (`profileId` resolving to a real
`users/{uid}/familyMembers/{profileId}` document) gets a new, additive,
parallel location:**

```
users/{uid}/familyMembers/{profileId}/learnerProfile/profile        (summary doc)
users/{uid}/familyMembers/{profileId}/learnerProfile/profile/interactions/{eventId}
users/{uid}/familyMembers/{profileId}/learnerProfile/profile/confidenceHistory/{date}
users/{uid}/familyMembers/{profileId}/learnerProfile/profile/processedEvents/{eventId}
```

Field shape on the summary doc is intentionally identical to
`learnerProfiles/{uid}` (`totalInteractions`, `appUsage`, `engagementScore`,
`confidenceTrend`, `skills`, `updatedAt`) so the two trees can, in a later
phase, share display/formatting code if a parent-facing UI for this data is
ever built. This is a sibling of the already-established
`users/{uid}/familyMembers/{profileId}/curriculumProgress/*` and
`.../activityProgress/*` subtrees — same nesting convention, same
ownership model, nothing invented.

Why not just widen `learnerProfiles` to accept a compound key
(`learnerProfiles/{uid}_{profileId}` or similar)? Rejected: it would still
require every existing consumer of `learnerProfiles/{uid}` (both read-only
today, but a future feature could add more) to be re-audited for whether it
silently assumed one document per uid. Nesting under the child's own
existing `familyMembers/{profileId}` document tree needs no such
assumption to be re-checked anywhere — the child's data simply lives with
the rest of the child's data, exactly like `activityProgress` already does.

## Ownership validation (shared with curriculum progress)

Both `record-curriculum-progress.js` (unchanged) and the new
`record-engagement-event.js` use the identical check: `profileId === "self"`
short-circuits to the account owner; anything else must resolve to a real
`users/{uid}/familyMembers/{profileId}` document under the CALLER's own
verified uid (from `verifyIdToken`, never the client-supplied value) before
any write happens. A deleted, renamed, or another-account's profile id
fails this check the same way — 403, no write attempted. This is the "same
validated learner identity, separate storage" the Phase 3.4 brief asks for.

## `appProgress`

`users/{uid}/appProgress/{module}` was write-only from
`src/components/AppModal.jsx`, with no reader anywhere in the app (full
repo grep, Phase 3.3 and re-confirmed here). Removed outright — not
migrated, not isolated. There was nothing to preserve.

## No Firestore rules changes

Both new document trees are written ONLY by `record-engagement-event.js`,
authenticated via the existing service-account (`_firebaseAdmin.js`), which
bypasses `firestore.rules` entirely — the same pattern
`record-curriculum-progress.js` already established. The client never talks
to either tree directly, so the existing default-deny catch-all rule
already does exactly what's wanted (block any stray client attempt) with
zero rule changes. This phase adds no client-readable surface for the new
child-profile data — if a future phase wants `FamilyParentView.jsx` to
display it, that will need its own explicit read rule at that time.

## Atomicity (added in the Phase 3.4 correctness review, same day)

The first version of this endpoint read the profile-summary doc BEFORE a
plain `:commit` call, which left a real race: two concurrent events for the
same profile could each read the same "before" totals and one increment
could be silently lost. Fixed by making every write for one event — the
`processedEvents/{eventId}` idempotency marker, the profile-summary upsert,
the interaction log entry, the daily `confidenceHistory` snapshot, and the
persisted rate-limit counter — part of ONE real Firestore interactive
transaction (`:beginTransaction` → reads with `?transaction=...` →
`:commit`). Firestore's own optimistic-concurrency contract does the actual
work: if any document the transaction read is modified by a different,
faster transaction, this transaction's `:commit` fails with `ABORTED` and
nothing it wrote lands — never a partial write. `runTransactionAttempt()`
in `record-engagement-event.js` retries automatically (bounded, 3 attempts)
on `ABORTED`, re-reading fresh state each time — the same thing the
official Firestore client SDKs do internally for their own transactions.

Test coverage for every atomicity claim lives in
`netlify/functions/__tests__/record-engagement-event-idempotency.test.cjs`,
using an in-memory mock that models real Firestore transaction semantics
(per-document version stamps, commit fails if any read document's version
moved) rather than just faking individual HTTP calls.

## Rate limiting: two layers, only one is a real guarantee

An in-memory, per-serverless-instance counter is **not** a security
guarantee — a cold start or a second concurrent function instance resets
or bypasses it entirely, and this file's own comments say so explicitly
rather than implying otherwise. It remains as a cheap, first-line,
best-effort pre-filter (keyed by `uid:profileId`, never mixing two
children or two accounts) purely to avoid spending a Firestore transaction
on an obviously-abusive burst.

The **authoritative** control is a persisted `rateLimit/current` document
nested under the same profile-scoped path as everything else
(`.../learnerProfile/profile/rateLimit/current` for a child,
`/learnerProfiles/{uid}/rateLimit/current` for self) and read/written
INSIDE the same transaction as the rest of the event — so a burst of
concurrent requests can't all read "under the limit" and all commit; the
same optimistic-concurrency mechanism that protects `totalInteractions`
protects this counter too. Scoped per profile by construction (it's nested
under that profile's own path), so it structurally cannot mix two
children's or two accounts' traffic.

A further, PLATFORM-level control is proposed but not implemented in this
local-only phase: Firebase App Check on this endpoint, which
cryptographically attests requests come from the real app rather than a
scripted client. That requires Firebase console configuration outside code
and is out of scope here — noted as a follow-up.

## CORS: defense-in-depth only, not the security boundary

Every other function in this codebase uses a blanket
`Access-Control-Allow-Origin: "*"` (an existing, unrelated platform-wide
pattern this phase does not otherwise touch). `record-engagement-event.js`
instead reflects back only a small allowlist of known app origins
(`APP_URL`, i.e. `https://app.hsdos.ai`, plus local dev ports) — a real,
if narrow, improvement (stops a malicious third-party page from using a
signed-in user's browser session to call this endpoint cross-origin), but
explicitly documented as NOT the actual security boundary: CORS is
enforced by browsers, so any non-browser caller ignores it completely. The
real boundary, unchanged, is the verified Firebase ID token plus the
profile-ownership check.

## Child-data protection

- The request body is checked against a strict allowlist of field names
  (`idToken`, `profileId`, `appId`, `lessonType`, `isCorrect`, `reportedXp`,
  `reportedScore`, `eventId`) — anything else is rejected outright before
  any other processing. There is structurally no field a child's name,
  email address, raw audio, a transcript, or free text could travel in.
- Every accepted string field is bounded (`profileId`/`eventId` ≤ 64
  chars; `appId`/`lessonType` are Set-membership checks against small
  closed vocabularies, not free strings).
- Every write uses a server-computed timestamp (`new Date().toISOString()`
  at request time — this codebase's established REST-API convention for
  "server timestamp", since the REST API's typed-value encoding has no
  native `serverTimestamp()` sentinel the way the client/admin SDKs do;
  see `_firebaseAdmin.js`'s own comment on this).
- `processedEvents/{eventId}` and `rateLimit/current` both carry an
  `expiresAt` field.

### Retention / TTL plan (documented, not yet enforced)

Writing an `expiresAt` field is necessary but not sufficient — Firestore
only actually deletes expired documents once a **TTL policy** is enabled
on that field for a given collection group, which is a Firebase console
/ `gcloud` configuration step, not something this code can do on its own,
and out of scope for a local-only phase with no environment access.
Follow-up needed before this ships to staging/production:

1. Enable a TTL policy on `expiresAt` for the `processedEvents` collection
   group (90-day retention — generous idempotency window; no legitimate
   retry should ever need one longer than that).
2. Enable a TTL policy on `expiresAt` for the `rateLimit` collection group
   (retention = a few multiples of the 60s window — these documents have
   no value once their window has passed).
3. `interactions` and `confidenceHistory` are NOT covered by a TTL here —
   they're the actual learner-progress history, not disposable
   bookkeeping, and any retention policy for them is a product decision
   (how long should a family's activity history be kept?) rather than a
   purely technical one. Flagged for a future phase, not decided here.

## Reader compatibility (Jona / future parent dashboards)

No new client-readable Firestore surface is added by this phase — nothing
outside `record-engagement-event.js` reads either tree yet. But ANY future
reader (a Jona-facing summary, a parent dashboard endpoint, an admin tool)
MUST resolve "where does this profile's data live" through the single
shared resolver in `netlify/functions/_learnerProfilePath.js`
(`resolveLearnerProfilePath(uid, profileId)`), not by recomputing the
self-vs-child branch inline. That function's own header comment says this
explicitly: centralizing the decision in one place is what makes "a future
feature accidentally reads the parent's data when a child profile is
selected" structurally impossible to reintroduce, rather than merely
policy that a future author has to remember. `record-engagement-event.js`
already uses it instead of a local copy — a static-source regression test
(`tests/no-direct-locked-writes.test.js`) enforces that it continues to.
