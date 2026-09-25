# Talk with Jona (Gemini Live) — Beta Cost Controls & Guardrails

**Date:** 2026-09-25
**Status:** Financial/usage guardrails implemented and deployed. Talk with Jona remains **admin-only** — see Gate B below. Do not expose to non-admin/family accounts until Gate B is explicitly resolved.

---

## 1. What changed

**New files:**
- `netlify/functions/_liveBetaPolicy.js` — centralized policy (`monthlyMinutes`, `maxSessionMinutes`, `dailySessions`, `idleCheckSeconds`, `idleDisconnectSeconds`, `maxConcurrentSessions`, plus an `admin*` tier of each). Loaded from `config/liveBetaPolicy` (public read / admin write, same convention as `config/killSwitch`), falls closed to conservative defaults on any read failure. Replaces the earlier `_liveVoiceConfig.js`, which is deleted.
- `netlify/functions/_livePricingConfig.js` — centralized Gemini Live $ rate config (`config/livePricingConfig`), plus `estimateSessionCostUSD()`. Documents plainly that the rates are carried over from earlier live-verified research on a comparable model, not confirmed for the exact model in production use — every cost figure is labeled "estimated."
- `netlify/functions/_liveSessionLock.js` — the one-active-session-per-account concurrency lock, shared by `live-token.js` (acquire) and `live-session-end.js` (release).
- `src/pages/AdminLiveJonaTab.jsx` — the admin usage/cost dashboard.

**Modified:**
- `netlify/functions/live-token.js` — added monthly/daily/concurrency enforcement (see §2), `usageClass` tagging, switched daily/monthly reset from UTC to JST (see §2's timezone note).
- `netlify/functions/live-session-end.js` — releases the concurrency lock, records token usage + estimated cost, increments monthly minutes atomically, standardizes end reasons.
- `netlify/functions/kill-switch.js` — added `disable_gemini_live` / `enable_gemini_live` actions and `geminiLiveEnabled` to the `status` action's response.
- `netlify/functions/_firebaseAdmin.js` — added `createIfAbsent` (atomic create-only-if-missing, via the `:commit` API's `currentDocument.exists: false` precondition) and `deleteDoc`.
- `src/jona/TalkWithJona.jsx` — idle check-in/disconnect state machine, ~1-minute session warning (spoken, not a UI countdown), usage-metadata capture, standardized end reasons, specific friendly messages for monthly/daily/concurrent/disabled cases, static (non-ticking) remaining-minutes display.
- `src/jona/GlobalJonaAssistant.jsx` — passes an explicit `closeReason` ("logout" vs. the generic "route_change") so end-reason reporting is accurate.
- `firestore.rules` — added explicit rules for `liveSessionUsage`, `liveUsageMonthly` (admin-read, server-write-only) and `liveActiveSession` (fully server-only, not even admin-readable — it's a short-lived lock, not a record worth keeping).
- `src/lib/i18n.js` — new customer-facing strings for the disabled/monthly/daily/concurrent-session cases and the remaining-minutes display, EN + JP.
- `tests/live-beta-policy.test.js`, `tests/live-pricing-config.test.js` — new (replacing the deleted `tests/live-voice-config.test.js`).

---

## 2. Server enforcement — exactly what the client cannot bypass

Before minting an ephemeral Gemini Live token, `live-token.js` checks, in order, and **the client cannot skip or fake any of these**:

1. **Global kill switch** (`config/killSwitch.geminiLiveEnabled`, checked via the service-account-authenticated `firestoreFetch` — the browser has no write path to this doc at all).
2. **Authenticated Firebase user** (verified idToken).
3. **Admin/test allowlist** (`hearseedo.english@gmail.com`, `waltho79@gmail.com`) — still the only path in. This task did **not** expand who can reach this endpoint.
4. **Profile ownership**, fail-closed (`_profileContext.js`, unchanged).
5. **Monthly allowance** — read from `users/{uid}/liveUsageMonthly/{YYYY-MM}.secondsUsed` (server-only collection, no client read/write path in `firestore.rules`) and compared against the account's tier limit.
6. **Daily session count** — same shape, `users/{uid}/liveSessionUsage/{YYYY-MM-DD}`.
7. **Concurrency lock** — `users/{uid}/liveActiveSession/current`, acquired via a real atomic Firestore `:commit` with an `exists: false` precondition (**not** a read-then-write race — two devices racing to start Live at the same instant cannot both succeed; one gets a definitive failure from Firestore itself).

**Nothing about "minutes remaining," "sessions today," "is Live enabled," or "may this account start a session" is ever sent by the client and trusted.** The client's mint request carries only `profileId`/`pathway`/`appName`/`lesson`/`lang` — none of which affect quota.

**Timezone:** audited before implementing. `chat.js`'s own daily text-quota reset, and every other daily-reset counter in this codebase (`coaching-card.js`, `eiken-evaluate.js`, `log-page-view.js`, the existing admin cost dashboard's own "this month" calculation) already use `Asia/Tokyo` consistently. Live's daily/monthly counters now match — a household's daily text-chat limit and daily Live-session limit reset at the same JST midnight. (The original build used UTC; that was a real inconsistency, now fixed.)

**Known, documented tradeoff:** the monthly check is a start-of-session gate against accumulated usage, not continuous metering — a session in progress can push an account over the cap by up to one session's length (5 min) in the worst case. This is accepted as a cost *guardrail*, not a hard real-time meter, consistent with how the codebase already treats analogous limits (e.g., the daily-session counter's own documented non-atomicity note, now upgraded to real atomicity only for the concurrency lock specifically, where a race genuinely mattered).

---

## 3. Firestore / data model

| Path | Written by | Read by | Purpose |
|---|---|---|---|
| `users/{uid}/liveSessions/{sessionId}` | `live-token.js` (start), `live-session-end.js` (end) | owner, admin | Per-session record: `profileId`, `pathway`, `appName`, `usageClass`, `startedAt`, `endedAt`, `durationSeconds`, `endReason`, `completedNormally`, `promptTokenCount`, `responseTokenCount`, `totalTokenCount`, `estimatedCostUSD`. **Never audio, never a transcript.** |
| `users/{uid}/liveSessionUsage/{YYYY-MM-DD}` | server only | admin only | `sessionCount` for the day (JST). |
| `users/{uid}/liveUsageMonthly/{YYYY-MM}` | server only | admin only | `secondsUsed` for the month (JST), atomically incremented. |
| `users/{uid}/liveActiveSession/current` | server only | **nobody** (not even admin) | The concurrency lock: `sessionId`, `startedAt`, `expiresAt`. Short-lived, self-expiring, not a record worth keeping. |
| `config/liveBetaPolicy` | admin (via the dashboard's direct Firestore write, `isAdminEmail()`-gated by rules) | public (same convention as `killSwitch`) | The numeric policy every limit above reads from. |
| `config/livePricingConfig` | admin | public | Cost-estimation rates. |
| `config/killSwitch.geminiLiveEnabled` | admin, via the passcode-gated `/api/kill-switch` function | public | The Live-specific enable/disable flag. |

No raw microphone audio is ever sent to a server function or stored anywhere. No full conversation transcript is stored — only cumulative token counts Gemini's own `usageMetadata` messages report.

---

## 4. Customer experience

- **~1 minute remaining:** Jona says something natural in-character (e.g. "We have about a minute left — what would you like to work on before we finish?"), generated via a hidden system-style turn sent through the existing Live session (`sendClientContent`), not a UI popup. No technical terms.
- **Idle check-in (~45s of the learner not responding):** Jona says something like "Are you still there?" the same way — a real spoken turn, not silence-then-cutoff.
- **Idle cutoff (~60s total):** the session ends itself; the floating card returns to its normal non-Live state. No dedicated "I'll end our conversation" line is forced in code (Jona's own check-in already covered the warning) — the UI simply returns to idle, consistent with "no error, no drama."
- **Daily limit:** "That's all your Talk with Jona sessions for today. You can still Ask Jona, and Talk with Jona will be available again tomorrow."
- **Monthly limit:** "You've used this month's Talk with Jona time. You can still Ask Jona anytime."
- **Live disabled (kill switch):** "Talk with Jona is temporarily unavailable. You can still Ask Jona."
- **Concurrent session on another device:** "Jona is already in a live conversation on another device."
- **Ask Jona (text)** is completely unaffected in every one of these cases — none of this touches `chat.js`, `tts.js`, or `GlobalJonaAssistant`'s existing chat panel.

No dollar amounts, token counts, or provider names appear anywhere in the customer-facing UI. A small, **static** "Jona Live: N min remaining this month" line is shown once per session (from the mint response), not a ticking countdown.

---

## 5. Admin controls

New **"Live Jona"** tab in the existing Admin panel (`src/pages/AdminLiveJonaTab.jsx`):
- Enable/disable toggle (passcode-gated, same mechanism as the existing global kill switch) — takes effect immediately for new sessions; an already-open session finishes naturally (see §6 for why that's the chosen behavior).
- Today: sessions, minutes, unique accounts.
- This month: total sessions, total minutes, average session length, unique accounts, estimated cost.
- Admin/test vs. beta-customer usage shown as separate figures — never blended into one average.
- Sessions broken down by end reason.
- Top accounts by minutes this month.
- An editable form for the beta policy numbers (`monthlyMinutes`, `maxSessionMinutes`, `dailySessions`, `idleCheckSeconds`, `idleDisconnectSeconds`) — saves directly to `config/liveBetaPolicy`; changing 30 → 60 monthly minutes is now a form submit, not a deploy.

---

## 6. Cost telemetry

**What Gemini actually gives us:** per Google's documented `LiveServerMessage.usageMetadata` shape (confirmed against the installed `@google/genai` SDK's own type definitions, not assumed), each server message can carry `promptTokenCount`, `responseTokenCount`, `totalTokenCount` (cumulative for the session). `TalkWithJona.jsx` keeps the latest one seen and sends it to `live-session-end.js` at session end.

**What is estimated, not given:** Gemini does **not** return a dollar cost. `_livePricingConfig.js` applies a per-token rate (currently the live-verified rate for a comparable Flash Live model from the 2026-09-24 audit — explicitly **not confirmed** for `gemini-2.5-flash-native-audio-preview-09-2025` specifically, since no official per-model rate card was found) to produce `estimatedCostUSD`. Every place this number appears is labeled "estimated," is admin-only, and the pricing config is remotely adjustable so the numbers can be corrected the moment a real invoice confirms the actual rate — without a code change.

The two metrics this now lets us start tracking honestly: **cost per Live minute** (directly, once real invoices arrive to calibrate the estimate) and, eventually, **average Jona AI cost per paying household** (once there are paying beta households — not yet, per explicit instruction not to build top-ups or new tiers in this task).

---

## 7. Safety status — explicit answer

**Is Talk with Jona ready to expose to child/family beta users? No.**

This is not because the financial controls are incomplete — those are done. It's because the **known Live safety gap identified on 2026-09-24 has not been resolved, and this task did not touch it** (correctly, per instruction — this was scoped as guardrails/accounting only):

- `chat.js`'s text pipeline runs `classifyRisk()` on every message **before** generating a reply and branches to a restricted, narrow safety prompt when it fires — a discrete, server-mediated gate.
- Gemini Live has **no equivalent per-turn interception point.** Once a session is open, audio streams directly between the browser and Google; the server never sees turn content to classify it in real time.
- What Live **does** have: a comprehensive, always-on safety floor locked into the session's system instruction server-side (`_liveSafetyInstruction.js`, unchanged in this task) plus Google's own built-in model-level filtering. Neither is the same guarantee as `chat.js`'s deterministic gate.
- **No `safetyEvents` logging fires for a Live-session safety moment** — a real, known, unresolved gap. If something safety-relevant happens during a Live conversation today, there is no record of it the way there is for text.

**On the quota/safety interaction specifically** (explicitly asked about): this build does **not** implement any safety-triggered exemption from the monthly/daily/concurrency limits for Live — there is no "claiming distress grants unlimited Live time" loophole, because no exemption of any kind was built. If a household's Live allowance is exhausted, Live is simply unavailable regardless of what is said, full stop. This is safe in the sense that no insecure bypass exists, but it means Live itself has no safety-exemption continuity story yet — a child in that situation would fall back to **Ask Jona's text pipeline**, which does retain its own, separate, already-working safety-quota-bypass (`chat.js`'s `RESTRICTED_SAFETY_SYSTEM` path). Jona overall remains reachable in that scenario; the *Live voice channel specifically* does not get a special exemption. I did not build one because doing so safely would require solving the per-turn classification gap first, and inventing something insecure instead was explicitly against instruction.

**Verdict: Gate A (financial controls) is satisfied. Gate B (Live child safety) is not. Talk with Jona stays admin-only.**

---

## 8. Tests — what was actually verified vs. what needs real-device/manual testing

**Automated (all passing, 328 tests total, same 49 pre-existing/unrelated baseline failures — emulator-only and one unrelated `educator` config test, both pre-dating this work):**
- `tests/live-beta-policy.test.js` — policy loader: defaults, overrides, fail-closed on error, zero/negative rejected, admin tier genuinely more generous than beta tier.
- `tests/live-pricing-config.test.js` — pricing loader (same shape) + cost formula (input/output tokens priced at distinct, non-swapped rates; zero/missing usage never throws or produces `NaN`).
- `netlify/functions/__tests__/ai-endpoints-auth.test.cjs` — `live-token`/`live-session-end` still correctly reject missing/invalid auth before touching Firestore (unchanged behavior, re-verified).
- Full existing suite re-run clean — no regressions to Ask Jona, safety classification, profile isolation, or anything else this touched indirectly.

**NOT automated — genuinely requires live/manual testing** (the numbered list from the original request, items 1–17, 21 especially):
1–7 (idle check-in/disconnect timing, session-limit warning/cutoff, false-idle-during-speech): the state machine is implemented and code-reviewed carefully (see `TalkWithJona.jsx`'s `onEnterListening`/`onLeaveListening`/`updatePhase` functions), but timer-based conversational behavior against a real Gemini Live connection cannot be verified without an actual live session and a real microphone — same limitation flagged for the original Talk with Jona build.
8–9 (daily/monthly exhaustion): logic implemented and unit-reasoned through, not exercised against real accumulated Firestore data in this pass.
11 (two simultaneous devices): the atomic lock mechanism is real (Firestore `:commit` precondition, not a race), but was not exercised with two actual concurrent browser sessions.
15 (network/Gemini disconnect releases the lock): the lock's `expiresAt` lease guarantees this structurally (see `_liveSessionLock.js`), not verified against an actual forced disconnect.
16–17 (kill switch, admin/test behavior): the toggle mechanism is proven (same code path as the existing, already-working Gemini/TTS kill switches), not clicked through live in this pass.
20 (no raw audio/transcript stored): confirmed by code inspection — nothing in `live-token.js`/`live-session-end.js`/`TalkWithJona.jsx` ever sends audio bytes or transcript text to any server endpoint; only token counts and metadata.
22 (existing tests pass): confirmed — see above.

**You (the admin) are the only account that can currently exercise this live at all** — the same "your own live test is the real verification" caveat from the original build applies here too, now extended to the guardrail behaviors specifically: hitting the daily cap, watching the idle check-in fire, and confirming the 1-minute warning sounds natural all need your own hands-on pass.

---

## 9. Release status

**Talk with Jona remains admin-only.** Gate A (financial controls) is satisfied by this work. Gate B (Live child safety — the per-turn classification/logging gap) is not resolved and was intentionally not touched in this task. Do not expand access to family/beta accounts until Gate B has its own explicit resolution and sign-off.
