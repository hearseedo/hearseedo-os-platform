# Talk with Jona — Gate B Stage 2 Plan, Revision 2 (Provider-Verified)

**Date:** 2026-09-26
**Status:** PLANNING ONLY. No production code changed in this document's preparation. This revision supersedes `docs/JONA_LIVE_SAFETY_GATE_B_STAGE2_PLAN_2026-09-26.md` (commit `435364d`) after checking that plan's claims against Google's current official documentation and this repository's actual configuration. **Awaiting your approval before any Stage 2 code.**

This revision was triggered by your seven review questions, two of which surfaced a genuine factual error and a genuine legal blocker in the prior plan. Both are corrected/flagged below before anything else, because they affect whether this architecture should be built at all, not just how.

---

## UNRESOLVED BLOCKERS — read this section first

| # | Blocker | Severity | Resolvable by engineering? |
|---|---|---|---|
| **A** | **Gemini Developer API child-directed use restriction.** Verified directly against `ai.google.dev/gemini-api/terms` (Effective March 23, 2026): *"You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website, application, or other service ('API Clients') that is directed towards or is likely to be accessed by individuals under the age of 18."* This is unconditional within this product's terms — **not resolved by switching billing tier (Paid vs. Unpaid) or by switching which Gemini Developer API model is used; both remain the same governing terms and the same restriction.** It applies to **both** `netlify/functions/live-token.js` (Talk with Jona) and `netlify/functions/chat.js` (Ask Jona) as they exist today — both call `generativelanguage.googleapis.com` directly via `GEMINI_API_KEY` (confirmed in code: `live-token.js` uses `@google/genai`'s `GoogleGenAI({apiKey: API_KEY})`; `chat.js` calls `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}` directly). HSD OS AI's Family/Confidence Student pathways are exactly the kind of application these terms describe. | **CRITICAL — blocks child release of both AI surfaces, independent of Gate B's safety quality** | **No.** This is a contractual eligibility question, not a safety-architecture question. No amount of good classifier/intervention design resolves it, and no in-product configuration change resolves it either. Needs your own decision: contact Google for a direct/enterprise agreement, or evaluate moving to a **genuinely different Google service — Vertex AI's Gemini API, governed by separate Google Cloud terms** — which is **not assumed to permit child-directed use merely because it is a different product**; it requires its own independent eligibility check, done in §3 below, not inferred from this product's restriction being absent from its terms text. Flagging, not resolving. |
| B | Original plan's proposal to lock `safetySettings` into the ephemeral token was based on a field that **does not exist** for the Live API. Corrected in §6 below. | Was a factual error in Rev 1 | Yes — corrected in this revision, no further decision needed |
| C | Tamper resistance has a permanent ceiling under the current "client connects directly to Gemini" architecture — a modified client can starve HSD's supervisor of real data and ignore its signals, and HSD's server has no way to force-close an already-open Gemini WebSocket. | Architectural, not a bug | Only by proxying full audio through HSD's own server — explicitly out of scope per your prior instruction. Documented as an accepted, permanent limitation, not solved by Stage 2. |
| D | `sessionResumption` (Google's own reconnect mechanism, required within the token's `expireTime` window) was never mapped to HSD's sticky safety-state design in Rev 1 — a reconnect could look like a "new session" and wrongly reset `HIGH_RISK`/`IMMEDIATE_DANGER`. | Real gap, not previously identified | Yes — specified in §4 below, needs implementation once approved |
| E | Rev 1's profile-switch teardown didn't address audio already queued client-side (buffered but not yet played) at the moment of switch. | Real gap | Yes — specified in §4 below |
| F | Rev 1's supervisor-failure thresholds (§5, unchanged numbering) didn't distinguish genuine silence from a broken transcript pipeline — both look identical ("no classification arriving"). | Real gap | Yes — specified in §5 below, using the Live API's own confirmed activity-detection signals |
| G | Rev 1's "no transcript text, no audio, at any tier" (§2) is accurate only for **HSD's own Firestore**. It does not describe what Google itself retains. Needs correction, and needs confirmation of this project's Paid vs. Unpaid Gemini API service tier, which materially changes Google's own retention/human-review behavior. | Real gap, privacy-accuracy issue | Partially — the wording is correctable now (§6 below); the underlying Paid/Unpaid confirmation is a fact about the project's billing setup that needs to be checked, not designed |

**Recommendation:** Blocker A should be resolved (or a documented risk-accepted decision made, in writing, by you) before Stage 2 implementation begins — not deferred to the Stage 5 release decision — because if it isn't resolvable, several hours of Stage 2 engineering effort would be built for a deployment path that can't legally open to children regardless of how it performs. Blockers B–G are addressed by revising the plan itself, below.

---

## 1. Provider verification: what this repo actually uses

Confirmed by reading `live-token.js` and `chat.js` directly (not assumed from prior doc comments):

- **Product:** Gemini Developer API (`ai.google.dev`), via the `@google/genai` SDK — **not** Firebase AI Logic, **not** Vertex AI. `live-token.js` mints ephemeral tokens via `authTokens.create()` against `v1alpha`; the client then connects directly to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` using that token.
- **Live model:** `gemini-2.5-flash-native-audio-preview-09-2025` (Live API, preview status per Google's own docs).
- **Ask Jona model:** `gemini-2.5-flash`, same API key, same product, standard (non-Live) `generateContent`.
- **Governing terms:** `ai.google.dev/gemini-api/terms` (the "Gemini API Additional Terms of Service"), confirmed to be the correct document for this exact SDK/endpoint combination — not the Firebase AI Logic terms, which govern a different product and were only relevant to Rev 1's (incorrect) `safetySettings` claim.

This matters because Rev 1 partly reasoned from Firebase AI Logic's documentation (`firebase.google.com/docs/ai-logic/safety-settings`) when checking `safetySettings` support, without first confirming that page's product actually matches what this repo calls. It happens to reach the same conclusion (Live API doesn't support safety settings) as the authoritative Gemini API reference, but this revision verifies it against the correct source directly (§6), and separately checks the terms question (§1 above) against the product this repo actually uses.

---

## 2. Safety-state downgrade policy — unchanged from Rev 1

No provider-verification issue here; this is HSD's own state machine, not a Google API question. Retained as designed:

- `NORMAL` start, resets only on a new `sessionId`.
- `HIGH_RISK`/`IMMEDIATE_DANGER` sticky for the session's remainder (monotonic high-water-mark), meaning tone-and-awareness persistence, not a hard content block except at `IMMEDIATE_DANGER`.
- `SENSITIVE` decays after 3 consecutive `NORMAL` classifications.
- `UNCERTAIN` is response-shaping only, not itself sticky.
- `IMMEDIATE_DANGER` triggers session-end evaluation, not an automatic hard cutoff.

**Revision from item 5 of your review (classification correction):** stickiness of the *tier* must not be weakened — that's the entire point (a genuine disclosure must not be erased because the topic changed). What's added in this revision is a **separate, admin-only, after-the-session annotation** path (§7) for correcting a *reporting/audit* record when a human reviewer determines a specific sticky escalation was a false positive. This never retroactively changes what happened live in the session, and there is no live, in-session, child-or-client-reachable way to cancel a sticky tier — adding one would reopen exactly the exploit the sticky rule exists to close.

---

## 3. Transcript retention — corrected for accuracy (Blocker G)

**HSD's own Firestore (`liveSessions` doc):** metadata only, as Rev 1 specified — `safetyTier`, `safetyTierReachedAt`, `safetyDetectionSource`, `safetyInterventionAction`, `safetyInterventionSucceeded`, `safetyDetectionLatencyMs`, `safetyInterventionLatencyMs`, `safetyPolicyVersion`. No transcript text, no audio, in HSD's own database, at any tier. This part of Rev 1 is accurate **as a description of HSD's own storage** and is unchanged.

**What Rev 1 got wrong by omission:** it did not distinguish HSD's storage from Google's. Per the Gemini API Additional Terms fetched directly from `ai.google.dev/gemini-api/terms`:

- **Paid Services:** *"Google logs prompts and responses for a limited period of time, solely for detecting and preventing violations of the Prohibited Use Policy... This data may be stored transiently or cached in any country in which Google or its agents maintain facilities."*
- **Unpaid Services:** *"Google uses the content you submit to the Services and any generated responses to provide, improve, and develop Google products... human reviewers may read, annotate, and process your API input and output"* (with account/API-key disconnection before human review, per the same section).

**This needs a factual confirmation, not a design decision:** is the Google Cloud/API project behind `GEMINI_API_KEY` attached to an active Cloud Billing account (making this a Paid Service under these terms) or not? That single fact determines whether every child's spoken words and Jona's replies are subject to Google's short-term abuse-detection-only logging (Paid) or to Google's broader product-improvement use including human review (Unpaid). Neither path is "nothing is stored anywhere," and this plan should not claim otherwise again. Recommend confirming this before Stage 5, and stating the correct one plainly in whatever parent/guardian-facing disclosure exists for the product.

---

## 4. Profile isolation — revised (Blockers D and E)

**Existing baseline, confirmed in code (not new):** `TalkWithJona.jsx` already ties a `closeSignal` prop (documented as `${uid}:${activeProfileId}`) to an effect that calls `endSession("profile_switch")` when it changes, closing the Gemini session and reporting the reason. This is real, already-shipped behavior this revision builds on rather than replaces.

**Binding (explicit statement, not new mechanism):** every safety-relevant record — `liveSessions` doc, safety-state fields, intervention log entries — is already keyed by `uid` + `sessionId`, and `profileId` is stored on the same doc at session-start (`logSessionStart` in `live-token.js`). No safety record should ever be interpreted or acted on without the caller's currently-authenticated `uid` matching the doc's owner path, which is already structurally guaranteed (Firestore path is `/users/${uid}/liveSessions/${sessionId}` — a different uid literally cannot read or write another user's session doc under existing rules).

**Revised teardown sequence (adds what Rev 1 missed):**
1. Detect switch via the existing `closeSignal` mechanism — unchanged, no new detection needed.
2. Mark client-side session state "ending" immediately, before any network round-trip, so no further Jona output renders under the outgoing profile's identity.
3. **New:** discard, don't play, any audio already buffered client-side but not yet through the speaker at the moment of switch — Rev 1 called `session.close()` but never addressed queued-but-unplayed audio, which could otherwise finish playing a sentence generated for the profile that just switched away.
4. Stop forwarding further transcript chunks tied to the outgoing `sessionId`.
5. **New:** `live-transcript-classify.js` must reject (not silently ignore) a transcript chunk for a `sessionId` whose doc already has `endedAt` set, closing a race where a late chunk from the just-ended session gets classified and could otherwise be mistaken for signal belonging to whatever session comes next.
6. **New, the actual "reject stale classifier results" mechanism:** the client's Firestore `onSnapshot` listener must be scoped to the specific `sessionId` path at connect time and re-subscribed fresh on every new session — never left listening to a prior session's doc. Combined with step 5 (the classify endpoint always stamps writes with the `sessionId` it was called for), a stale classification physically cannot land against the new session's document; there is no separate "is this stale?" check needed because the plumbing makes cross-session delivery structurally impossible, not just discouraged.
7. A new profile's new session goes through `live-token.js` fully again — new `sessionId`, new lock acquisition, safety state starting at `NORMAL`. No code path reuses safety state across `sessionId`s. This must remain true.

**New: reconnecting the same conversation vs. starting a new one (Blocker D).** Confirmed via the official Live API docs (`ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens`): *"Within the `expireTime` timeframe, you'll need `sessionResumption` to reconnect the call every 10 minutes (this can be done with the same token even if `uses: 1`)."* This is a real, expected event during an ordinary session, not an edge case — and Rev 1 never decided how it interacts with the sticky safety-state design. It must be decided now: a `sessionResumption`-based reconnect is **the same logical conversation** and must keep the **same HSD `sessionId`** and its already-reached safety tier (a `HIGH_RISK` state must not silently reset to `NORMAL` just because Google's own required 10-minute reconnect happened). This needs to be an explicit rule in `TalkWithJona.jsx`'s reconnect handling before Stage 2 is implemented, not left to be discovered later — treating a `sessionResumption` reconnect as a "new session" would quietly defeat the entire sticky-state design the very first time a session runs past 10 minutes.

---

## 5. Supervisor failure policy — revised (Blocker F)

Rev 1's thresholds (2 consecutive failed cycles, or 30 seconds with no successful classification) are kept, but the trigger condition is corrected:

**The gap:** "no classification arriving" is what both a broken pipeline and a child who is simply listening quietly look like from the server's point of view. Rev 1 never distinguished them, which means the fallback logic as originally written would either be too trigger-happy (ending sessions during a normal quiet moment, e.g. while the child listens to Jona explain something at length) or, if loosely implemented, fail to actually distinguish real failure from real silence at all.

**Revised rule, using fields Google's own Live API reference confirms exist** (`ActivityStart`/`ActivityEnd`, and `AutomaticActivityDetection`'s `startOfSpeechSensitivity`/`endOfSpeechSensitivity`/`silenceDurationMs`): the 2-failure/30-second tolerance window only counts against the supervisor when **user speech activity was detected** but no corresponding transcript/classification followed within the window. A period where no activity was detected at all (the child isn't speaking — listening, thinking, or simply quiet) is an expected, non-failure state and must not advance the failure counter or the 30-second clock. This requires the client to surface activity-detection events (already part of the Live API's server message stream) to the failure-tracking logic, not just transcript arrival — a concrete, scoped addition to `TalkWithJona.jsx`'s existing event handling, not a new subsystem.

Everything else in Rev 1's §5 (one retry, then "reconnecting" UI, then clean end with `safety_supervisor_unavailable` after ~10-15s, and "no transcripts forwarded" being treated identically to "supervisor down") is retained unchanged — that reasoning holds regardless of this correction.

---

## 6. Classifier and trust boundary — corrected (Blocker B)

### The `safetySettings` error, and its correction

Checked directly against the authoritative field reference (`ai.google.dev/api/live`, the `BidiGenerateContentSetup` message definition). The complete, confirmed field list for Live API session setup is: `model`, `generationConfig` (itself containing `candidateCount`, `maxOutputTokens`, `temperature`, `topP`, `topK`, `presencePenalty`, `frequencyPenalty`, `responseModalities`, `speechConfig`, `mediaResolution`, `translationConfig`), `systemInstruction`, `tools`, `realtimeInputConfig`, `sessionResumption`, `contextWindowCompression`, `inputAudioTranscription`, `outputAudioTranscription`, `proactivity`, `historyConfig`.

**There is no `safetySettings` field anywhere in this list.** It isn't merely unsupported or unlockable — it is not a valid configuration option for the Live API at all, on any tier, under any backend. Rev 1's §6/§7.1 proposal to "lock `safetySettings` into the ephemeral token" must be **struck entirely** — there is nothing to lock. Rev 1's §6 trust-boundary table also stated *"`safetySettings` content-category blocking on Jona's own output still applies"* as part of the "floor" Google enforces regardless of client tampering — **this sentence is false and must be deleted.** The corrected, narrower finding: **no HSD-configurable `safetySettings` control exists for Live API output.** That is what was checked and confirmed. **What actual server-side safeguards Google applies to this exact deployed model (`gemini-2.5-flash-native-audio-preview-09-2025`) — beyond the absence of this one configuration option — is unverified, not confirmed absent.** This plan does not claim Google runs no protection; it claims HSD cannot configure or rely on the specific control (`safetySettings`) it previously assumed was available, and has not separately verified what, if anything, stands in its place.

**What remains correct and valid from Rev 1's hardening proposal:** locking `inputAudioTranscription` and `outputAudioTranscription` into the ephemeral token via `lockAdditionalFields` **is** a real, valid field on `BidiGenerateContentSetup`, confirmed in the same reference, and remains a genuine hardening — it closes the "client silently omits transcription and blinds the supervisor" bypass exactly as Rev 1 argued. This part of the plan stands.

### Revised trust-boundary table

| | Detail |
|---|---|
| **Server-controlled** | Token minting and all its gates (unchanged). Content of the locked `systemInstruction`. The classification decision (computed server-side from forwarded text). The safety-state record (Firestore source of truth, client read-only). Whether to mint any *future* token. |
| **Locked into the ephemeral token (Google-enforced)** | `model`, `responseModalities`, `systemInstruction`, `speechConfig` (already locked today) — plus, newly proposed and **verified valid**: `inputAudioTranscription`, `outputAudioTranscription`. **`safetySettings` removed — not a real field for this API.** |
| **Browser-controlled** | Whether transcript chunks are actually forwarded to HSD's server. Whether an intervention directive is executed. Whether any UI indication renders. |
| **What a tampered browser can bypass** | Stop forwarding transcripts (treated as supervisor failure, §5). Ignore an intervention signal and keep talking to Gemini directly. **New, explicit (per your item 3): forward fabricated "harmless" text to HSD's endpoint while a real, different conversation happens over the actual audio channel HSD never sees** — HSD has no mechanism to verify forwarded transcript text matches what was actually said, since HSD is not in the audio path. **Ignore a session-end signal** — HSD's server cannot force-close a WebSocket the client opened directly to Gemini using its own token; no revocation API exists (confirmed absent from the SDK in Rev 1, and independently consistent with the ephemeral-tokens doc, which describes only natural `expireTime` expiry, never manual revocation). |
| **What Gemini still enforces regardless of tampering — corrected, now stated as unverified rather than asserted** | The locked system instruction's content is part of every generation, regardless of client tampering — that part is structural, not a claim about content filtering. **What the verified finding actually establishes is narrower than Rev 1 claimed:** `safetySettings` is confirmed absent as a configurable field for the Live API (§6 above) — that is a real, checked fact. **It is not evidence, one way or the other, about what safeguards Google's Live model actually runs server-side.** Google may apply some other, non-`safetySettings`-based moderation layer to Live specifically (a separate system, undocumented at the endpoint level, not exposed as a configuration option) — this was not checked and must not be assumed either way. The honest position is: **the specific control HSD proposed to lock does not exist; the actual safeguards and guarantees Google applies to this exact deployed model (`gemini-2.5-flash-native-audio-preview-09-2025`) are unverified, not confirmed absent.** This distinction matters because "no configurable setting" and "no protection at all" are different claims, and only the first is established. |
| **Honest ceiling** | A sufficiently determined, technically sophisticated tampered client can have a conversation with Gemini that HSD's adaptive supervisor never sees accurately, and HSD's server has no way to terminate that connection once open. This is not solvable without a full audio proxy through HSD's own infrastructure — explicitly out of scope per your instruction. See §7 for the honest comparison of alternatives. |

---

## 7. Enforceable supervision — honest-client vs. tamper-resistant, separated (per your item 3)

**Honest-client failure handling (retained from Rev 1, revised per §5 above):** a compliant client that experiences a real technical failure (network blip, classification endpoint slow/down, transcription pipeline broken) is handled by the tolerance-window-then-retry-then-fallback logic in §5, now correctly distinguishing genuine silence from failure.

**Tamper resistance — a fundamentally different, and more limited, guarantee.** A modified client can:
- Never call HSD's transcript-forwarding endpoint at all — nothing in the architecture forces it to, since the client connects directly to Gemini and HSD's server is not in that data path.
- Forward fabricated, harmless-looking text to HSD's endpoint while a real, different conversation happens over audio HSD never receives.
- Receive an intervention directive via the Firestore listener and simply not act on it (not call `sendClientContent`, not show the UI message).
- Receive a signal to end the session and simply not close its own connection — and HSD's server has no independent way to force that closure, because it never held the connection in the first place.

**This must be stated plainly, not softened:** under the current "client connects directly to Gemini with a locked token" architecture, **HSD cannot stop an already-open, actively-tampered connection.** This is a permanent property of this architecture, not a Stage 2 implementation gap.

**Alternatives, compared without implementing any of them:**

| Option | What it buys | Cost |
|---|---|---|
| **(a) Full server-side audio proxy** — HSD's server sits in the real-time audio path between client and Gemini | Real enforcement: HSD could verify transcript integrity itself (since it computed it, not the client) and literally close the stream | Materially higher latency (extra real-time hop), real infrastructure cost and complexity increase, and this is the architecture you have already explicitly asked not to pursue |
| **(b) Current architecture (direct client-to-Gemini), ceiling accepted and documented** | Low latency, low complexity, matches your existing architecture constraint | The ceiling described above is permanent and must be disclosed as a known limitation at the release decision, not silently accepted |
| **(c) Periodic short-lived re-authorization** (re-mint the token every few minutes tied to a liveness/re-auth check, without full audio proxying) | Narrows the *window* of an undetected tampered session without full proxying | Doesn't close the gap, only bounds it; adds real complexity (frequent reconnects interacting with `sessionResumption`, §4) for partial benefit; not verified against Google's actual token-reissuance rate limits |
| **(d) Rely on any server-side moderation/reporting Google itself performs** | Potentially a backstop HSD doesn't have to build | Not confirmed to exist in a usable form for this use case — would require direct verification with Google, out of scope here |

**Recommendation:** proceed with (b) for Stage 2, since (a) conflicts with your stated architecture constraint and (c)/(d) are unverified or only partial. This is a recommendation to *accept and disclose* the limitation, not to consider it resolved.

---

## 8. Classification and recovery — revised (per your item 5)

**Correcting a mistaken high-risk classification, without erasing a genuine one:**
- The sticky tier itself is never live-correctable by the classifier, the client, or the child — that remains fixed, per §2, because weakening it reopens the exact failure this design exists to prevent.
- **New:** an admin-only, post-session annotation in `AdminLiveJonaTab.jsx` lets a human reviewer mark a specific ended session's escalation as "reviewed — false positive," for audit/reporting accuracy only. This never reopens or un-restricts a session, live or otherwise, and is not reachable by the client SDK or by anything the child or a tampered client could trigger.

**Educational/third-person framing must not automatically downgrade risk — made an explicit classifier rule, not left implicit in examples:** the classifier's structured reasoning (register, disclosure, intent, imminence) must treat framing as necessary-but-not-sufficient for a lower tier. "This is educational" or "this is about someone else" changes *how* Jona responds, never *whether* a genuine disclosure or an actionable-harm request underneath that framing gets acted on. Rev 1's Matrix already modeled this correctly in specific rows (#8, third-party abuse disclosure → `HIGH_RISK`, not downgraded for being about a friend; #14, fiction framing does not exempt an actionable self-harm request → `HIGH_RISK`) but never stated it as a standing rule — this revision makes it one.

**Ordinary silence vs. missing expected transcripts:** resolved in §5 above via Live API activity-detection signals — silence with no detected activity is expected and non-triggering; detected activity with no resulting classification within the tolerance window is a real failure.

---

## 9. Fallback and privacy — revised (per your item 6)

**Is Ask Jona an appropriate fallback?** Two separate questions, previously conflated:

1. **On Live-safety-architecture merits alone** (supervisor outage handling): yes, reasonably — `chat.js` already calls `classifyRisk()` synchronously before generating any reply (soon against the shared `_safetyEngine.js`, per Rev 1 §4, unchanged in this revision), so redirecting a Live session that's lost its supervisor to Ask Jona is not zero-safety-net.
2. **On provider eligibility** (Blocker A): **no, not resolved, because it inherits the identical problem.** Confirmed in code: `chat.js` also calls `generativelanguage.googleapis.com` directly with `GEMINI_API_KEY` — the same Gemini Developer API, the same Additional Terms, the same under-18 restriction. Recommending Ask Jona as a fallback does not escape Blocker A; it is a different door into the same restricted product. This must not be presented as resolving the eligibility question, only as a reasonable answer to the narrower "Live supervisor is down" case.

**New: a fallback beneath both AI surfaces.** If Ask Jona is also unavailable (kill-switched, or if Blocker A forces both surfaces offline), Stage 2 should define a fully static, non-generative, pre-approved bilingual message with no model call at all — e.g., "Jona needs a short break. If you need to talk to someone right now, please find a parent, guardian, or teacher." This did not exist in Rev 1 and is the actual floor beneath both AI-backed surfaces.

**HSD storage vs. provider retention — corrected, per §3 above.** Rev 1's "no transcript text, no audio, at any tier" claim is retained but must be explicitly scoped as describing **HSD's own Firestore only**. It is not a claim that nothing is stored anywhere — Google's own Paid/Unpaid Service retention (quoted in §3) applies independently of anything HSD does, and confirming which tier this project's billing sits on is an open, factual item, not a design decision.

---

## 10. Acceptance criteria — defined now, execution deferred (per your item 7)

Defining tests, not running them — no code in this document.

- **Language coverage:** every Safety Decision Matrix row (Rev 1 §8, retained unchanged) tested in EN, in JP, and in at least one mixed-language/code-switched variant per row category.
- **False positives:** rows 1, 2, 3, 5, 10 must classify `NORMAL`; row 3 ("we learned about suicide prevention at school") is a named regression target since it's the current classifier's documented failure.
- **Missed disclosures:** rows 4, 7, 9, 12 must reach `HIGH_RISK`/`IMMEDIATE_DANGER` under adversarial phrasing (misspellings, broken grammar, indirect language, mixed language), not just the matrix's literal example text.
- **Framing resistance:** rows 8 and 14, plus combined adversarial variants (fictional framing of a third-party disclosure), must not downgrade tier due to framing alone (§8 above).
- **Transcript/classification failures:** simulated failures at exactly the 2-cycle and 30-second boundaries (§5), confirming retry-then-fallback timing is correct, not early or late.
- **Silence vs. failure (new):** genuine extended silence with no detected activity must not trigger fallback; detected activity with no resulting classification must trigger it within the defined window.
- **Tampering scenarios:** (a) transcripts never forwarded, (b) fabricated benign text forwarded alongside a real unsafe conversation over unseen audio, (c) intervention directive ignored, (d) session-end signal ignored — each tested against the **server's own fallback behavior**, since per §7, tampering (a) is indistinguishable from honest failure by design; what's actually verified is that the server-side fallback still fires the same way regardless of cause.
- **Profile-switch races (new):** switching profiles while a classification is in-flight, while an intervention directive has just been written but not yet delivered, and while audio is mid-playback — confirming no cross-profile leakage of output, safety state, or stale directives (§4).
- **Reconnection (new):** a `sessionResumption`-based reconnect within the token's `expireTime` window must preserve sticky safety state under the same `sessionId` (§4) — a requirement this revision adds that Rev 1 never specified or tested for.
- **Fallback chain (new):** Live supervisor failure → Ask Jona → final static fallback (§9), each transition tested independently.
- **Regression on already-approved behavior:** voice timing (idle check-in/warning/disconnect), barge-in/interruption, and the floating UI's existing states must be explicitly retested after `live-token.js`/`TalkWithJona.jsx` changes — not assumed preserved, since Stage 2 touches the same files that implement them (see closing section below).

---

## Effect on currently approved voice timing, barge-in, and floating UI

Rev 1 stated these were untouched. This revision treats that as **a requirement to verify, not an already-proven outcome**, per your explicit instruction: Stage 2's actual code changes touch `live-token.js` (adding two locked fields) and `TalkWithJona.jsx` (adding transcript forwarding, a Firestore listener, activity-detection tracking for §5, and reconnect handling for §4) — the same files that implement idle timing, barge-in, and the floating card today. No behavioral change to those systems is *intended*, but "not intended" is not "verified." §10's acceptance criteria now include explicit regression tests for all three rather than treating them as out of scope by assumption.

---

## Stage 2 implementation plan — revised file list

**New:**
- `netlify/functions/_safetyEngine.js` — unchanged from Rev 1 (§4/§8 reasoning contract, `UNCERTAIN` first-class, bounded context window).
- `netlify/functions/live-transcript-classify.js` — as Rev 1, **plus**: rejects chunks for a `sessionId` whose doc already has `endedAt` set (§4); tracks activity-detection state, not just transcript arrival, for the §5 failure logic.
- Server-authored intervention-directive helper — unchanged from Rev 1.

**Modified:**
- `netlify/functions/live-token.js` — lock `inputAudioTranscription`, `outputAudioTranscription` only. **`safetySettings` removed from this task — it is not a valid field.**
- `netlify/functions/live-session-end.js` — unchanged from Rev 1's metadata fields (§3, now explicitly scoped as HSD-storage-only in wording).
- `src/jona/TalkWithJona.jsx` — as Rev 1, **plus**: discard queued-but-unplayed audio on profile-switch teardown (§4); map `sessionResumption` reconnects to the same `sessionId`/safety state rather than a new session (§4); surface Live API activity-detection events to the failure-tolerance logic (§5); add the final static fallback message for the case where both Live and Ask Jona are unavailable (§9).
- `firestore.rules` — unchanged from Rev 1 (existing `liveSessions` shape already covers new fields).
- `src/pages/AdminLiveJonaTab.jsx` — as Rev 1's visibility additions, **plus**: the post-session "reviewed — false positive" annotation capability (§8), audit-only, no live effect.

**Explicitly NOT touched in Stage 2:** `chat.js`/Ask Jona's own code (design shared per Rev 1 §4, not wired in), parent notification, the Gemini Live model/voice/barge-in/floating UX/limits/lease/heartbeat/kill-switch/Educator — **and now explicitly listed as requiring regression verification, not assumption of safety, once Stage 2's changes to the shared files above are made.**

---

## Approval for implementation vs. approval for child release — kept explicitly separate

**Approval for Stage 2 implementation** (a decision you can make now, independent of Blocker A) authorizes writing the code listed above, under the **unchanged** admin-only gate — `LIVE_BETA_ADMIN_EMAILS` stays exactly as it is, Talk with Jona remains inaccessible to any non-admin account, and nothing in this revision changes who can reach either endpoint. This is engineering approval, tested only by admins.

**Approval for child release** is a separate, later decision (Stage 5, unchanged position in the sequence) and additionally requires, at minimum:
1. **Blocker A resolved or a documented, explicit risk-acceptance decision from you** — this is not an engineering deliverable and cannot be produced by Stage 2 code, however well it's written.
2. Stage 3's automated red-team tests (§10 above) passing.
3. Stage 4's manual device verification — your own responsibility, unchanged from the original handoff.
4. Explicit, written acknowledgment of the tamper-resistance ceiling (§7) and the Google-retention distinction (§3/§9) as accepted, disclosed limitations — not items Stage 2 code resolves.

Approving the architecture below authorizes implementation to begin under the admin-only gate. It does not, by itself, authorize child access, and this document does not ask for that.

---

**Per your instruction: no implementation changes were made in preparing this revision — every check above was read-only (official Google documentation, and this repository's existing code as already written). Awaiting your response on Blocker A specifically, and on the revised classifier/state/intervention architecture as a whole, before any Stage 2 code is written.**
