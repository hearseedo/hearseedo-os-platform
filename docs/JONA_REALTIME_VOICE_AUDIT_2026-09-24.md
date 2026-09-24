# Realtime Voice Audit — "Talk with Jona" (barge-in conversation)

**Date:** 2026-09-24
**Status:** Audit and recommendation only, per explicit instruction. Nothing built. External pricing/capability claims below were verified via live web search on this date, not recalled from memory, given how fast this space moves.

---

## Part 1 — Current architecture audit (your 13 questions)

1. **Microphone capture:** the browser's native `SpeechRecognition`/`webkitSpeechRecognition` object (`src/hooks/useJonaVoice.js`'s `startJonaListening()`). No raw `getUserMedia` audio stream — the browser's built-in API owns the microphone entirely; the app never sees raw audio.
2. **STT provider:** browser Web Speech API only. There is no dedicated STT provider (no Whisper, no Google Cloud Speech-to-Text, no Deepgram) — whatever the browser vendor does under the hood (Chrome's implementation calls Google's own speech service) is opaque and not something HSD controls or can swap.
3. **End-of-speech detection:** entirely the browser's own built-in silence/pause detection inside `SpeechRecognition`. It's single-shot (`continuous` is never set, defaults to `false`): tap → listen → the browser decides speech ended → one `onresult` event fires → recognition stops itself. No partial/interim results are read (`interimResults` isn't set either).
4. **Text response:** a single, non-streaming request — `sendMessage()` → `POST /api/chat` → Gemini 2.5 Flash `generateContent`, which returns the complete reply in one response. The client waits for the whole thing.
5. **ElevenLabs audio:** also single, non-streaming — `POST /api/tts` → ElevenLabs synthesizes the *entire* clip, returns the complete MP3 as one buffer, the client builds an `Audio` element and plays the whole file once it's fully downloaded. No streaming playback exists anywhere in the pipeline.
6. **Can an in-flight Jona text response be cancelled?** No. `sendMessage()`/`fetch()` has no `AbortController` wired up anywhere. Once sent, it runs to completion server-side regardless of what the user does client-side.
7. **Can an in-flight TTS request be cancelled?** No, same reason — plain `fetch()`, no abort wiring.
8. **Can currently-playing audio be stopped immediately?** Yes, this part already works — `audioRef.current.pause()` (`stopSpeaking()` in `useJonaVoice.js`) stops playback instantly. It's just never triggered automatically by anything today (only by the mute button).
9. **Can speech recognition operate while Jona audio is playing?** Nothing currently attempts this — the mic only ever starts on an explicit tap, never concurrently with playback. Whether it even *could* reliably work is answered by #10-11 below, and the honest answer is no, not reliably.
10. **Echo cancellation:** the Web Speech API's `SpeechRecognition` doesn't expose the browser's audio-processing constraints (`echoCancellation`, etc.) the way raw `getUserMedia` does — it's a black box. There is a real, live risk of the microphone picking up Jona's own voice from the speakers and either transcribing it as user input or blocking new recognition, especially without headphones. This is a known open problem with layering Web Speech API recognition on top of simultaneous page audio playback, not something we can configure around within this API.
11. **Mobile Safari:** this is the single most important finding. iOS is required to use WebKit for every browser (including Chrome-on-iOS), and **WebKit has never shipped a working `SpeechRecognition` implementation** — `webkitSpeechRecognition` exists as an object but is unreliable-to-nonfunctional for actual recognition on iOS. Worse, current (2026) reports describe **a specific, active bug where microphone input stops working after any media/audio playback on the page, with recognition then failing silently on retry** — this is *exactly* the "listen again after Jona speaks" pattern barge-in needs, and it's broken today, on iOS, in the browsers a large share of HSD's families likely use. This is not a barge-in-specific gap — it means today's tap-to-talk voice input is already unreliable on iPhone/iPad for any learner who has just heard Jona speak.
12. **Can the existing stack deliver reliable barge-in?** No. It's fundamentally a turn-based, four-hop pipeline (record → transcribe → generate text → synthesize → play), each hop a full round-trip, with no cancellation anywhere, unclear echo cancellation, and a mic API that's actively broken on iOS after audio playback. Even before considering "does interruption work," today's stack can't reliably re-listen after Jona has spoken at all on a meaningful share of devices.
13. **Does genuine barge-in require a realtime architecture?** Yes. What you're describing — continuous listening, instant interruption, low perceived latency, natural turn-taking — is specifically what dedicated bidirectional-streaming "realtime voice" APIs exist to solve. It is not achievable by adding timers or callback chaining on top of the current discrete-request pipeline; that would be exactly the "fake it" approach you explicitly said not to build.

---

## Part 2 — Realtime options researched (live-verified 2026-09-24)

### Option 1: Google Gemini Live API
- Full-duplex WebSocket: stream microphone audio to Gemini while simultaneously receiving generated voice back, in real time.
- **Barge-in is a named, built-in feature** — the user can interrupt the model at any time; newer models add "proactive audio" (deciding when to respond vs. stay a silent listener, reducing false interruptions).
- Pricing (Gemini 3.1 Flash Live, verified today): **~$0.005/min audio in, ~$0.018/min audio out** (token-rate-based: $3/1M input audio tokens, $12/1M output audio tokens). A free tier exists. Google also shipped newer speech-to-speech models (`gemini-3.8-live` family, Sept 2026) with their own free-tier allowances.
- Same vendor as HSD's existing text model — no new AI relationship, likely the most natural fit for keeping "one Jona intelligence."

### Option 2: ElevenLabs Conversational AI (Agents)
- A turnkey realtime conversational pipeline (STT + turn-taking/interruption + TTS + telephony) — this is ElevenLabs' own product for exactly this use case, not something we'd assemble ourselves.
- Confirmed: **you can connect a custom/third-party LLM via a server integration** rather than being locked to ElevenLabs' own model — meaning our existing Gemini call (with all its safety/profile logic intact) could stay the "brain," with ElevenLabs handling only the audio transport and interruption mechanics around it.
- Same voice provider Jona already uses (voice-identity continuity is trivial — same voice ID).
- Pricing (verified today): **~$0.08-0.10/minute** of conversation on paid plans (cheaper at higher volume tiers), a free tier with 15 minutes/month. Meaningfully more expensive per minute than Gemini Live's audio pricing.

### Option 3 (not deeply pursued): OpenAI Realtime API
- Exists, same general shape (WebSocket, barge-in supported) — not investigated in depth since it would mean a second, unrelated model vendor purely for voice, adding real integration/maintenance surface without a clear advantage over Option 1 or 2 given HSD's existing Gemini + ElevenLabs relationships. Flagging only for completeness, not recommending research time be spent here without a specific reason to prefer it.

---

## Part 3 — Answers to A-H

### A. What the existing architecture can realistically achieve
Tap-to-talk, single-turn voice questions with a few seconds of latency, audible replies (once the earlier autoplay-block fix is accounted for), and instant mute/stop of already-playing audio. That's genuinely solid for the "Ask Jona" quick-question use case. It cannot reliably re-listen after Jona speaks on iOS today (see #11), has no streaming/interruption capability, and every added hop (STT → text-gen → TTS) is a full sequential round-trip with no possibility of cancellation.

### B. What genuine interruption/barge-in requires
A persistent bidirectional audio connection (WebSocket, not discrete HTTP requests) where the server can be actively generating/streaming a response while simultaneously accepting new audio input, with the client able to instantly stop local playback the moment new speech is detected server-side or client-side. This needs voice-activity detection (VAD) running continuously during playback, not a single-shot recognizer, and neither Gemini Live nor ElevenLabs Conversational AI can be bolted onto the current fetch-based pipeline — it's a genuinely different transport model, not a bigger version of the same one.

### C. Mobile Safari limitations
No working native speech recognition (see #11) — a realtime architecture sidesteps this specific problem because it doesn't depend on `SpeechRecognition` at all; it streams raw microphone audio (via `getUserMedia`, which Safari does support) over WebSocket to the realtime service, which does its own VAD/transcription server-side. This is, concretely, the main reason "just fix the current pipeline" can't reach iOS reliably — the browser API it depends on for input is the broken piece, not our code around it. WebSocket and `getUserMedia` themselves are both supported in Safari/iOS, so a realtime architecture is technically viable there in a way the current one isn't.

### D. Recommended architecture
**Gemini Live API**, with our own Gemini text-generation call (safety classification, profile resolution, quota logic — all of it, unchanged) staying the actual decision-maker for *what* Jona says, and Live API used specifically for the audio transport/interruption layer of the new "Talk with Jona" mode. Reasoning: same vendor as the existing text model (simpler vendor relationship, one fewer integration to maintain long-term), meaningfully cheaper per-minute than ElevenLabs' conversational product, and barge-in is a first-class supported feature rather than something to configure around. The tradeoff against ElevenLabs Conversational AI: we'd likely need to keep ElevenLabs specifically for Jona's *voice identity* (the branded voice ID used everywhere else) rather than getting one turnkey package — worth confirming Gemini Live's voice options against "does this still sound like the same Jona" before committing, which is exactly why this is a recommendation to evaluate, not a final decision.

**Keep "Ask Jona" (the existing tap/type-once mode) on the current pipeline entirely, unchanged.** It works, it's cheap, and it doesn't need this complexity — your own two-mode framing (⌨️ Type / 🎙 Talk) is the right shape, and only "Talk" would ever touch the new architecture.

### E. Expected latency improvement
Today: roughly 3 sequential hops (STT's own end-of-speech wait, then a full Gemini round-trip, then a full ElevenLabs round-trip before any audio plays) — commonly several seconds of silence before Jona starts speaking, no way to shorten that structurally without streaming. A realtime architecture streams audio out as it's generated (speaking can begin within a fraction of a second of the model starting to respond, not after the full reply is ready) — this is the actual mechanism, not just "a faster API," so the improvement is structural, not incremental.

### F. Expected cost implications
This is genuinely new, continuously-billable usage that doesn't exist today — the current architecture only pays for the exact text generated and the exact characters synthesized, per message. A live session bills for connection *time*, whether or not anyone is actively talking every second of it. Gemini Live's ~$0.005-0.018/min is low per-minute, but a "Talk with Jona" session left open by a distracted child is a real, different cost shape than today's per-message billing — this needs the same kind of measurement discipline as the earlier TTS cost work (log real session durations before setting any allowance), and almost certainly needs an explicit session-length cap (e.g., auto-end after N minutes of the mic being open, or after a period of silence) so "open mic" doesn't mean "unbounded bill," independent of whatever customer-facing allowance gets decided later.

### G. Privacy implications
A live session means the microphone is genuinely open and streaming for the session's duration — a materially different privacy posture than today's "record one utterance, then stop." Your own instruction already sets the right boundary: deliberate start, unmistakable UI indication while active, an always-available "End conversation" that immediately kills mic capture/recognition/playback, and termination on logout/profile-switch/closing Jona/leaving the session. All of that needs to be real, not cosmetic — e.g., actually calling the WebSocket-close and revoking the mic permission's active stream, not just hiding a UI panel while the connection quietly stays open.

### H. Smallest implementation that gives a genuinely natural conversation
1. A new, separate "Talk with Jona" entry point (not a mode-flag on the existing `GlobalJonaAssistant` bubble — a deliberately distinct, full-session UI, matching your ⌨️/🎙 framing) that opens a Gemini Live WebSocket session scoped to one HSD profile/context, reusing the exact same server-side safety/profile-resolution logic as today's `/api/chat` (not a parallel, un-audited path).
2. User-facing states limited to Listening / Thinking / Speaking (no model/API names ever surfaced), with barge-in handled by Live API's native interruption rather than anything hand-rolled.
3. A hard session cap (time-boxed and/or silence-timeout) from day one — not optional, given the cost-shape change in F.
4. Explicit, tested termination on every boundary you listed (End button, logout, profile switch, closing Jona, leaving the session) — each one a real functional test, not an assumption.
5. Keep today's `GlobalJonaAssistant`/"Ask Jona" completely untouched as the lightweight fallback — no regression risk to what already works.

This is still real, non-trivial work (a new voice transport, a new safety-preserving integration point, new session-lifecycle logic) — "smallest" here means the smallest version of *doing it correctly*, not a shortcut version.

---

**Nothing above has been implemented.** Awaiting your decision on whether/how to proceed before any of Part 3's recommendation is built.
