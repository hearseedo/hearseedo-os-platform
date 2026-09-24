# Client-Write Security Recommendation + Targeted Cross-Profile Leak Audit

**Date:** 2026-09-24
**Status:** Recommendation + audit report only. No further storage architecture changes made beyond what was explicitly approved and already shipped (profile-scoped Career/Global/Speak Ready + Sip Speak Learn, fail-closed profileId, profile switcher).

---

## Part 1 — Client-writable vs. server-mediated: recommendation

Per your instruction: least privilege, but don't convert everything to server-mediated architecture just for beta. The dividing line I'd draw is **"can a client lying about this value hurt someone other than themselves, or hurt the business" vs. "can it only ever hurt/inconvenience the writer's own experience."**

| Data | Current state | Recommendation | Why |
|---|---|---|---|
| **Progress (lesson completion, XP, sessions)** | Client-writable (`careerReady`/`globalReady`/`speakReady` + their new profile-scoped subcollections; localStorage for badges) | **Stays client-writable.** | A user who fakes their own XP only fakes it for themselves — no cross-person or billing impact. This is the same trust level EIKEN's own *localStorage* layer already uses (only EIKEN's *Firestore* layer is server-mediated, for a different reason — cross-device sync of parent-visible data, not a security requirement). |
| **Achievements/badges** | Client-writable (part of the same progress docs/localStorage) | **Stays client-writable**, same reasoning as progress. | Low stakes — a self-awarded fake badge affects only the badge-holder's own display. |
| **Confidence scores** | Client-writable (part of progress docs) | **Stays client-writable for now.** | Same low-stakes reasoning — BUT flagging one nuance: if HSD ever surfaces confidence scores to a *parent* dashboard as if they were an objective measurement (not just the child's own self-report UI), that framing implies more trust than the write path currently deserves. Worth a product-level note, not a code change today. |
| **Jona memory** (`careerReady/globalReady/speakReady` memory docs, `familyMembers/{id}/eikenProfile`) | Client-writable (new ones) / server-only (EIKEN's) | **Recommend moving to server-mediated**, matching EIKEN, but this is a genuine architectural gap, not urgent for beta. | This is closer to a borderline case: today a client could, in principle, write arbitrary "memory" text that gets fed back into a future Jona prompt for that same profile — but it can only poison *that person's own* future conversations, not another profile's or another account's. Low urgency; real reason to eventually match EIKEN is consistency, not an active exploit. |
| **Usage/quota (`chatUsage`)** | Already server-only in effect — `chat.js`'s quota check reads a server-verified plan and a count incremented server-side; the Firestore rule (`allow create, update: if true`) is open because the write comes from a bare-API-key Lambda call, not because a browser client can freely edit it undetected. | **No change — already correctly protected**, just via a different mechanism (server-side increment, not a locked-down rule) than "rules deny client writes." | Confirmed via the existing chat.js quota logic (verified in the earlier Jona audit) — this was already the right shape. |
| **Membership/access (`plan`, `subscriptions`, `pathwayAccess`, `isAdmin`)** | Server/admin-only (`touchesPrivilegedFieldsOnCreate/Update()` guard) | **No change — already correctly protected.** This was the 2026-09-09 audit's CRITICAL fix. | Directly billing-affecting; correctly locked down already. |
| **Safety information (`safetyEvents`)** | Server-only write, admin-only read | **No change — already correctly protected**, built that way from the start (P0-B). | Never should have been client-writable in the first place; wasn't. |
| **Profile identity used by Jona** (name/age/confidence, as resolved by `_profileContext.js`) | Server-side read of the SAME client-writable progress/profile docs above | **No change needed** — the fix already shipped isn't about the *data* being client-writable, it's about *which profile's data* the server trusts a request to be about. A user editing their own name only affects what Jona calls *them*, not access to anyone else's data. | This is the important distinction: ownership-verification (already fixed) matters far more here than write-protection. |

**Overall recommendation: don't expand server-mediation for beta.** The two things that actually needed hardening — billing/access fields, and *which profile* a request is authorized to represent — were already the CRITICAL/P0 fixes (Sept 9 and this session respectively). Everything else client-writable today only affects the writer's own experience, which is an acceptable, genuinely low-risk trust level for a beta, not a gap that needs closing before launch. The one item worth a future (non-urgent) pass is Jona-memory write consistency with EIKEN's pattern, for architectural tidiness rather than an active risk.

---

## Part 2 — Targeted cross-profile leak audit

Searched every file referencing `familyMembers` (25 files) plus a specific check of every AI-prompt-building surface (`AICoach.jsx`, `JonaCoach.jsx`, all `netlify/functions/*.js`) and localStorage usage, per your instruction to keep this targeted rather than a broad audit.

**Found and already fixed:** `src/lib/claude.js`'s client-built system prompt used to embed `user.familyMembers.map(...)` — every family member's name/age/confidence score — into every Jona request regardless of which profile was active. Fixed in the prior change (removed from the client, replaced by the server-side, ownership-verified single-profile lookup).

**Checked, no leak found:**
- **AI prompts:** `AICoach.jsx` and `livingBlueprint/coach/JonaCoach.jsx` — neither references `familyMembers` at all. Every `netlify/functions/*.js` that touches a `familyMembers/{profileId}` path (`eiken-progress.js`, `get-classroom-position.js`, `record-curriculum-progress.js`, and the new `_profileContext.js`) already scopes to exactly one `profileId` at a time — none of them fetch or forward the full list. These functions are, in fact, the precedent `_profileContext.js` generalized, not new instances of the problem.
- **Analytics/logs:** `pathwayAnalytics.js` and `learnerProfile.js` don't reference `familyMembers`.
- **localStorage:** no file actually persists the family member *list* to localStorage (a few files matched the search only because they separately use `localStorage` and separately reference `familyMembers` in unrelated code — checked each, no overlap).
- **UI components:** every other `familyMembers` reference found (`Dashboard.jsx`'s family-member switcher/management, `Subscriptions.jsx`'s member-count display, `Achievements.jsx`'s "add a family member" badge check, `FamilySetup.jsx`, `ChildProfileCreate.jsx`) is the **account owner managing or viewing their own household's member list** — the parent-facing surface this is supposed to exist for, not a case of one profile receiving another profile's private data. I did not treat these as leaks; flagging them here only so the "checked and ruled out" reasoning is visible rather than silently omitted.
- **`src/livingBlueprint/*`** — several matches here, but this entire subsystem is currently disabled for everyone (`isLivingBlueprintEnabled()` always returns `false`, per earlier work this session) — not reachable by real users today, so not a live exposure, though worth a pass if/when that subsystem is ever revived.

**Conclusion:** the `claude.js` issue was the one real instance of this pattern. Nothing else found in this targeted pass.

---

**No further storage/security architecture changes made in this document** — Part 1 is a recommendation for your review, Part 2 is a report of what was checked.
