# Jona Voice Cost Measurement + Abuse Protection

**Date:** 2026-09-24
**Status:** Items 1 and 4 below are implemented and deployed (measurement + a generous abuse-rate safety valve — neither is a customer-facing limit). Items 2-3 are cost research, informational. **No customer-facing voice cap or top-up purchasing has been built**, per your explicit instruction — this returns the requested proposal before any of that.

---

## 1. Measure/log TTS usage per authenticated account — done

`netlify/functions/tts.js` already logged a platform-wide daily aggregate (`apiCosts/{day}`: `ttsCalls`, `ttsChars`) but nothing per-account. Added a second, per-account counter at `users/{uid}/ttsUsage/{day}` (`calls`, `chars`), written the same fire-and-forget way as the existing aggregate — same bare-API-key Lambda pattern as `chatUsage` already uses (no Firebase Admin credential needed for this, matching the existing architecture). This is the data source both the abuse cap (item 4) and any future real cost rollup would read from.

## 2. Actual ElevenLabs cost drivers

`tts.js` uses `eleven_turbo_v2` specifically (already chosen for cost — the code comment says "faster + cheaper than monolingual_v1"). Verified current (2026-09) ElevenLabs pricing: **Turbo-tier models are billed at roughly $0.05 per 1,000 characters** on pay-as-you-go API pricing (half the $0.10/1,000 rate for the higher-quality Multilingual v2/v3 models) — or, on a subscription plan, priced in credits where Turbo uses about half a credit per character versus 1 credit for Multilingual v2. The exact rate HSD actually pays depends on which ElevenLabs plan the account is on (subscription-credit pricing vs. raw pay-as-you-go) — that's only visible from HSD's own ElevenLabs account dashboard, not from anything in this codebase, so I'm not asserting a single definitive number here.

Cost is driven almost entirely by **character count of the synthesized text** — `tts.js` already caps every call at 1,200 characters (`MAX_CHARS`), so a single call has a hard cost ceiling regardless of what Jona generates.

## 3. Average cost for a typical Jona interaction (estimate)

Jona's system prompt already instructs short, 2-4 sentence replies (and the 2026-09-24 tone change makes this more explicit) — a realistic spoken reply is closer to 150-350 characters, not the 1,200 max. At the $0.05/1,000-character pay-as-you-go rate, that's roughly **$0.0075-$0.0175 per spoken reply** — well under a cent to a cent and a half. A subscription-plan credit rate would likely be cheaper still. This is a rough estimate from the public rate card, not a measurement of HSD's actual bill — the new per-account logging (item 1) is what would let a future pass turn this into a real, measured number instead of an estimate.

## 4. Abuse/rate protection — done

Added a generous daily cap (300 TTS calls/account/day) directly in `tts.js`, checked against the new per-account counter before every ElevenLabs call. This is explicitly **not** the eventual customer-facing voice allowance — it's a safety valve against a runaway client (a stuck retry loop, a scripted abuser), sized so a real user would essentially never hit it in normal use. On the rare case it triggers, the response is a plain, non-technical message ("Jona's voice is taking a short break — try again in a moment, or keep typing") — never mentions characters, credits, or ElevenLabs. Both `AppModal.jsx`'s cross-origin bridge and `useJonaVoice`'s `speak()` already fail silently on any TTS error (text reply still shows, voice just doesn't play) — so this cap degrades gracefully by construction, not a new failure mode.

**Safety-path exemption:** the restricted safety response (P0-B) is generated through the same `chat.js` → optional TTS flow as any other reply. This cap is per-account and generous enough (300/day) that a safety interaction would not realistically be blocked by it — but I want to flag explicitly that there is no *dedicated* bypass for the safety path the way there is for the text-quota check in `chat.js`. If you want an explicit guarantee here rather than "generous enough in practice," that's a small follow-up (skip the cap check when the request is flagged as a safety response) — flagging as an open question rather than assuming which you'd prefer.

## 5. No customer-facing hard cap — confirmed not built

Nothing above is visible to a customer as a "voice limit," and no top-up purchasing exists. Per your instruction, this stays that way until there's real per-account cost data (now being collected via item 1) to size actual numbers against.

---

## Recommendation for next steps (not started)

Once a few weeks of real per-account `ttsUsage` data exists: compute actual $/account/month, compare against the three membership levels' current inclusions, and use that — not the estimate in section 3 — to decide what a customer-facing "Jona voice" allowance should look like. That's the point at which top-up pricing conversations become groundable in real numbers rather than a rate-card estimate.
