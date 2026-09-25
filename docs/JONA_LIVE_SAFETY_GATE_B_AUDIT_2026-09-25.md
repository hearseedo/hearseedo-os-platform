# Talk with Jona — Gate B (Live Child Safety) — Stage 1 Audit

**Date:** 2026-09-25
**Status:** AUDIT ONLY. No production code changed. Awaiting architecture approval before Stage 2 (implementation).

Every capability claim below was verified against one of two sources, never memory:
- The **installed** `@google/genai` SDK's own type definitions (`node_modules/@google/genai/dist/web/web.d.ts`) — this is what the code actually has access to, right now, in this project.
- **Direct execution** of the existing production code (`netlify/functions/_safetyClassifier.js`) against real test strings.

---

## 0. A correction to the earlier (2026-09-24) safety audit

`docs/JONA_LIVE_SAFETY_ARCHITECTURE_2026-09-24.md` stated Gemini Live has "no separately configurable `safetySettings`." **That was wrong**, or the SDK has since gained this capability — verified today: `LiveConnectConfig` (the config type `live-token.js` already builds and locks into the ephemeral token) has a real `safetySettings?: SafetySetting[]` field, same `HarmCategory`/`HarmBlockThreshold` shape as standard `generateContent`. This is corrected below and does change the recommended architecture (§5) — it's one more layer, though not a substitute for the core need (see §0.1).

**0.1 — Important scope limit on `safetySettings`:** it only blocks Jona's *own generated output* from containing certain harm categories (harassment, hate speech, sexual content, dangerous content, violence). It does **not** classify what the *learner* discloses. A child calmly saying "I want to hurt myself" doesn't reliably make Jona's own *response* trip a harm-category filter — Jona's reply could be perfectly gentle and "safe" by content-category standards while completely failing to recognize and respond to the disclosure. `safetySettings` is real, cheap, zero-latency defense-in-depth (worth turning on), but it is not the primary mechanism this gate needs.

---

## 1. Current Live safety architecture (what exists today)

- `_liveSafetyInstruction.js` builds a comprehensive system instruction (Jona identity, tone, the full safety floor — no PII collection, redirect from violence/sexual/self-harm/illegal content, direct distress to a trusted adult, no human/therapist claims, no emotional dependency) and `live-token.js` **locks** it into the ephemeral token via `liveConnectConstraints`/`lockAdditionalFields` — the client cannot see or override it.
- That's it. There is **no runtime classification of what the learner says** during a Live session. The system instruction is static, always-on, and hopes the model follows it — there is no server-side check-and-intervene loop.
- `firestore.rules`/`live-token.js` verify identity and profile ownership before minting (unrelated to in-conversation safety, but part of the trust boundary).

## 2. What Gemini Live provides natively (verified against the installed SDK)

| Capability | Present? | Notes |
|---|---|---|
| `safetySettings` in `LiveConnectConfig` | **Yes** | Standard `HarmCategory`/`HarmBlockThreshold` — blocks Jona's own output by content category. Lockable into the ephemeral token the same way `systemInstruction` already is. |
| `inputAudioTranscription` / `outputAudioTranscription` | **Yes** | Requestable in the connect config. Delivers `serverContent.inputTranscription.text` (the learner's words) and `serverContent.outputTranscription.text` (Jona's words) as **text**, in near-real-time. Explicitly documented as "independent" of the model turn — i.e. **does not block or delay Jona's own response generation**. This is the load-bearing capability for the whole recommended architecture below. |
| `tools` (function/tool calling) | **Yes** | `LiveConnectConfig.tools` accepts the same `ToolListUnion` as standard generation. Not required for the recommended architecture, but available if a later iteration wants the model itself to signal risk via a tool call rather than us classifying transcript text. |
| `sessionResumption` | **Yes** | `LiveConnectConfig.sessionResumption` — the server can request resumption-update messages. Relevant if an intervention path ever needs to cleanly reconnect rather than reuse the same session; not needed for the recommended design. |
| Google's own safety-block signal | **Partial** | `serverContent.turnCompleteReason` includes `RESPONSE_REJECTED` ("The response is rejected by the model") — confirmed real in the type definitions. This tells us when *Google itself* blocked a generated reply. Useful as a secondary signal, not a substitute for detecting learner disclosures. |
| Explicit VAD control | Yes | `explicitVadSignal`/`realtimeInputConfig` exist; not needed for this design — existing native barge-in (`serverContent.interrupted`) stays exactly as-is. |
| **A way for the SERVER to directly control an in-progress session** | **No** | This is the central architectural fact everything else follows from — see §3. |

## 3. What HSD currently provides, and the central architectural constraint

The ephemeral Live token is used by the **browser** to connect **directly** to Google — that's the entire point of the ephemeral-credential design (no permanent key in the browser, but also no HSD server sitting in the audio path). **The server never holds the WebSocket.** Only the client can call `session.sendClientContent()` or `session.close()` on a running session.

This means a "safety supervisor" cannot literally reach into an in-progress Live session from the server. Any intervention has to work by the server telling the **already-running, already-trusted client code** what to do, and the client executing it — the same pattern already used for the idle check-in, the 1-minute warning, and session-limit enforcement (all of which are "server decides the policy number, client-side code executes the actual `sendClientContent`/`close` call").

**Honest limitation this implies (do not gloss over, per explicit instruction):** a technically sophisticated user *could* tamper with client-side JavaScript to ignore a safety-intervention signal. This is not unique to HSD's choices — it's inherent to any architecture where a realtime API's ephemeral-credential model puts the live connection directly in the browser (which Gemini Live's ephemeral-token design requires). Full closure of this gap would mean the server proxying the entire audio stream itself (a fundamentally different architecture, high latency cost, explicitly not what "preserve the natural realtime experience" wants). What *does* remain fully un-tamperable: the locked system instruction and `safetySettings` (enforced Google-side, not the client's to weaken), and all server-side logging/quota/session-record enforcement (a tampering client can suppress its own UI intervention, but cannot prevent the server from recording the safety event, and — if built — from refusing to mint further tokens for that account pending review).

## 4. Exact safety gaps

1. **No runtime classification at all.** Nothing watches what the learner says during a Live session for risk signals.
2. **No intervention mechanism exists** to shift an in-progress conversation into a restricted mode.
3. **No Live-specific `safetyEvents` logging** — a real safety-relevant moment during a Live conversation today leaves no record.
4. **The one classifier that exists in this codebase (`_safetyClassifier.js`, used by `chat.js`/Ask Jona) is keyword/regex-based, not context-aware — and demonstrably produces a false positive matching your own example.** Verified by direct execution just now:
   - `"We learned about suicide prevention at school today"` → classified **`IMMEDIATE_DANGER`** (wrong — the bare-word pattern `/\bsuicide\b/i` fires regardless of context).
   - `"I want to kill myself tonight"` → classified `IMMEDIATE_DANGER` (correct).
   - `"My character died in the game, it was so sad"` → classified `NORMAL` (correct).

   This is important beyond Live: **Ask Jona has the same weakness today.** Reusing `_safetyClassifier.js` as-is for Live would inherit this exact problem, not solve it — a class discussing a health/history topic could trip an unnecessary restricted-mode switch. Any new classifier for Live should not simply be "call the same function."

## 5. Recommended architecture

Evaluated against your four options:

- **A (synchronous classify-before-every-response):** No natural place to insert this — Gemini Live doesn't expose a "hold generation for approval" hook, and forcing one by buffering the user's audio before forwarding it to Gemini would reintroduce exactly the multi-hop latency the whole Live migration was built to eliminate. **Rejected.**
- **B (async supervisor watching transcription while Live continues):** Architecturally sound and directly supported — `inputAudioTranscription`/`outputAudioTranscription` deliver text independently of generation, so classification never blocks the conversation. The open question is purely the intervention mechanism (§3), which has a real answer (Firestore realtime listener, detailed below).
- **C (native safety + locked instruction + async supervisor + escalation):** This is B, layered with the now-confirmed `safetySettings` and the existing locked system instruction as additional, free, zero-latency defense-in-depth. **This is the recommendation.**
- **D:** No stronger option was found — B/C's constraint (server can't hold the socket) is fixed by the ephemeral-credential model itself, not by architecture cleverness.

### Recommended design (Architecture C)

1. **Enable `inputAudioTranscription`/`outputAudioTranscription`** in `live-token.js`'s locked `liveConnectConstraints.config` (client cannot disable this — it's locked the same way `systemInstruction` already is).
2. **Lock `safetySettings`** into the same config — free defense-in-depth against Jona's own output, independent of everything else here.
3. **Client forwards transcript text, not audio,** to a new lightweight endpoint as `inputTranscription`/`outputTranscription` chunks arrive with `finished: true` — tiny text payloads, not the audio stream itself, and never stored beyond the classification step unless a HIGH_RISK/IMMEDIATE_DANGER tier is actually reached (§8 below).
4. **Server-side classification** on that text, using a **genuinely context-aware classifier** — not a reuse of the existing regex-based `_safetyClassifier.js` as-is (see §4.4). This likely means a real (small, fast) model-based classification call rather than pattern matching, specifically to handle your own stated distinction ("we learned about suicide prevention at school" vs. "I want to kill myself tonight"). This call runs **in parallel** with the live conversation, so its latency (likely ~0.5-1.5s for a small classification call) never blocks Jona's response — it only affects how quickly an intervention can follow a disclosure, which is a different, acceptable tradeoff.
5. **Session-level safety state** (`NORMAL` → `SENSITIVE` → `HIGH_RISK` → `IMMEDIATE_DANGER`), stored server-side per session (e.g. a field on the existing `liveSessions` doc, not a new persistent child-level field — satisfies §4/§12's "no permanent psychological labels," "conservative downgrade," and "server-authoritative" requirements together). Monotonic within a session by default (an ordinary follow-up question doesn't silently downgrade a HIGH_RISK state back to NORMAL) — the exact downgrade policy needs your decision (§12 explicitly asks for one; a reasonable default is proposed in the open-questions section, not decided unilaterally here).
6. **Intervention delivery:** the client (already running, already holding the session) subscribes via `onSnapshot` to its own session's safety-state doc — the exact same Firestore-realtime pattern already used throughout this app (e.g. `Admin.jsx`'s kill-switch listener). When the server writes a new tier, the client reacts:
   - `SENSITIVE`: no forced action — the always-on locked system instruction already covers this tier's tone; classification here is primarily for logging/pattern visibility, not intervention.
   - `HIGH_RISK`: client calls `session.sendClientContent()` with a server-provided (not client-invented) restricted-mode directive, the same mechanism already used for the idle check-in and 1-minute warning — Jona shifts into supportive, non-therapist, adult-redirecting mode *in its own voice*, not a canned audio clip.
   - `IMMEDIATE_DANGER`: same injection, but paired with a **UI-level, deterministic fallback message** (not dependent on Jona's live generation succeeding) directing to a trusted adult/emergency help, rendered directly in the floating card — because at this tier, a static, pre-approved message is more reliable than trusting further LLM generation to get exactly right in the moment.
7. **This does not require holding the WebSocket server-side** and does not change the model, voice, barge-in mechanism, or the floating UX — it adds a text-forwarding call and a Firestore listener, both additive.

## 6. Expected latency impact

**Zero** added latency to the normal conversational loop itself (transcription is asynchronous by Google's own design; classification runs in parallel, not in the response path). The only latency that exists is **detection-to-intervention latency** — the time between a disclosure and Jona's tone actually shifting — which depends on transcript-chunk arrival + classification call time + the Firestore round-trip + the client's listener firing. Realistically low seconds, not the multi-hop text-pipeline delay Live was built to eliminate. This needs real measurement in Stage 4, not an estimate treated as fact.

## 7. Expected cost impact

- Transcription: Gemini Live's own transcription is part of the same session (verify actual billing treatment before assuming free — flagged, not resolved, here).
- Classification calls: small, frequent (roughly once per meaningful transcript chunk) text-classification calls — cheap individually, needs the same "measure before assuming" discipline already applied to Live minutes themselves (§ of the cost-guardrails work).
- No new Gemini Live sessions, no additional audio processing, no change to the existing per-minute cost profile.

## 8. Privacy / data implications

- **Do not store raw transcript text by default**, per instruction. Proposed: transcript chunks are classified **in memory, for the duration of the request only**, and discarded — never written to Firestore — **unless** the tier reaches HIGH_RISK or IMMEDIATE_DANGER, at which point a **short, explicitly-bounded snippet** (the specific disclosure, not the full conversation) is justified for audit/review purposes and should be stored, redaction-considered, with a defined retention period. **This is a product/legal decision, not mine to make unilaterally** — flagged per your own instruction #14 ("If you believe a tiny redacted snippet is essential for auditing, explain why BEFORE implementing it"). My reasoning: without *some* record of what was actually said at the HIGH_RISK/IMMEDIATE_DANGER moment, "prove the safety system worked" (§25's own release-gate question) becomes unverifiable after the fact — but the exact retention window, redaction approach, and who can access it needs your explicit sign-off before any code stores it.
- No new persistent per-child fields (no risk scores, no psychological profiles) — the session-level safety state (§5.5) is ephemeral/session-scoped, not a permanent label.
- No raw audio stored, consistent with everything already built.

## 9. Failure-mode design (proposed, not yet implemented)

| Failure | Proposed fail-safe |
|---|---|
| Classifier/supervisor endpoint unavailable | The Live conversation **continues** (do not silently degrade to "block everything," which would make transient outages destroy the product), but the client detects repeated forwarding failures and, after a short bounded window, **falls back to ending the session with a friendly message** rather than continuing indefinitely with zero supervision. Exact threshold needs decision. |
| Transcript stream itself fails/stops | Same as above — a session with no transcription running is a session with no safety supervision; treat as a supervisor failure, not silent normal operation. |
| Server endpoint times out on one chunk | Ignore that one chunk, keep going — a single missed classification is not catastrophic given the layered locked-instruction defense underneath; only *sustained* failure triggers the fallback above. |
| Gemini disconnects mid-safety-event | Existing `connection_error` end-reason handling applies; the safety STATE for that session should persist in Firestore regardless (so if reconnection/resumption is ever added, state isn't lost) — but per §12, this is session-scoped, so a fresh session starts at `NORMAL` unless a same-session resumption is used. |
| Browser goes offline | Same as classifier-unavailable — bounded tolerance, then graceful end. |
| Intervention message can't be delivered (client tampered/unresponsive) | This is the one case with no perfect server-side fix (§3's honest limitation) — the server-side logging and session-record still capture that a HIGH_RISK/IMMEDIATE_DANGER event occurred and that intervention delivery could not be confirmed, which is itself a signal worth surfacing in the admin dashboard (§24) rather than silently succeeding. |

## 10. Files/endpoints that would need modification (Stage 2, not done)

- `netlify/functions/live-token.js` — add `inputAudioTranscription`/`outputAudioTranscription`/`safetySettings` to the locked config.
- New: a transcript-forwarding endpoint (tiny text payloads).
- New: a classification module (NOT a reuse of `_safetyClassifier.js` as-is — needs to be context-aware; whether that's a new prompt-based classification call or an upgraded pattern set is a Stage 2 design decision).
- New: session safety-state storage (likely a field addition to the existing `liveSessions` doc, not a new collection).
- `src/jona/TalkWithJona.jsx` — add the transcript-forwarding calls and the Firestore safety-state listener + intervention execution.
- Extend `live-session-end.js`'s logging (safety tier reached, intervention success/failure) per §14's metadata list.
- `src/pages/AdminLiveJonaTab.jsx` — add the minimal safety visibility from §24.

---

## Open questions requiring your decision before Stage 2

1. **Downgrade policy (§12):** proposed default — HIGH_RISK/IMMEDIATE_DANGER never auto-downgrades within a session; the session ends or a human/product decision resets it. SENSITIVE may decay back to NORMAL after a period of ordinary conversation. Confirm or adjust.
2. **Redacted-snippet retention (§8/§14):** whether to store a short snippet at HIGH_RISK/IMMEDIATE_DANGER tiers for auditability, and if so, exact scope/retention/access.
3. **Parent/guardian notification (§15):** explicitly not designed here, per instruction — needs its own product/legal decision later.
4. **Classifier approach:** a real classification model call vs. a substantially upgraded context-aware pattern system — cost/latency/accuracy tradeoff needs a decision, possibly after a small comparative test.
5. **Fail-safe thresholds:** exact "how many missed chunks/how long offline before graceful end" numbers.

---

**Per your instruction: this is Stage 1 only. No implementation has occurred. Awaiting your review before Stage 2.**
