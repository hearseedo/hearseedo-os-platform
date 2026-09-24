# Jona Coverage Matrix, Entry-Friction Fixes, and Usage Metering Audit

**Date:** 2026-09-24
**Status:** Coverage matrix + duplication recommendation is a report — awaiting your confirmation before wiring `GlobalJonaAssistant` into any new surface. Two entry-friction fixes and a tone tweak are already implemented and deployed (low-risk, per your "perform automatically where possible" instruction). Usage metering (Part 3) is audit-only, nothing changed.

---

## Part 1 — GlobalJonaAssistant coverage matrix

| Surface | Jona present? | Implementation | Notes |
|---|---|---|---|
| Legacy Dashboard (`Dashboard.jsx`) | Yes | `AIChat.jsx` / `AICoach.jsx` — older, full free-text + voice, its own quota UI | Dashboard.jsx is legacy/exit-only now (see Part 2) — not the real entry point anymore, but still reachable and still has its own Jona. |
| Family Home (`FamilyHome.jsx`) | No | — | Gap. |
| Family "Talk"/"Create" activities (`ActivityPlayer.jsx`) | Yes, but scoped | `JonaPlayer` — bespoke chat UI, `family/jonaFamily.js` prompt, turn-counted completion criteria | This is the activity's actual *content* (a structured "talk to Jona" lesson), not a general help bubble — different purpose from GlobalJonaAssistant, see recommendation below. |
| EIKEN | Yes | `GlobalJonaAssistant` (voice-enabled, `context={appName, lesson, level}`) | Already the canonical pattern. |
| Monkey Yoga Phonics V2 | Yes | `JonaHelper.tsx` (separate repo, cross-origin bridge, output-only voice) | Necessarily a separate implementation (cross-origin, no shared React tree) but same visual language/backend. |
| Monkeys Unlock | Yes | `JonaHelper.tsx` (separate repo, same pattern as Phonics V2) | Same as above. Distinct from Kiko (in-game NPC AI) — correctly not merged. |
| Student Home (`StudentHome.jsx`) | No | — | Gap. |
| Career Ready | No (help bubble) | `askCoach` exists but is the in-lesson roleplay AI, not a help widget | Gap for general help; lesson AI itself is correctly separate (different purpose, same reasoning as EIKEN's Kiko-equivalent). |
| Global Ready | No (help bubble) | Same as Career Ready | Gap. |
| Speak Ready | No (help bubble) | Same as Career Ready | Gap. |
| Adult Home (`AdultHome.jsx`) | No | — | Gap. |
| Sip Speak Learn | No (help bubble) | Has its own in-lesson conversational AI (`Do` component, `askCoach`-equivalent) | Same reasoning — lesson AI is the content, not a substitute for a help bubble. |
| WonderCamp | No | — | **Excluded from any recommendation** — still on hold per your earlier instruction (privacy-policy conflict, "do not proceed" until further instruction). Not touched. |
| Public ecosystem demo (`ecosystemDemo/steps.jsx`) | Yes | `GlobalJonaAssistant` (`demoScript` mode, no live calls) | Correct as-is — demo principle preserved. |

**Duplication found:** two genuinely separate chat implementations exist beyond `GlobalJonaAssistant` — `AIChat.jsx`/`AICoach.jsx` (legacy Dashboard) and `JonaPlayer` (Family's Talk/Create activities).

## Recommendation

- **`GlobalJonaAssistant` becomes canonical** for every general "ask for help" surface going forward — it already has voice, context-awareness, and the cross-origin pattern proven across four real deployments (dashboard-adjacent, EIKEN, Phonics V2, Monkeys Unlock).
- **`JonaPlayer` (Family Talk/Create) stays as-is, NOT merged.** It's not a duplicate in the harmful sense — it's the actual pedagogical content of a specific activity type (turn-counted, completion-criteria-driven), the same relationship EIKEN's Kiko-equivalent and Career/Global/Speak Ready's `askCoach` lesson AI have to their apps. Recommend layering `GlobalJonaAssistant` alongside it on Family Home for general help, without touching the Talk/Create activity flow itself.
- **`AIChat.jsx`/`AICoach.jsx` (legacy Dashboard) — recommend leaving alone for now, not retiring yet.** Retiring it is really "retire `Dashboard.jsx`," a larger, separate decision the 2026-09-09 audit already flagged and didn't recommend rushing (`Dashboard.jsx` is 4,029 lines and still genuinely load-bearing as an exit target for ~2 dozen call sites). Voice already works there (it's the source the shared `useJonaVoice` hook was extracted from). Not a conflict worth resolving today — flagging so it's a visible, deliberate deferral rather than an oversight.
- **The gaps** (Family Home, Student Home, Adult Home, Career/Global/Speak Ready, Sip Speak Learn) are where I'd wire `GlobalJonaAssistant` next, in the exact same pattern as EIKEN — but per your "identify duplication first and recommend" instruction, I'm holding on actually wiring these until you confirm this reading. It's seven surfaces; happy to do all of them in the next pass once you say go.

---

## Part 2 — Entry-friction: findings and fixes (implemented, deployed)

Checked Career Ready, Global Ready, Speak Ready specifically (the three you named) plus Sip Speak Learn and EIKEN ("other currently exposed apps"):

- **Career Ready, Global Ready, Speak Ready: no friction found.** All three already default straight to their `"home"` view on open — no separate welcome/init screen exists to remove. Speak Ready's placement assessment is an optional banner (`onClick`), never forced.
- **Sip Speak Learn: real friction found and fixed.** `view` unconditionally defaulted to `"welcome"` — a full-bleed splash requiring an extra tap ("Solo Practice"/"Table Mode"/"Host an Event") on *every* visit, even for a learner who's been using it for weeks, with a "Back to HSD OS" button that reinforced the feeling of being outside the platform. Fixed: now checks for any existing progress (`getStats`) and skips straight to the dashboard for a returning learner; a genuinely first-time user still sees Welcome once, since that's real necessary orientation, not friction.
- **EIKEN: real friction found and fixed.** A returning learner with a saved coach landed on a "Welcome back" sub-menu requiring one more tap ("Continue Learning") before reaching the dashboard, even when their grade was already known. Fixed: skips straight to the dashboard when both a coach *and* a saved grade already exist — the sub-menu still shows when a grade genuinely isn't set yet (its recommend/placement flow is real, necessary setup in that case, not removed).
- **Jona tone** (`src/lib/claude.js`'s `HSD_AI_SYSTEM`): added an explicit instruction that Jona's job is to help the learner do the next thing, not just answer thoroughly — short, action-oriented nudges over complete explanations — plus explicit permission to simplify English or switch into Japanese for a limited-English learner without being asked.
- **Safety-before-quota (item 7): already shipped**, confirmed still live — no action needed this round.

All four code changes above are built, committed, and deployed to production (bundle-hash verified).

---

## Part 3 — Jona usage metering audit (audit only, nothing changed)

1. **How a message is counted:** server-side in `chat.js` — `incrementCount(uid)` writes `users/{uid}/chatUsage/{todayJST}.count`, incremented once per successful, non-cached, non-safety-path assistant reply. A cached (identical, previously-answered) response still increments — it's counted as a real turn from the user's perspective.
2. **Does voice count differently than text?** No — and this is a real gap. Voice input (STT) just produces text that gets sent as a normal message and counted exactly the same way. Voice *output* (TTS, via `/api/tts`) is a **completely separate, uncounted call** — it has real ElevenLabs per-character cost but zero quota enforcement today. A heavy voice user could generate real cost with no cap at all through that path.
3. **Current daily/monthly limits:** per-day (Japan time), hardcoded in `chat.js`'s `PLAN_LIMITS`: `free: 5, individual: 50, family: 100`, plus a set of legacy plan tiers (`phonics/eiken/sipswitch/etc: 15`, `kids_starter/english_boost/etc: 30`, `family_plus: 60`, `all_access: 100`).
4. **Where stored/configured:** the limits themselves are hardcoded in the Netlify function's source code — not admin-configurable without a deploy. The live usage counter is in Firestore (`chatUsage/{day}`), reset naturally each day by the date-keyed document id.
5. **Services in one normal interaction:** Gemini 2.5 Flash (the actual reply, real API cost) + optionally ElevenLabs TTS (spoken reply, real API cost, see #2) + the browser's native Web Speech API for voice input (free, client-side, no API cost at all).
6. **Account-level or profile-level?** **Account-level.** `chatUsage` is keyed by `uid` only, not by `profileId`. This is a real, direct consequence of this session's identity-separation work worth flagging explicitly: Jona now correctly knows *who* it's talking to (Emma vs. Jonathan), but they still draw from the exact same shared daily quota pool. Two siblings under one membership currently share 5-100 messages/day between them, not 5-100 each.
7. **What happens when exhausted:** a 429 response with a plain-language message ("You've used all N messages for today. Upgrade for more daily conversations.") — except on the safety path (P0-B), which is never quota-gated regardless of exhaustion, by design.
8. **Can top-ups be added cleanly later?** Structurally yes — the quota check is a single, well-isolated comparison (`count >= limit`) that could read an additional top-up balance without disrupting anything else. No top-up mechanism exists today.
9. **What needs to change for "Jona Conversations" (customer-friendly) instead of raw message counts:**
   - A real session/conversation definition (duration + inactivity timeout + turn cap) replacing today's "every single message = 1 unit," per the earlier architecture proposal.
   - Voice (TTS) cost needs to enter the metering model somehow — today it's a free, unmetered add-on to any conversation.
   - A decision on **account-level vs. profile-level pooling** (finding #6) — this is now a live product question, not just an implementation detail, given identity is correctly profile-aware everywhere else.
   - Limits need to move out of hardcoded source into something admin-configurable if you want to tune allowances without a deploy.

**No pricing, allowance, or architecture changes made** — this is the audit you asked for, to inform that decision later.
