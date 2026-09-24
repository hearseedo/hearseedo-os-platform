# Jona Architecture Audit — response to the Jona Architecture Directive

**Date:** 2026-09-24
**Scope:** `hsd-os-platform` + sibling iframe apps (EIKEN, Monkey Yoga Phonics V2, Monkeys Unlock). Read-only audit, no implementation. Builds on `docs/HSDOS_AUDIT_2026-09-09.md` — this doc only restates what's still relevant from that one; see it for the full data-model/performance detail not repeated here.
**Purpose:** Answer the 16 questions in Section 21 of the directive, before any "Jona is the HSD interface" implementation work begins.

---

## 1. What already exists

- **A real, working Jona.** `src/lib/claude.js`'s `sendMessage(messages, user, lang, context)` → Netlify function `chat.js` → Gemini 2.5 Flash. Server-verifies the Firebase ID token, looks up the user's *real* plan server-side (not client-supplied), enforces a per-day message quota, and — as of this session — accepts an optional `context` object (`{ pathway, appName, lesson }`) that gets woven into the system prompt so Jona's answer is grounded in what the learner is actually looking at.
- **A cross-origin bridge for iframe sub-apps.** `AppModal.jsx` (parent) ↔ `askJona()` (child, in Phonics V2 and Monkeys Unlock) via `HSD_OS_ASK_JONA` / `HSD_OS_JONA_REPLY` postMessage, so a sub-app with no Firebase session of its own can still ask Jona a question — the parent makes the real call and returns only the text.
- **One reusable UI component**, `src/jona/GlobalJonaAssistant.jsx`, built this session, now live inside the main dashboard, EIKEN, Phonics V2, and Monkeys Unlock — floating bubble, `context` prop, `demoScript` mode for public no-auth demos, `freeText` toggle for young-child prompts-only apps.
- **A server-side safety floor.** `chat.js` appends a non-negotiable `SERVER_SAFETY_FLOOR` string to *every* request regardless of what the client sends — no PII collection, no discussing violence/self-harm/illegal activity, explicit "tell a trusted adult" instruction, never claims to be human. This is real and already shipped, not aspirational.
- **Voice — but only in the older surfaces.** `src/components/AIChat.jsx` (the main dashboard Jona chat) has both browser `SpeechRecognition` (STT) input and ElevenLabs TTS (`/api/tts`) output already wired, as do Speak Ready, Career Ready, Global Ready, EIKEN, and Sip Speak Learn. **`GlobalJonaAssistant.jsx` — the new component meant to go into every app — is text-only.** This is the single biggest gap against the directive's "voice must be first-class" principle, and it's a gap in the newest, most cross-cutting piece, not an old one.
- **Two of the security CRITICALs from the 2026-09-09 audit are fixed.** `users/{uid}` writes now go through `touchesPrivilegedFieldsOnCreate/Update()` — a client can no longer self-grant `plan`/`subscriptions`/`planStatus`. `config/killSwitch` is now `isAdminEmail()`-gated for writes, public read only. Both closed since the last audit.
- **`familyMembers` subcollection** — real, working parent+multiple-children primitive, used by EIKEN, Family, Dashboard.
- **`worldCategories.js`** — the closest existing thing to a pathway concept (Kids/Teens&Uni/Adults/Family display grouping).

## 2. What partially exists

- **Context-awareness.** `GlobalJonaAssistant` can receive `{ pathway, appName, lesson }`, but nothing populates *learner identity* into it beyond that — no age band, no ability/level, no recent-struggle signal. Today "Jona knows where you are" is true at the app/lesson level, not the learner level.
- **Memory.** None, beyond the current in-session React state (`messages` array, lost on close/refresh) and the per-day message *count* (for quota, not content). No conversation is persisted anywhere. This is good for the "don't retain sensitive disclosures" instinct in the directive, but it also means Jona has zero continuity between sessions — it can't say "last time you mentioned X."
- **Safety layer.** The `SERVER_SAFETY_FLOOR` is real but it's one flat instruction baked into every prompt, not a classification system. There is no NORMAL/SENSITIVE/HIGH RISK/IMMEDIATE DANGER distinction, no escalation flow, no logged safety-trigger events, no age/jurisdiction-aware routing. It relies entirely on the model itself behaving as instructed — no independent check.
- **Multi-provider abstraction.** Despite `src/lib/claude.js`'s filename and the 2026-09-09 audit's architecture map saying "Gemini primary / Claude fallback," there is **no Anthropic API key or Claude call anywhere in `netlify/functions`** — `chat.js` is Gemini-only. `claude.js` is a client-side naming artifact; it POSTs to the same `/api/chat` → Gemini path as everything else. The directive's "Jona is not Gemini, ChatGPT, Claude or Grok — it's an interface that routes to them" is not built; today there is exactly one provider, hardcoded, with no fallback if it's down (the `killSwitch` disables it entirely rather than routing around it).
- **Family Educator context** — parent/family-level questions ("what are we working on this week?") aren't answerable yet; nothing aggregates a child's week into a form Jona could summarize on request.

## 3. What is missing entirely

- **Jona Agent Network** — no orchestration layer, no Codex/Grok integration, no least-privilege routing concept. Zero code toward this.
- **Configurable usage allowances.** `PLAN_LIMITS` in `chat.js` is a hardcoded object in source (`free: 5, individual: 50, family: 100, ...`) requiring a code deploy to change. No admin UI for allowances, no "Jona Conversation Pack" top-up concept, no cost-per-conversation model.
- **Safety-never-paywalled.** Today the quota check happens *before* the message is even sent to the model — hitting your daily limit returns a flat 429 with no distinction for what the message contains. A child in real distress who has used their daily quota gets "You've used all 5 messages for today," not a safety response. This directly contradicts directive Section 8 and is the most concrete, fixable P0 gap this audit found.
- **Real per-user AI cost tracking.** Unchanged from the 2026-09-09 finding — `geminiActivity`/`apiCosts` log raw counts, not money, not fully per-user for TTS. The business still cannot answer "what does one active family cost us per month."
- **Evidence-based, versioned safety/knowledge policy.** Nothing resembling a documented, sourced child-development/safeguarding policy exists — current safety behavior is one prompt string, not a reviewed and versioned knowledge base.
- **Provider failure/fallback UX.** If Gemini is down or the kill switch is flipped, the user-facing behavior needs checking per-surface, but there's no generic "Jona is on a quick break" fallback layer described anywhere in code — each surface handles its own error state independently.

## 4. Current Jona architecture (as it actually is today)

```
User (any surface)
  │
  ▼
GlobalJonaAssistant.jsx  (dashboard / EIKEN / Phonics V2 / Monkeys Unlock)
  or AIChat.jsx / AICoach.jsx / JonaCoach.jsx  (older, per-surface chat UIs — have voice)
  │
  ├─ same-origin apps: sendMessage(messages, user, lang, context) [src/lib/claude.js]
  │                        │
  │                        ▼
  │                   POST /api/chat  (chat.js)
  │                        │  verify idToken → real plan lookup → quota check
  │                        │  append SERVER_SAFETY_FLOOR
  │                        ▼
  │                   Gemini 2.5 Flash  (only provider; killSwitch can disable, no fallback)
  │
  └─ cross-origin iframe apps (Phonics V2, Monkeys Unlock):
         child posts HSD_OS_ASK_JONA → AppModal.jsx (already-authenticated parent)
         → same sendMessage() path above → HSD_OS_JONA_REPLY back to child
         (no API key/session ever crosses the origin boundary)
```

Five to six different Jona-shaped UIs exist across the codebase (`AIChat`, `AICoach`, `JonaCoach`, per-app custom chat screens like EIKEN's old "Jonathan AI" that was just removed, and now `GlobalJonaAssistant`) — `GlobalJonaAssistant` is the intended consolidation point but the older ones haven't been retired, and it's currently the *least* capable of them (no voice, no memory) despite being the newest and most widely deployed.

## 5. Current Gemini/Google architecture

- Firebase Auth (email/password + Google) — working, server-verified.
- Firestore — primary data store, rules recently hardened (Section 1 above).
- Gemini 2.5 Flash — sole LLM provider, called server-side only (no client-exposed key).
- Netlify Functions — the actual compute layer (not Firebase Cloud Functions, despite the "Firebase Functions" naming that appears in some file comments/dupes noted in the 2026-09-09 audit — worth resolving which is canonical if not already done).
- No Google Cloud services beyond Firebase (no Vertex AI, no Cloud Run) found in this pass.

## 6. Current voice architecture

- **STT:** browser-native `window.SpeechRecognition`/`webkitSpeechRecognition` — client-side only, no server component, used in ~9 surfaces (Career Ready, Global Ready, Speak Ready ×3, EIKEN, Sip Speak Learn, AIChat, AICoach, JonaCoach, WarmUp). No Japanese-specific tuning verified in this pass.
- **TTS:** ElevenLabs via two Netlify functions (`tts.js`, `speak-ready-tts.js`) — a real API cost per character, not yet tracked per-user (see Section 3).
- **Gap:** `GlobalJonaAssistant` (the consolidation target) has neither. Any "wire Jona in everywhere" work needs to either add voice to it or explicitly decide it stays text-only in prompts-only child apps (which may be the right call for very young learners — but it should be a decision, not an omission).

## 7. Current authentication and permission architecture

- Firebase Auth ID tokens, server-verified in `chat.js` and (per the 2026-09-09 audit) most but not all AI endpoints — worth re-verifying `pronunciation-check.js`/`assessment-score.js`/`coaching-card.js`/`learning-path.js` got the same treatment; not re-checked in this pass.
- Admin authorization: **still** two hardcoded email strings (`isAdminEmail()` in `firestore.rules`, mirrored in client `OWNER_EMAILS`) — no custom claims, no `staff/{uid}` collection. Unchanged from 2026-09-09. This matters for the directive's "least-privilege agent network" principle — the same all-or-nothing pattern would need to not be copied forward into agent permissions.
- Cross-origin trust: `AppModal.jsx` validates both `e.origin` (against the app's registered `iframeUrl`) and `e.source` (must be the actual iframe's contentWindow) before accepting any message — this is a solid pattern, already proven, and is what any future agent-to-agent or Jona-to-tool boundary should mirror.
- One inconsistency flagged in passing: `hsd-monkeys-unlock`'s `ssoBridge.ts` still accepts `HSD_OS_AUTH` from any origin (an older, pre-correction pattern) — noted but not fixed in this session per earlier scoping discussion.

## 8. Current Jona memory/data storage

- **None, persistently.** Conversation state lives only in component `useState`, lost on close or refresh.
- Usage *counts* (not content) persist in `users/{uid}/chatUsage/{day}` for quota purposes only.
- `learnerProfiles/{uid}` and `familyMembers` (see the 2026-09-09 audit, Section 4) hold structured progress/profile data Jona *could* draw on for personalization, but nothing currently reads them into a Jona prompt.
- No categorized memory tiers (session/learning/account/sensitive) exist — the directive's Section 10 concept is entirely new work.

## 9. Current billing/usage-metering capabilities

- Real, server-enforced daily message quota per plan (`PLAN_LIMITS` in `chat.js`) — this is more solid than the 2026-09-09 audit found; the "silent no-op" concern from that audit appears resolved (quota check now happens before the model call, returns real 429s).
- Hardcoded in source, not admin-configurable, no top-up mechanism, no distinction between text and voice usage, no per-conversation cost model, no cost visibility by pathway. All of Section 11-13's directive requirements (configurable allowances, top-ups, a fair "conversation" definition) are unbuilt.
- No safety-exempt path (Section 3 above) — the most important gap to close before allowances get stricter for the beta.

## 10. Security concerns identified in this pass

1. **P0 — Safety responses can be blocked by quota.** The single most concrete, actionable finding from this audit. A quota-exhausted user in real distress gets a plain "limit reached" message instead of any safety response. Fix is scoped and small: classify intent (or at minimum, always let the request through and let the model's own safety floor respond) before quota-blocking, and never count a safety-flagged turn against the daily limit.
2. **P1 — No independent safety-risk classification.** Current safety behavior is entirely inside one LLM prompt, with no server-side check on the *output* and no logged trail of when the safety floor actually activated. If a real incident happened today, there would be no record to investigate (this echoes the 2026-09-09 finding, still true).
3. **P1 — Admin authorization is still two hardcoded emails.** Fine at current scale; will not scale to "which agent/role can see what" once an agent network exists. Should be resolved (custom claims or `staff/{uid}`) before building least-privilege agent routing on top of it, per the 2026-09-09 audit's own recommendation, which still stands.
4. **P2 — Single point of AI-provider failure.** No fallback if Gemini is down; the kill switch is a blunt "everyone loses Jona" lever, not a routed failover. Not urgent for December beta scale, but worth deciding now given the directive explicitly wants provider abstraction.
5. **Confirmed fixed since 2026-09-09:** self-grantable billing, open kill-switch write access — both now correctly gated.

## 11. What should change before the December beta (P0)

- Fix the quota-vs-safety ordering in `chat.js` (Section 10.1) — small, scoped, high-value.
- Add explicit safety-risk logging (even just "safety floor activated" + timestamp + uid, no message content) so there's an audit trail without storing conversation content.
- Decide and document: does `GlobalJonaAssistant` get voice before beta, or does the beta explicitly ship text-only for the newer surfaces while older surfaces keep voice? This is a real product decision, not just an engineering one — flagging for Jonathan below.
- Resolve the admin-email-allowlist debt if any agent/role work is planned to land before beta; otherwise this can wait.
- Nothing in this list requires the Agent Network, multi-provider routing, or Jona memory system — none of that is beta-blocking.

## 12. What should wait until after beta (P1/P2)

- Jona Agent Network (Codex/Grok/multi-provider routing) — genuinely future architecture; nothing about the December beta needs it.
- Jona long-term memory tiers — the current stateless-per-session behavior is safe by default; building memory prematurely is a bigger privacy surface than the beta needs.
- Configurable allowances/top-ups admin UI — hardcoded limits are fine for a 20-30 family beta; build the admin config layer once real usage data justifies specific numbers (see Section 9).
- Multi-provider fallback — one provider is an acceptable beta risk given the kill switch already exists as a manual lever.

## 13. Proposed Jona Agent Network architecture (P2 — not for beta)

The directive's `USER → JONA → HSD CONTEXT/PERMISSIONS/SAFETY/MEMORY → APPROPRIATE TOOL` shape maps cleanly onto the postMessage/origin-validation pattern already proven in `AppModal.jsx` — that's the one piece of existing architecture worth carrying forward conceptually: every tool Jona routes to should only receive the minimum context needed, validated at a boundary, exactly like the iframe bridge does today. Concretely, when this is built: Jona itself should stay a thin orchestration layer (intent classification + context assembly), with Gemini remaining the default conversational model, and Codex/Grok added as narrowly-scoped tools behind an explicit approval step for anything consequential (matches the directive's own "human control" section) — not designed further here since it's explicitly P2.

## 14. Proposed Jona Safety Layer (P0/P1 mix)

- **P0 (before beta):** fix quota-vs-safety ordering; add safety-activation logging (metadata only).
- **P1 (before opening beyond known families):** build the NORMAL/SENSITIVE/HIGH RISK/IMMEDIATE DANGER classification the directive describes, sourced from actual child-safeguarding references (NSPCC, Common Sense Media's AI safety guidance, or similar) rather than generated from the LLM's own judgment — the directive explicitly asks for this, and this audit did not do that research; it should be its own scoped task with citations, reviewed before it becomes policy.
- Needs a decision from Jonathan either way (see Section 16).

## 15. Proposed Jona usage/cost architecture (P1/P2)

Matches the existing 2026-09-09 audit's Phase 4 recommendation almost exactly: instrument real per-user ¥/$ cost (Gemini tokens + ElevenLabs characters) before setting any top-up/allowance numbers. The directive adds two things worth folding in: (a) a fair session-based "conversation" definition (duration + inactivity timeout + turn cap, not per-message billing) instead of the current flat daily-message-count model, and (b) admin-configurable allowances instead of hardcoded `PLAN_LIMITS`. Both are real, scoped builds — P1, not needed for a 20-30 family beta where flat-rate is fine.

## 16. Decisions needed from Jonathan

1. **Does `GlobalJonaAssistant` need voice before or shortly after the December beta?** It's currently the only Jona surface without it, and it's the one going into the most apps. Options: (a) add voice to it now, (b) explicitly keep it text-only for young-child prompts-only contexts (Phonics V2, Monkeys Unlock) and only add voice where free-text already exists (EIKEN, main dashboard), (c) defer entirely post-beta.
2. **How urgent is the quota-vs-safety fix (Section 10.1/11)?** This audit rates it P0 given the directive's explicit "safety must never be paywalled" principle, but it hasn't caused a known incident — confirming priority before scheduling it.
3. **Safety-layer sourcing** (Section 14) — who should review/approve the safeguarding references before they become Jona's actual policy? This shouldn't be generated and shipped without a second set of eyes given the audience.
4. **Provider strategy** — is Claude/Codex/Grok integration something to prototype soon, or genuinely post-beta? The directive frames it as long-term vision; confirming there's no near-term deadline driving it.
5. **Memory** — any appetite for even minimal cross-session memory (e.g., "last completed lesson") before beta, or is stateless-per-session the right default to ship with and revisit later?

---

**No implementation has started.** This is the audit only, per the directive's Section 21 instruction — awaiting direction on the above before touching code.

---

## 17. Decisions (Jonathan, 2026-09-24)

In response to Section 16's open questions:

1. **Voice — YES, P0.** Add voice to `GlobalJonaAssistant` before beta, reusing the existing proven STT/TTS implementation rather than building a second one. Typing stays available; voice is core, not accessory — many learners can't type what they want to ask in English.
2. **Safety-before-quota — FIX NOW, P0.** A quota-exhausted user must still be able to receive a safety response, via a *restricted* pathway (risk classification → safety response/escalation only, never general-purpose Jona) — not simply a quota bypass. Must be abuse-resistant and tested.
3. **Safeguarding knowledge — curated and sourced, approval required before implementation.** Jona is a learning/confidence coach informed by evidence-based principles, never a therapist/diagnostician. Every principle must trace to a documented, versioned source. **The source list and resulting policy structure must be shown to Jonathan for approval before implementation** — this audit's job is to propose that list, not build the policy.
4. **Provider strategy — design now, build later (P2).** Beta stays on Gemini only; no multi-provider complexity before beta. Document (don't yet build) an abstraction that avoids permanently locking Jona to Gemini. Codex and Grok operate as separate internal HSD agents (engineering/QA and marketing/research respectively) — neither enters the child-facing Jona runtime. Claude remains the builder of HSD OS AI itself.
5. **Memory — conservative, educational-only, for beta.** Jona may use existing educational data (pathway, level, current/completed lessons, progress, achievements, goals) — explicitly NOT auto-generated from emotional/sensitive disclosures. Session context, long-term educational memory, and sensitive/safety information must be kept as separate categories with different handling; data minimization is the default.

**Beta objective, restated simply:** make the Jona that already exists safe, available everywhere, voice-enabled, context-aware, and extremely easy to use. Not the full Agent Network — that grows behind this later.

---

## 18. Proposed P0 Implementation Plan (for approval — nothing below has been built yet)

### P0-A. Voice in `GlobalJonaAssistant`

**Reuse, don't rebuild.** `src/components/AIChat.jsx` already has a working, proven pattern:
- STT: `window.SpeechRecognition || window.webkitSpeechRecognition`, one-shot recognition → `send(transcript)`.
- TTS: `POST /api/tts` (existing ElevenLabs-backed function) → blob → `Audio` → `.play()`, with markdown stripped from the text first.

**Plan:** extract this into one shared hook, e.g. `src/hooks/useJonaVoice.js`, exposing `{ listening, speaking, voiceOn, toggleVoice, startListening, speak(text) }`. Refactor `AIChat.jsx` to use it (proves the extraction didn't change its behavior — same component, same output, just sourced from the hook) and add it to `GlobalJonaAssistant.jsx` behind a new `voiceEnabled` prop (default `true` where `freeText` is `true`; for prompts-only child apps like Phonics V2/Monkeys Unlock, default voice **output** on — Jona can speak its answer — but keep voice **input** off there for now, since the existing prompts-only decision for those apps was specifically about not exposing free-form input to an AI, which applies to voice-to-text the same way it applies to typing. This needs your confirmation, not assumed — see open question below.)

Interaction shape per your directive: Talk → Understand → Respond → Listen, i.e. a mic button starts STT, the transcript is sent exactly like a typed message, and the reply is optionally spoken back — typing stays available alongside it, never replaced.

**Files touched:** new `src/hooks/useJonaVoice.js`; `src/components/AIChat.jsx` (refactor to use it, behavior-preserving); `src/jona/GlobalJonaAssistant.jsx` (add voice UI + `voiceEnabled` prop); no backend changes needed (`/api/tts` and STT are both already live).

**Open question:** should voice *input* be enabled in the child-facing, prompts-only apps (Phonics V2, Monkeys Unlock), or only voice *output* there? Recommend: output-only in those two apps for now (Jona can speak, child still taps rather than free-talks), full talk+listen everywhere else. Flagging for your confirmation before implementing.

### P0-B. Safety-before-quota restricted pathway

Current flow in `netlify/functions/chat.js` (verified in this pass):
```
verify idToken → getRealPlan(uid) → getCount(uid) → if count >= limit: return 429  → (only then) call Gemini
```
The quota check happens *before* the message content is ever considered — a safety-relevant message and a "tell me a joke" message are indistinguishable at that point today.

**Proposed new flow:**
```
verify idToken
  → lightweight risk classification of the incoming message (see below)
  → if flagged SENSITIVE/HIGH RISK/IMMEDIATE DANGER:
        skip quota check entirely
        route to a RESTRICTED safety system prompt (support/escalation only —
        explicitly instructed not to answer general questions, do homework,
        or continue as normal Jona)
        log a safety-activation event (metadata only: uid, timestamp, risk
        tier — never the message content) to a new users/{uid}/safetyEvents
        collection, admin-readable only
        do NOT increment chatUsage
  → else:
        existing quota check (unchanged) → normal Jona
```

**Classification approach — kept intentionally simple for P0, not a separate ML model:** a fast keyword/pattern pre-check (self-harm, violence, abuse, "no one understands me" / "want to disappear"-class phrases, requests to keep something secret from parents) run server-side on the message before the Gemini call. This is a blunt instrument by design for P0 — it will have false positives (fine, "falls through to a safety-flavored but harmless response" is a safe failure mode) and it is not the researched classification system from Section 14/P0-C below; it's the minimum viable gate to stop safety responses from being quota-blocked, buildable now, replaceable later once the sourced policy exists.

**Abuse resistance (explicitly required by your decision):** the restricted safety pathway's own system prompt must refuse to do anything except acknowledge distress and point to a trusted adult/escalation resource — it must not answer trivia, do homework, or hold a general conversation, so a user can't use a self-harm keyword as a jailbreak to get unlimited free Jona. Test cases to write before shipping: (1) a genuine safety phrase followed immediately by an off-topic question in the same turn — confirm it still only gets the safety response; (2) repeated safety-keyword messages in a row — confirm no quota is consumed but also confirm the response doesn't vary into general chat; (3) a quota-exhausted user sending a borderline (not clearly safety) message — confirm they still correctly get the normal 429, i.e. this isn't a blanket quota bypass.

**Files touched:** `netlify/functions/chat.js` (the classification gate + restricted-prompt branch + skip-quota-increment logic); `firestore.rules` (new `safetyEvents` subcollection, admin-read/server-write only, same pattern as existing admin-only collections); a new restricted safety system prompt (small, separate from `HSD_AI_SYSTEM`).

### P0-C. Safeguarding knowledge base — proposed source list (for your approval, not yet built)

Per your instruction, this is the list to review before anything is implemented — nothing below is policy yet.

Proposed reputable sources (each would get the source/version/principle/usage/limitations documentation format you specified):
- **NSPCC** (UK National Society for the Prevention of Cruelty to Children) — general child-safeguarding practice guidance, and their specific guidance on children and AI/chatbots.
- **UNICEF — "Policy Guidance on AI for Children"** — specifically written for AI products used by/around children; directly on-topic for Jona.
- **Samaritans' media guidelines for talking about suicide and self-harm** — widely used as the standard for how to respond to disclosures without causing harm (avoiding detail, avoiding contagion effects), applicable to how Jona's restricted safety response should be worded.
- **American Academy of Pediatrics (AAP)** — child development stage guidance, useful for age-appropriate response calibration (distinct from the safety-crisis material above).
- **Common Sense Media** — AI-and-kids-specific safety guidance, more product/UX-oriented than clinical, useful for interface-level decisions (e.g. how a chatbot should present itself to a child).
- **UK Online Safety Act / Ofcom children's safety codes** — relevant if HSD has UK users, for regulatory-alignment rather than clinical content.
- **Childline / Kids Helpline (or the Japan-appropriate equivalent, e.g. Japan's child consultation lines — needs research since HSD's audience is Japan-based)** — for what the actual escalation resource shown to a child should be; this needs Japan-specific research, not just UK/US defaults, given HSD's user base.

**Explicitly not proposed as a source:** generating safety rules from the LLM's own judgment, or from general "AI best practices" blog content — matches your instruction not to invent this from an LLM.

**This list needs your review before I go further** — in particular the Japan-specific escalation-resource research, since that's the part most likely to need local knowledge I don't have.

### P0-D. Provider abstraction — documentation only (P2, not built now)

No code change proposed for beta. The documentation to write (once P0-A/B/C are done) would describe: Jona's client-facing interface (`sendMessage(messages, user, lang, context)`) already *is* provider-agnostic in shape — nothing about it names Gemini. The only Gemini-specific code is inside `chat.js`'s `toGeminiContents()` conversion and the API call itself. A future abstraction would isolate that behind a `callProvider(providerId, messages, system)` function so a second provider could be added without touching the client contract at all. This requires no beta-time work — just confirming (as this audit already has) that today's client-facing shape doesn't need to change later, so nothing done for beta accidentally forecloses this.

### P0-E. Educational memory — read existing data, don't build new storage

Your decision scopes this to *existing* educational data (pathway, level, lessons, progress, achievements, goals) — all of which already exists in Firestore (`familyMembers`, `curriculumProgress`, `learnerProfiles`, `activityProgress` — see Section 8/1 above). The safe, minimal P0 scope is: **read**, not write — surface existing progress data into Jona's `context` object (already a supported parameter) so Jona can reference "you're on Lesson 4 of Book 2" without any new storage, and therefore without creating a new sensitive-data surface. No new Firestore collections needed for this piece. Sensitive/session content stays exactly as it is today (not persisted at all) — this decision doesn't require building the three-tier memory categorization system yet, since for beta there's only one tier in use (educational, read-only, already-existing data).

**Files touched:** likely `src/family/FamilyHome.jsx` / `ActivityPlayer.jsx` / wherever `GlobalJonaAssistant`'s `context` prop is set, to pass real progress data through instead of just `{ pathway, appName, lesson }`. Needs a short pass to confirm exactly which existing read is cheapest/safest per surface — not fully scoped file-by-file yet.

---

**Awaiting your go-ahead on P0-A, P0-B, and the P0-C source list specifically before implementing anything.** P0-D is documentation-only and P0-E is a small, low-risk addition — flagging them for visibility but they don't carry the same review weight as the voice/safety/safeguarding work.
