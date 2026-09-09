# HSDOS.ai Architecture & Product Audit

**Date:** 2026-09-09
**Scope:** `hsd-os-platform` (the live HSDOS.ai codebase), read-only audit, no code changed.
**Purpose:** Determine how the existing platform can evolve into one HSD OS AI core powering four pathways — HSD Family, Confidence Student, Confidence Adult, HSD Educator — per the platform direction brief.

---

## 0. Two issues that need attention independent of everything else below

These were found during the audit and are live in production today. They are not part of the four-pathway migration — they're bugs in the current system.

| # | Issue | Why it matters | Fix scope |
|---|---|---|---|
| 1 | **`firestore.rules` lets an authenticated user write any field of their own `users/{uid}` doc** (line 50), including `plan`, `subscriptions`, `planStatus`, `accessPass`. `useSubscription.js` derives all paid-app access from those same fields with no server-side cross-check against Stripe. Any signed-in user can grant themselves full paid access via devtools, permanently, for free. | Direct revenue leakage. Also means "founding member," "family," etc. status can be self-granted. | Small, surgical Firestore rules change (restrict writable fields on `users/{uid}` to a safe allow-list; everything billing-related must only be settable by the service account). |
| 2 | **`config/killSwitch` is writable by anyone, unauthenticated** (`firestore.rules` lines 199-204: `allow create, update: if true`). The passcode in `kill-switch.js` is irrelevant — anyone can PATCH this doc directly via the public Firestore REST API using only the public Web API key, and disable Gemini/TTS for the entire platform, or fake a "safe" state to mask a real incident. | Full platform DoS available to anyone, no login required. | Small rules change — restrict to server-only writes (service account bypasses rules by design) or require a custom claim. |

Also worth immediate attention (lower urgency, still pre-beta):
- `SHUTDOWN_PASSCODE` has a hardcoded fallback (`"HSD-STOP-2026"`) in `kill-switch.js` — confirm the real env var is actually set in Netlify production, and rotate the passcode since this value is now in an audit transcript.
- `chat.js` trusts a client-supplied `plan` value to pick the AI rate-limit tier, with no cross-check against the account's actual plan — a user can claim the highest tier's daily quota regardless of what they pay for.
- The stray Firebase Admin SDK JSON key file living in the parent directory (outside `hsd-os-platform/`, outside any git repo) is confirmed **unused by any code path** — its contents were manually split into `FIREBASE_SA_KEY_A/B` env vars already. It's dormant, not actively exploited, but should be deleted or moved to a password manager now that it has no functional purpose sitting on disk as a plaintext, indefinitely-valid credential.

---

## 1. Executive Summary

**What exists:** HSDOS.ai is a real, working, revenue-generating platform — not a prototype. React 18 + Vite + Firebase (Auth/Firestore) + Netlify Functions, with live Stripe billing (real price IDs, signature-verified webhooks), a working iframe+SSO integration pattern already extending to multiple sibling apps (EIKEN, Monkeys Unlock, Monkey Yoga Phonics, Sip Speak Learn), a genuinely capable Jona AI coach across five+ contexts, real progress/achievement tracking, a parent-facing report view, and a fully-featured internal admin console. A parent-account-with-child-sub-profiles model already exists (`familyMembers` subcollection) and is actively used by EIKEN and the family dashboard.

**What's strong:**
- The core tech choices (React/Vite/Firebase/Netlify) are sound and don't need replacing.
- `worldCategories.js` already segments every app into four groups — **Kids / Teens & University / Adults / Family** — which is nearly identical to the target pathway model. This is the single most useful existing asset for the migration: the platform team has already been thinking in these terms.
- Achievements, progress visualization ("Living Blueprint"), and ParentView are already generalized enough to extend across pathways without rebuilding.
- The AppModal iframe/SSO/postMessage pattern is a solid, reusable mechanism for adding more sub-apps under any pathway.
- Server-side AI calls are correctly kept off the client (no exposed provider API keys in the bundle today).

**What's missing:**
- No unified "pathway" or "role" concept in the data model — access today is a flat `plan` + `subscriptions[]` array, not a set of pathways a single account can hold simultaneously.
- HSD Educator (teacher/school) has **no code at all** — it's a from-scratch build.
- AI cost is only partially tracked, and not converted into an actual ¥/$ figure per user — the business cannot yet answer "what does one family cost us per month," which is the central question the December beta needs to answer.
- No content-moderation/safety-filtering layer on AI output reaching children.
- No responsive design system (one JS hook, two files with real CSS breakpoints) — a real gap for a platform that needs to work well on phones and school devices.
- 213MB of largely uncompressed, zero-WebP image assets ship with the app; the main JS bundle includes the entire admin console for every visitor.

**Biggest risks, ranked:**
1. The two CRITICAL security findings above (self-granted billing access; open kill switch) — these are production bugs, not migration-scope items, and should be fixed regardless of what else happens next.
2. Cost visibility gap — committing to a ¥1,500/month family price without knowing real AI+TTS cost per family is a real financial risk; the December beta is the first chance to get this number, but the instrumentation to compute it doesn't fully exist yet.
3. Two diverging Stripe webhook implementations (Netlify vs. Cloudflare Pages Functions) with different plan tables — a silent entitlement bug waiting to happen if only one is edited.
4. Two parallel "learner" data models (`familyMembers` subcollection vs. `learnerProfiles/{uid}`) that can drift, plus a duplicated `familyMembers[]` array kept in manual sync with the subcollection.
5. No child-safety guardrails in the AI prompts — acceptable risk today at small scale with known families, but a real gap before opening the beta to unfamiliar families per the plan's own "third group" reasoning.

**Bottom line:** This is a genuine "extend, don't rebuild" situation. The shared-core vision in the platform direction brief is achievable on top of what exists — most of Priority 1 (shared core) is really "formalize and harden patterns that already exist" rather than new construction, with the notable exception of a real pathway/role data model and AI cost instrumentation, which are net-new.

---

## 2. Current Architecture Map

```
Visitor
  │
  ▼
HearSeeDo.jp (separate marketing site, not audited here)
  │
  ▼
HSDOS.ai — SignIn.jsx (email/password or Google, Firebase Auth)
  │
  ▼
Firestore users/{uid} doc created
  (plan, subscriptions[], accountType, familyMembers[], confidenceScore, streak, xpEarned...)
  │
  ├─► FamilySetup.jsx / OnboardingV2.jsx / JoinFlow.jsx (onboarding variants)
  │
  ▼
Dashboard.jsx (4,029-line monolith — "AppOrbit" of unlocked apps, AI chat, learning path, missions)
  │         ▲ parallel in-progress rebuild: src/livingBlueprint/ (flag-gated, same role, newer UX)
  │
  ├─► AppModal.jsx ──► iframe + SSO (sso_token, id_token query params) ──► sibling apps
  │                     (Monkeys Unlock, Monkey Yoga Phonics V2, Sip Speak Learn, Music Album)
  │                     postMessage bridge: HSD_OS_READY / HSD_OS_AUTH / HSD_OS_PROGRESS
  │
  ├─► Native in-repo sub-apps (not iframed): CareerReady, GlobalReady, SpeakReady, EikenApp,
  │     WonderCamp — each with its own data.js/i18n.js/storage.js folder
  │
  ├─► Jona / AI — Netlify Functions (chat.js, coaching-card.js, learning-path.js,
  │     assessment-score.js, pronunciation-check.js, eiken-evaluate.js, monkeys-evaluate.js)
  │     → Gemini 2.5 Flash (primary) / Claude Sonnet (fallback) → response
  │     → tts.js / speak-ready-tts.js → ElevenLabs → audio
  │     (all gated on config/killSwitch; most but not all require a verified Firebase ID token)
  │
  ├─► Progress/Achievements — Achievements.jsx (22 hardcoded, bilingual), LivingBlueprint.jsx
  │     (artifact-gallery gamification), ParentView.jsx (public read-only parent report)
  │
  ├─► Payments — Plans.jsx → create-checkout.js → Stripe Checkout → stripe-webhook.js
  │     (HMAC-verified) → writes plan/subscriptions/aiMsgLimit back to users/{uid}
  │
  └─► Admin.jsx (2,256 lines) — live Firestore listeners: users, support, feedback,
        apiCosts, geminiActivity, adminLogs. Admin gated by hardcoded email allowlist,
        duplicated across Firestore rules (1 email) and client code (2 emails).

External services connected: Firebase (Auth + Firestore), Netlify (hosting + Functions,
with a partially-duplicated Cloudflare Pages Functions tree), Stripe (billing),
Google Gemini + Anthropic Claude (AI), ElevenLabs (TTS), Resend (email).
```

---

## 3. KEEP / MODIFY / BUILD / REMOVE — Full Classification

| System | Current State | Classification | Required Change | Priority | Risk |
|---|---|---|---|---|---|
| React/Vite/react-router-dom core | Modern, standard, working | **KEEP** | None | — | — |
| Firebase Auth (email + Google) | Working, server-side token verification correct | **KEEP** | None | — | — |
| `users/{uid}` Firestore write rule | All-or-nothing field access | **MODIFY** | Restrict writable fields via allow-list; billing fields server-only | P0 | **Critical** |
| `config/killSwitch` rule | Open to unauthenticated writes | **MODIFY** | Restrict to server-only / custom claim | P0 | **Critical** |
| `worldCategories.js` (Kids/Teens&Uni/Adults/Family grouping) | Display-only grouping | **KEEP/MODIFY** | Promote from display grouping to first-class pathway/routing concept; add Educator | P1 | Low |
| `App.jsx` routing | Single flat file, works, 13 copy-pasted flag-gate components | **MODIFY** | Generalize into one `<FlagGate>`; add pathway-aware guards | P1 | Low |
| `familyMembers` subcollection (child profiles) | Real, working, used by EIKEN/Dashboard | **KEEP/MODIFY** | Consolidate as canonical Learner entity; stop syncing to duplicate array field | P1 | Medium |
| `learnerProfiles/{uid}` collection | Parallel/legacy learner-intelligence model, doesn't cover family members | **MODIFY** | Merge into `familyMembers`-based model or deprecate | P1 | Medium |
| Admin email allowlist (rules + 6 client files) | Works, hardcoded, duplicated, inconsistent (2 emails client-side, 1 in rules) | **MODIFY** | Move to Firebase custom claims or a `staff/{uid}` collection before Educator ships | P2 | Medium |
| AppModal iframe/SSO/postMessage pattern | Working, registry-driven | **KEEP** | Tighten wildcard `"*"` postMessage target origin | P2 | Low |
| `src/livingBlueprint/` rebuild | Actively developed, parallel to legacy Dashboard | **MODIFY (in progress)** | Plan explicit cutover date; retire `Dashboard.jsx` after | P2 | Medium |
| `Dashboard.jsx` (legacy, 4,029 lines) | Live production experience today | **MODIFY** | Retire once Living Blueprint flag flips | P2 | Medium |
| Central i18n (`lib/i18n.js`) | Deep EN/JP coverage for newer surfaces | **KEEP** | None | — | — |
| Fragmented i18n (careerReady/globalReady/speakReady/demo) | 4 separate dictionaries | **MODIFY** | Consolidate into `lib/i18n.js` during migration | P3 | Low |
| Responsive/mobile system | 1 JS hook, 2 files with real CSS breakpoints | **BUILD** | Real responsive design approach needed for multi-pathway, multi-device use | P1 | Medium |
| Achievements/progress (`Achievements.jsx`, `LivingBlueprint.jsx`) | Generalized, pathway-agnostic already | **KEEP** | None significant | — | — |
| `ParentView.jsx` | Live, shareable, explicitly built "additive" | **KEEP** | Extend per pathway as they ship | P3 | Low |
| Stripe checkout + webhook (Netlify, the live one) | Working, signature-verified | **KEEP** | None | — | — |
| Stripe webhook (Cloudflare Pages Functions copy) | Diverged parallel copy | **MODIFY/REMOVE** | Decide the one true deploy target; delete or resync the other | P0 | High (silent entitlement bugs) |
| Empty `stripe/` folder | Vestigial | **REMOVE** | Delete | P3 | None |
| Duplicate `tts.js` (Netlify vs Firebase Functions) | Both exist, both edited together | **MODIFY** | Confirm which is live; consolidate | P1 | Medium |
| `pronunciation-check.js`, `assessment-score.js`, `coaching-card.js`, `learning-path.js` | No auth/quota enforcement — trust client-supplied `uid`/`plan` | **MODIFY** | Add real ID-token verification + server-side quota checks | P0 | High |
| Chat quota enforcement (`chat.js`) | Possibly a silent no-op per code comment, contradicted by current rules | **MODIFY** | Verify live; fix whichever side is wrong | P0 | High |
| AI cost tracking (`geminiActivity`, `apiCosts`) | Logs raw counts, not converted to ¥/$, not fully per-user for TTS | **BUILD** | Add a real per-user monthly cost rollup before beta | P0 | High (business-critical for pricing) |
| Child-safety guardrails in AI prompts | Tone/pedagogy well-specified; no safety-content instructions or filters | **BUILD** | Add explicit safety framing + consider provider safety settings | P1 | Medium-High |
| Curriculum content (per-pathway `data.js` files) | Hardcoded JS, no CMS | **MODIFY** | Fine short-term; needs an editable layer before non-engineer teachers (Educator) can add content | P3 | Low |
| Teacher/school (Educator) features | Do not exist at all | **BUILD** | Entirely new pathway | P4 (per stated priority order) | — |
| In-app notifications | Real, Firestore-backed | **KEEP** | None | — | — |
| Push notifications | Absent | **BUILD** | Only if product need emerges | P4 | Low |
| Re-engagement email (Resend) | Working one-off send function | **MODIFY** | Needs scheduling/automation for real lifecycle marketing | P3 | Low |
| Custom analytics pipeline | Homegrown, privacy-conscious, working | **KEEP** | No urgent change; note no funnel/cohort tooling exists if deeper growth analytics are needed later | — | Low |
| Image assets (213MB, zero WebP) | Ships in full to every visitor | **MODIFY** | Compress/convert before December beta (school devices, phones) | P1 | Medium |
| Sip Speak Learn media (86MB in main `public/`) | Bundled into core app rather than iframed separately | **MODIFY** | Consider hosting as its own site like EIKEN | P2 | Low |
| JS bundling / code-splitting | Only 2 of ~15+ heavy routes lazy-loaded; Admin ships to every visitor | **MODIFY** | `React.lazy()` pass on Admin/Demo/secondary routes | P1 | Low |
| `GymLanding.jsx`, `KinderLanding.jsx` | Unrouted, unreferenced anywhere in code | **REMOVE** | Delete (check for external/marketing links first) | P3 | Low |
| `role: "user"` field on user doc | Set once, never read anywhere as an auth gate | **REMOVE or repurpose** | Either delete or repurpose as the actual pathway/role field once that model is built | P2 | Low |
| Access code redemption system | Working, but activation logging has an open TODO (unpersisted) | **MODIFY** | Finish activation tracking; reusable for Educator bulk licensing | P3 | Low |

---

## 4. Database / User Model Assessment

**Current shape:** one `users/{uid}` doc = one account = one `plan` = one `subscriptions[]` array = one `accountType` (`"individual"` or `"family"`). Family support exists via a `familyMembers` subcollection (real, working, used by EIKEN and the family dashboard) — but it's duplicated by a `familyMembers[]` array field kept in manual sync, and a second, separate `learnerProfiles/{uid}` collection tracks "learner intelligence" (interactions, confidence history, EIKEN results) keyed by the *parent's* uid, not by family member — meaning that data model doesn't actually cover children at all today, only the primary account holder.

**Can it support the four-pathway vision?**
- **Parent + multiple children:** Yes, largely already there. The `familyMembers` subcollection is a real, working primitive.
- **One account, multiple simultaneous pathways** (parent who is also Confidence Adult; teacher who is also a parent): **No** — not modeled at all today. Access is a flat plan/subscriptions array, not a set of independently-held pathway roles.
- **Account vs. Learner/Profile distinction:** Partially exists (family members are a real sub-entity) but is not clean — two parallel "learner" models exist and drift risk is real.

**Smallest safe migration path (do NOT do this yet — audit only):**
1. Fix the `users/{uid}` Firestore rule gap first (Section 0) — independent of pathway work, and urgent regardless.
2. Add an additive `pathways: { family: {...}, confidenceAdult: {...}, educator: {...} }` map (or a `roles[]` array with metadata) to the existing `users/{uid}` doc, so current `plan`/`subscriptions` logic keeps working unmodified for whichever pathway maps to it today, while new pathways get their own namespace.
3. Promote `familyMembers` to the canonical Learner entity referenced by id from whichever pathway owns it; merge or retire `learnerProfiles/{uid}` so there's one learner data model, not two.
4. Replace the hardcoded admin-email allowlist with Firebase custom claims or a `staff/{uid}` collection before building Educator, since a real school/teacher role system will need proper role-based rules and retrofitting this later is harder than building it now while the admin surface is still small.

None of this requires touching Firebase Auth itself or replacing the Firestore SDK — it's schema and rules evolution on top of what exists, not a rebuild.

---

## 5. HSD Family Readiness Score: **~55%**

| Feature | Status |
|---|---|
| Family account / parent profile | **Already Exists** — `accountType: "family"`, `FamilySetup.jsx` |
| Multiple child profiles | **Already Exists** — `familyMembers` subcollection |
| Age/level per child | **Partially Exists** — fields exist on family members; no explicit "recommended journey" logic tying age→pathway yet |
| Recommended learning journey | **Partially Exists** — `learning-path.js` generates a personalized path, but not explicitly age-gated/pathway-structured the way the brief describes |
| Hear / See / Do / Create tiles | **Does Not Exist** as a distinct UI — closest analog is the general AppOrbit/Dashboard app grid, not this specific framing |
| Talk to Jona (age-appropriate) | **Partially Exists** — Jona exists and is capable, but no explicit age-appropriate behavior branching or child-safety guardrails found |
| My Journey (progress/levels/badges) | **Already Exists** — `Achievements.jsx`, `LivingBlueprint.jsx` |
| Family Hub (parent dashboard) | **Partially Exists** — `ParentView.jsx` is a real, working parent report; not yet a full "hub" with controls |
| Activity history / AI usage per child | **Partially Exists** — `geminiActivity` logs exist but aren't rolled up per family or presented to parents |
| Family subscription | **Already Exists** — Stripe `family` tier is live and priced |
| Parental controls / safety | **Does Not Exist** — no content moderation, no parent-configurable restrictions found |

**Why ~55%:** the underlying primitives (accounts, child profiles, progress, achievements, a parent view, billing) are real and working — this is well ahead of a from-scratch build. What's missing is specifically the *presentation layer* the brief describes (Hear/See/Do/Create tiles, a true Family Hub) and the *safety layer* (moderation, parental controls) — both buildable on top of existing data, not blocked by it.

---

## 6. Confidence AI Readiness Score: **~40%**

The "Choose Mission → Prepare → Practice → AI Role-play → Feedback → Try Again → Complete → Confidence Growth" flow described in the brief maps closely to what CareerReady/GlobalReady/SpeakReady already do structurally (practice sessions, AI-driven conversation, progress tracking per pathway) — but each is currently its own siloed folder (own data.js/i18n.js/storage.js), not a shared "Mission" abstraction. Jona is demonstrably capable of role-play/coaching interactions (confirmed across Speak Ready, Career Ready, Sip Speak Learn, EIKEN, Monkey Party). What doesn't exist: a unified Mission data model/UI shared across pathways, and the "Try Again" / structured feedback loop as a reusable component rather than a per-app bespoke implementation.

**Why 40%:** the *AI capability* (Jona conducting a coached practice conversation) is proven repeatedly across the codebase — that's the hard part, and it works. The *product structure* (missions as a shared, reusable concept rather than five parallel bespoke implementations) does not exist yet and is real build work, likely most of "Priority 3: lightweight Confidence AI Alpha."

---

## 7. AI Cost & Usage Assessment

**No client-exposed AI provider key today** (one latent risk: `vite.config.js` injects an empty `VITE_ELEVENLABS_API_KEY` into the client bundle — currently harmless since it's empty and unused, but should be deleted so it can never accidentally leak a real key).

**Tracking that exists:**
- `users/{uid}/chatUsage/{day|month}` — message-count quota check against `PLAN_LIMITS` (enforcement possibly broken in production per a contradicting code comment — needs live verification).
- `geminiActivity` collection — per-call log of uid/model/input+output tokens (a log, not an enforcement mechanism).
- `apiCosts/{day}` — aggregate (not per-user) ElevenLabs call/character counts.

**What's missing before the beta can answer "what does an active family cost us per month":**
1. Live-verify chat.js's quota actually blocks users at their limit (the code comment says it's a "silent no-op in production").
2. Add real ID-token verification + quota checks to four currently-ungated endpoints (`pronunciation-check.js`, `assessment-score.js`, `coaching-card.js`, `learning-path.js`) — right now they trust a client-supplied `uid` with no auth.
3. Track ElevenLabs TTS cost **per user**, not just aggregate per day — TTS is billed per character, fires on nearly every AI turn across 5+ apps, and is likely the single largest cost line the business currently cannot see broken down by family.
4. Compute and store an actual ¥/$ estimate per user per month (Gemini tokens × pricing + TTS characters × pricing) — nothing today converts the raw counts into money. **This is the single most important instrumentation gap to close before quoting a ¥1,500 price with confidence.**
5. Consider a separate cap specifically for the voice-conversation apps (Career/Global/Speak Ready, Sip Speak Learn) since each conversational turn triggers both a chat call and a TTS call — the highest-cost pattern in the platform, currently drawing from the same flat quota pool as everything else.
6. Reconcile the two independent sources of truth for plan limits: `stripe-webhook.js`'s `AI_LIMITS` map (written to `aiMsgLimit` on the user doc) vs. `chat.js`'s separately hardcoded `PLAN_LIMITS` — they agree today but will silently drift.

---

## 8. Security & Child Safety Assessment

**CRITICAL** (see Section 0 for full detail — repeated here for completeness):
1. `users/{uid}` Firestore rule allows self-granted billing/plan changes.
2. `config/killSwitch` is writable by anyone, unauthenticated — full platform DoS available with no login.

**HIGH**
3. `SHUTDOWN_PASSCODE` has a hardcoded source-code fallback — verify the real env var is set in production and rotate the passcode.
4. `chat.js` trusts a client-supplied `plan` for rate-limit tier selection, with no server-side cross-check.
5. No content moderation/safety filtering on AI output reaching children — no provider safety settings, no output filter, no blocklist found anywhere in the codebase.

**MEDIUM**
6. `analytics/`, `apiCosts/`, `geminiActivity` are writable by anyone unauthenticated (intentional, for bare-API-key server writes, but means anyone can forge or pollute these records).
7. Admin authorization is a hardcoded email string duplicated in ~15 places across rules and client code, with two inconsistent admin lists.
8. Duplicate/parallel learner data models (`familyMembers[]` array + subcollection + separate `learnerProfiles/{uid}`) risk drift.
9. No `storage.rules` file exists in the repo — if Firebase Storage is used anywhere, its rules are unaudited here and must be checked directly in the Firebase console.

**LOW**
10. Stray Firebase Admin SDK key file on disk outside any repo — confirmed dormant/unused by code, but should be deleted or vaulted since it's a plaintext, indefinitely-valid credential with no remaining purpose.
11. `delete-account.js` deletes Firestore data but leaves Firebase Auth user deletion to the client — a failed/skipped client step can leave a "ghost" Auth account with an emptied profile.

**Child safety specifically:** AI conversation *content* is not persisted (only usage metadata is logged), which is good for data-retention exposure but means there's no audit trail if a moderation incident needs investigating after the fact. There's no independent "child login" — family members are passive sub-profiles entirely managed through the parent's session, which is appropriate for young children but has no path forward yet for an older-student pathway that might need its own login.

---

## 9. Performance Assessment

**Top 5 opportunities, ranked by impact:**
1. **Code-split `Admin.jsx` (2,256 lines) and secondary routes** (`Demo*`, `OnboardingV2`, `Assessment`) — these are statically imported today, meaning every family/child visiting for the first time downloads the entire internal admin console's code even though they'll never open it. `SipSpeakLearn` and `EikenApp` are already correctly lazy-loaded — extend the same pattern.
2. **Convert images to WebP/AVIF and compress the two largest asset sets**: `public/ssl/drinks/` (60MB across 64 files) and `public/assets/portal/` (22MB, six near-duplicate ~2MB "state" PNGs). Zero WebP files exist anywhere in 213MB of images — this is the single biggest easy win for phones/school devices.
3. **Replace the six sequential "portal" state PNGs (~2MB each) with CSS/SVG state transitions or a sprite** rather than swapping full-resolution frames.
4. **Consider hosting Sip Speak Learn's media (86MB) as its own separately-deployed site**, matching the existing EIKEN pattern, rather than bundling it into the core app's `public/` folder.
5. **Add compression/fallback for `ssl-welcome-hero.mp4` (2.4MB, no WebM/poster-frame strategy)** and confirm it isn't autoplaying unconditionally on slow connections.

Dependencies are lean (no bloated UI kit) — the bundle bloat is first-party code and uncompressed assets, not third-party libraries.

---

## 10. Recommended Future Architecture

```
                         ┌─────────────────────────┐
                         │      HSD OS CORE         │
                         │  (mostly already exists) │
                         │                          │
                         │  • Firebase Auth         │
                         │  • users/{uid} + roles/  │
                         │    pathways map (BUILD)  │
                         │  • familyMembers as      │
                         │    canonical Learner     │
                         │  • Stripe billing        │
                         │    (consolidate to 1     │
                         │    webhook impl)         │
                         │  • Jona/AI (Gemini+      │
                         │    Claude fallback) +    │
                         │    real cost tracking    │
                         │    (BUILD)               │
                         │  • Achievements/progress │
                         │  • Custom analytics      │
                         │  • AppModal iframe/SSO   │
                         │  • Central i18n          │
                         └────────────┬─────────────┘
                                      │
              Pathway configuration layer (mostly BUILD —
              currently `worldCategories.js` is the closest
              precedent, as a display grouping, not a router)
                                      │
        ┌──────────────┬─────────────┼─────────────┬──────────────┐
        ▼              ▼             ▼              ▼
   HSD FAMILY   CONFIDENCE STUDENT  CONFIDENCE ADULT  HSD EDUCATOR
   (~55% ready)   (via Mission        (via Mission      (0% — net
                  abstraction,        abstraction,       new build)
                  ~40% ready)         ~40% ready)
```

The core is more "already there" than the brief may have assumed — the gap is mostly in formalizing the pathway concept as data/routing (not display grouping), consolidating the two learner models, closing the security holes, and building real AI cost visibility. Confidence Student and Confidence Adult can likely share one "Mission" abstraction rather than being fully separate — CareerReady/GlobalReady/SpeakReady are already structurally similar enough that a shared Mission component is a real option rather than a stretch.

---

## 11. Migration Roadmap

**PHASE 0 — Protect Current System**
- Fix the two CRITICAL Firestore rules issues (Section 0) — independent of everything else, do this first regardless of pathway timeline.
- Confirm `SHUTDOWN_PASSCODE` env var is actually set in Netlify production; rotate the passcode.
- Decide which Stripe webhook (Netlify vs. Cloudflare) is actually live; delete or resync the other.
- Delete or vault the stray Firebase Admin SDK key file.
- Live-verify chat.js's quota enforcement actually works.

**PHASE 1 — Shared Core**
- Add the additive `pathways`/`roles` map to `users/{uid}` (non-breaking).
- Consolidate `familyMembers[]` array + subcollection + `learnerProfiles/{uid}` into one canonical Learner model.
- Add server-side ID-token verification + quota checks to the four currently-ungated AI endpoints.
- Replace the client-supplied `plan` trust in `chat.js` with a server-side lookup.
- Move admin authorization to custom claims or a `staff/{uid}` collection.

**PHASE 2 — Pathway Selector**
- Promote `worldCategories.js` from a display grouping into a first-class pathway/routing concept; add Educator as a fourth category.
- Build the "Switch Pathway" UI and "return to last-used dashboard" logic.
- Consolidate the fragmented i18n files into `lib/i18n.js`.

**PHASE 3 — HSD Family Foundation**
- Build the Hear/See/Do/Create tile UI on top of existing content and Jona.
- Extend `ParentView.jsx` into a full Family Hub with controls.
- Build the parental-controls/safety layer (content moderation on AI output — new work, not present anywhere today).
- Code-split `Admin.jsx` and secondary routes; compress/convert the image assets — both matter directly for the December beta's target devices.

**PHASE 4 — Jona + AI Measurement**
- Build the real per-user ¥/$ cost rollup (Gemini tokens + TTS characters → money) — this is the number the whole pricing model depends on.
- Add explicit child-safety framing to Jona's system prompts; evaluate provider-level safety settings.
- Add a separate cap for voice-conversation apps given their higher per-turn cost pattern.

**PHASE 5 — Family Beta**
- Recruit the 20–30 families per the beta plan; ship the (deliberately minimal) Family experience from Phase 3 with cost tracking from Phase 4 live and watching from day one.

**PHASE 6 — Confidence AI Alpha**
- Build the shared Mission abstraction (Choose Mission → Prepare → Practice → AI Role-play → Feedback → Try Again → Complete) generalizing the CareerReady/GlobalReady/SpeakReady pattern, rather than adding a fourth bespoke silo.

**PHASE 7 — Educator**
- Net-new build. The Admin console's Firestore live-listener/per-user-drill-down pattern and the existing access-code redemption system (once its activation-logging TODO is finished) are reusable starting points for classroom/school licensing.

---

## 12. Next 10 Development Tasks

1. **Fix `users/{uid}` Firestore write rule (billing bypass).**
   Objective: prevent client-side self-granting of `plan`/`subscriptions`/`planStatus`/`accessPass`.
   Files: `firestore.rules`.
   Dependencies: none.
   Risk: Low (rules-only change) but must be tested against every legitimate client write path (`useAuth.jsx`, `FamilySetup.jsx`, etc.) so nothing legitimate breaks.
   Complexity: Small.
   Definition of done: an authenticated non-admin user cannot successfully write `plan`/`subscriptions`/`planStatus`/`accessPass`/`isAdmin` to their own doc via the client SDK; all existing legitimate flows (signup, Stripe webhook via service account, admin actions) still work.

2. **Fix `config/killSwitch` Firestore write rule.**
   Objective: close the unauthenticated kill-switch write vulnerability.
   Files: `firestore.rules`.
   Dependencies: coordinate with task 1 (same file/deploy).
   Risk: Low, but must confirm `kill-switch.js`'s server-side write path (bare API key, no auth token per its own comment) still works after tightening — may need to route it through the service account instead.
   Complexity: Small.
   Definition of done: an unauthenticated request cannot modify `config/killSwitch`; the legitimate kill-switch function still works end-to-end.

3. **Live-verify chat.js quota enforcement; resolve the eiken-evaluate.js comment contradiction.**
   Objective: know for certain whether the daily/monthly AI message cap actually blocks users in production.
   Files: `netlify/functions/chat.js`, `netlify/functions/eiken-evaluate.js`, `firestore.rules`.
   Dependencies: tasks 1-2 (rules changes may affect this).
   Risk: Medium — if it's genuinely broken, real uncapped AI spend is possible today.
   Complexity: Small-Medium (mostly testing/verification, plus a fix if broken).
   Definition of done: a test account hitting its plan's daily limit receives a 429/blocked response, confirmed live, not just in code.

4. **Add ID-token verification + quota checks to the four ungated AI endpoints.**
   Objective: close the trust-a-client-supplied-uid gap on `pronunciation-check.js`, `assessment-score.js`, `coaching-card.js`, `learning-path.js`.
   Files: those four Netlify functions; reference `_firebaseAdmin.js`'s existing token-verification pattern used elsewhere.
   Dependencies: none.
   Risk: Medium (touches production AI endpoints).
   Complexity: Medium.
   Definition of done: all four endpoints reject requests without a valid Firebase ID token and enforce the same quota pattern used in `chat.js`.

5. **Resolve the Stripe webhook duplication (Netlify vs. Cloudflare).**
   Objective: one true source of billing logic; delete or resync the other.
   Files: `netlify/functions/stripe-webhook.js`, `functions/api/stripe-webhook.js`, related `create-checkout.js`/`customer-portal.js` pairs.
   Dependencies: confirm with Stripe dashboard which endpoint URL is actually configured as live.
   Risk: High if done carelessly (billing-critical path) — low if the dead copy is simply deleted after confirming it's not receiving traffic.
   Complexity: Small-Medium.
   Definition of done: exactly one webhook implementation exists (or both are provably identical and intentionally kept in sync), confirmed against the Stripe dashboard's configured endpoint.

6. **Build real per-user AI cost rollup (¥/$ per family per month).**
   Objective: answer the business's central open question before pricing is finalized.
   Files: new logic likely in `netlify/functions/`, reading `geminiActivity` + TTS character logs, writing to something like `users/{uid}/aiCostEstimate/{month}`; surfaced in `Admin.jsx`.
   Dependencies: task 4 (need accurate per-user usage first); needs current Gemini/ElevenLabs pricing rates.
   Risk: Low (additive, read-heavy).
   Complexity: Medium.
   Definition of done: Admin console can show an actual ¥/$ estimate per family per month, computed from real Gemini token and ElevenLabs character usage, not just raw counts.

7. **Add explicit child-safety framing to Jona's system prompts; evaluate provider safety settings.**
   Objective: close the content-moderation gap before opening the beta to unfamiliar families.
   Files: `src/lib/claude.js` (`HSD_AI_SYSTEM`) and the per-app system prompts (Speak Ready, Career Ready, Global Ready, Sip Speak Learn, Monkey Party).
   Dependencies: none.
   Risk: Low-Medium (prompt changes need re-testing tone/behavior didn't regress).
   Complexity: Small-Medium.
   Definition of done: every child-facing AI prompt includes explicit content-safety boundaries; Gemini `safetySettings` are evaluated and set where appropriate; a documented plan exists for what happens if a concerning input is detected.

8. **Consolidate the duplicate learner data models.**
   Objective: retire the manually-synced `familyMembers[]` array and merge/deprecate `learnerProfiles/{uid}` so there's one canonical Learner entity.
   Files: `src/pages/Dashboard.jsx`, `src/lib/learnerProfile.js`, `src/pages/ParentView.jsx`, `netlify/functions/eiken-progress.js`, `delete-account.js`.
   Dependencies: should happen before Phase 1's pathways map is added on top.
   Risk: Medium (touches data read in many places — needs careful migration/dual-write period).
   Complexity: Medium-Large.
   Definition of done: one source of truth for family-member/learner data; no more manual array-sync code; ParentView and EIKEN read from the same place.

9. **Code-split `Admin.jsx` and secondary routes; compress the image asset sets.**
   Objective: reduce first-load bundle/asset size before the December beta, which targets phones and school devices.
   Files: `src/App.jsx` (lazy-load Admin/Demo/Assessment/OnboardingV2), `public/assets/portal/`, `public/ssl/drinks/` (convert to WebP, compress).
   Dependencies: none.
   Risk: Low.
   Complexity: Small (code-splitting) + Medium (asset pipeline work).
   Definition of done: main JS bundle no longer includes Admin console code for non-admin visitors; largest image sets converted to WebP with meaningfully reduced total size.

10. **Design the additive `pathways`/`roles` data model (design only, no migration yet).**
    Objective: produce the concrete schema for how one account can hold multiple pathways, as the foundation for Phase 1/2, without touching production data yet.
    Files: none changed — this is a design task, likely a short spec document plus a proposed Firestore rules shape.
    Dependencies: should follow task 8 (consolidated learner model) so the pathways map has one clean thing to attach to.
    Risk: None (design-only).
    Complexity: Medium (requires reasoning through all four pathways' access patterns).
    Definition of done: a written schema for `users/{uid}.pathways` (or equivalent), reviewed and approved, ready to implement as Phase 1 begins.

---

**STOP — awaiting approval of this architecture and the first development phase before any implementation begins.**
