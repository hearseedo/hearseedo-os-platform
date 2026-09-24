# Talk with Jona (Gemini Live) — Safety Architecture Mapping

**Date:** 2026-09-24
**Status:** Required review deliverable before Talk with Jona is exposed beyond the single admin test account. Nothing in this doc is a claim that Live safety is equivalent to the text pipeline — it is an honest account of where it is, and where it genuinely is not.

---

## The core architectural difference, stated plainly

`chat.js` (the existing "Ask Jona" text pipeline) runs `classifyRisk()` on the user's message **before** generating any reply, and — if it fires — swaps in an entirely different, narrow `RESTRICTED_SAFETY_SYSTEM` prompt for that one turn, bypassing the normal system prompt and quota entirely. This is a **discrete, per-turn, server-mediated gate**: every single message passes through server code that can inspect it and choose what happens next.

Gemini Live does not work this way. Once a session is open, audio streams directly between the browser and Google — HSD's server is not in that loop, turn by turn. There is no point at which our server sees "the user just said X" and can decide, before generation, "respond with the restricted prompt instead." **This is a real, structural difference, not an oversight to be engineered around in this build.**

---

## What remains genuinely server-enforced (unchanged in kind from the text pipeline)

These controls happen once, before the Live session is ever allowed to open, in `netlify/functions/live-token.js`:

1. **Identity verification** — the Firebase `idToken` is verified server-side (`verifyIdToken`, same Identity Toolkit call `chat.js` uses) before anything else happens.
2. **Profile-ownership verification** — `resolveProfileContext()` (the same fail-closed function `chat.js` uses) confirms the requested profile actually belongs to the verified uid. A profileId that doesn't resolve rejects the request outright; it never silently falls back to a different identity.
3. **Feature-flag gating** — only the two admin emails `firestore.rules`' `isAdminEmail()` already recognizes can mint a token at all. Everyone else gets a plain 403, never a Live session.
4. **Session-length and rate limits** — `maxSessionSeconds`, `dailySessionCap`, and `inactivitySeconds` (from `_liveVoiceConfig.js`) are enforced server-side: the ephemeral token itself expires at `maxSessionSeconds`, and the daily cap is checked before minting.
5. **The system instruction's *content* is server-built and server-locked** — `_liveSafetyInstruction.js` constructs the entire instruction (identity, tone, safety floor, profile/context scoping) server-side, and `live-token.js` locks it into the minted token via `liveConnectConstraints` + `lockAdditionalFields: ["model", "config.responseModalities", "config.systemInstruction"]`. The browser receives a token that is contractually bound to this exact instruction — it cannot see, strip, or replace it, even though it connects directly to Google with that token.
6. **Session usage logging** — start time, end time, duration, end reason, and abnormal-disconnect are recorded to `users/{uid}/liveSessions/{sessionId}` (metadata only — never audio, never a transcript), giving the same kind of visibility into real usage that `apiCosts`/`ttsUsage` gave the TTS work.

None of the above is "hoped for" client-side behavior — all of it is either a server-side check that runs before a token is minted, or a value baked into the token by Google's own `auth_tokens` API, which the client cannot alter.

## What becomes Live-session-instruction-based (no longer a runtime server branch)

These are carried entirely through the locked system instruction, active for the whole conversation rather than selected per-turn:

- Jona's identity, tone, and "Confidence Before Correctness" framing.
- Age-appropriate behavior and the specific active profile's context (name/age/CEFR), scoped so no other household member's data is ever included (see `tests/live-safety-instruction.test.js`, "only the given profile's own name/age appears").
- The full safety floor: no collecting personal identifying details, redirect away from violence/sexual content/self-harm/illegal activity, direct a distressed user to a trusted adult rather than attempting to counsel them, never claim to be human/therapist/medical professional, never suggest moving the conversation elsewhere, never build emotional dependency ("you only need me", "don't tell your parents").
- Short, natural conversational turns (requirement #6) and treating interruption as normal, not something to resist (supports requirement #5's native barge-in).
- English/Japanese behavior — respond in whichever language the learner is actually using.

This is architecturally different from `chat.js`: instead of the server catching a risky message and swapping prompts, Jona is instructed to **always** carry this safety floor and **self-recognize and self-redirect within the live conversation**, backed additionally by Google's own built-in model-level safety filtering (Live has no separately-tunable `safetySettings` parameter the way standard `generateContent` does — this is a real, documented API limitation, not a gap in HSD's implementation).

## What is explicitly NOT equivalent — the honest gap

This is the part instruction #2 required to be reported plainly rather than glossed over:

1. **No per-turn `classifyRisk()` gate exists inside an active Live session.** There is no server-side interception point mid-conversation. If a learner says something that would have triggered the restricted safety path in text mode, the *only* thing standing between that moment and Jona's response is (a) the always-on safety floor baked into the locked system instruction, and (b) Google's built-in model-level filtering. Neither is the same as a deterministic keyword-based server gate.
2. **No `safetyEvents` logging fires for a Live-session safety moment.** `chat.js` logs a metadata event (tier, timestamp, profileId — never content) whenever its classifier fires. There is currently no equivalent for Live, because the server never sees the turn content to classify it. This means a safety-relevant moment during a Talk with Jona conversation today leaves no record for review — a real, known gap.
3. **No safety-triggered quota bypass exists for Live** — moot at present, since Live has no quota model live-token.js enforces beyond the session/day caps, but noted for completeness since it's a real behavior difference from `chat.js`.

## Why this build proceeds anyway, and what would need to change before wider exposure

This gap is being accepted **only** for a single, admin-only test account, per requirement #13 — not for general availability. Before this expands to any real family/student account, at minimum:

- Investigate whether Gemini Live's own session transcript/logging capability (if available for this model) can be used to give `safetyEvents`-equivalent visibility without storing raw audio or a full transcript by default — this was out of scope to build for this beta (requirement #9: "do not introduce persistent transcripts by default") but is the natural next step to close gap #2.
- Confirm in real testing whether the safety-floor instruction actually holds up under adversarial testing in a live, interruptible, audio conversation — this is qualitatively different from testing a static text prompt, since the model is generating continuously rather than responding to discrete, reviewable inputs.
- Re-evaluate whether Google ships a more granular Live safety-configuration surface before this expands past the current model.

**Nothing in this document should be read as "the gap is fine" — it is reported per requirement #2's explicit instruction ("stop and report it rather than weakening the existing Jona safety model") specifically so it can be weighed before any decision to expose this beyond one admin account.**
