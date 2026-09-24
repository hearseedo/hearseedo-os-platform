# Simplicity QA — Global Jona Coverage Rollout

**Date:** 2026-09-24
**Status:** Journey audit performed via code review (no live login available in this session to click through as a real account) — findings below are grounded in the actual routing/component code, not guessed. Fixes applied where real friction was found; nothing redesigned.

---

## What was checked, per journey

**Family:** Sign in → Family Home → app/activity → Jona
**Student:** Sign in → Student Home → EIKEN / Global Ready → Jona
**Adult:** Sign in → Adult Home → Speak Ready / Career Ready → Jona

---

## Findings

| Check | Result |
|---|---|
| Unnecessary screens/clicks | Two found and fixed this session already (Sip Speak Learn's forced Welcome, EIKEN's forced "Continue Learning" tap) — see `docs/JONA_COVERAGE_AND_USAGE_AUDIT_2026-09-24.md` Part 2. Nothing new found in this pass. |
| Missing Jona | Fixed — all seven gap surfaces now wired (Family Home, Student Home, Adult Home, Career/Global/Speak Ready, Sip Speak Learn). |
| Duplicate Jona | Checked every surface with its own AI (EIKEN's Kiko-equivalent — N/A, doesn't apply; Career/Global/Speak Ready's `askCoach` roleplay; Sip Speak Learn's in-lesson `Do` conversation; Family's `JonaPlayer`) — global bubble is explicitly hidden (`showJona={false}` / conditional render) on every one of these while the structured experience owns the screen. |
| Incorrect profile | Every mount is `key={currentProfile?.id ?? "self"}` (or `user?.activeProfileId` where `currentProfile` isn't already in scope) — a profile switch forces a fresh component instance, never a stale one showing the wrong name. |
| Incorrect app context | Each surface passes its own real `{pathway, appName}` (plus `lesson` where a specific activity/lesson is active) — verified per file, not copy-pasted blindly (Family passes the category name inside `ActivityGrid`/the activity title inside `ActivityPlayer`; EIKEN passes its own screen and grade; the rest pass their app name). |
| Conversation leaking after profile switch | Same `key=` mechanism as "incorrect profile" above — a remount clears `messages` state, so there's no code path where switching profiles could carry a conversation across. Not independently re-verified end-to-end with a real login in this pass (see limitation below) but structurally guaranteed by the remount. |
| English/Japanese inconsistencies | **Found and fixed.** `GlobalJonaAssistant`'s own chrome (button labels, placeholder text, greetings, mute tooltip, etc.) was 100% hardcoded English regardless of the app's language setting — genuinely inconsistent with the rest of the platform. Added `jona_*` keys to `lib/i18n.js` (both `en`/`jp`) and wired the component to `useLang()`. Also found `sendMessage()` was always called with `lang=undefined` — Jona's actual replies were never grounded in the UI language at all; now passes the real language through. |
| Mobile obstruction / Jona covering controls | **Found and fixed.** Sip Speak Learn has its own `position:fixed; bottom:0` mobile nav bar (`.ssl-mobileNav`) that the bubble's default `bottomOffset` would have sat on top of. Set `bottomOffset={84}` there, mirroring the same fix already applied to EIKEN's own bottom bar. No other wired surface has a competing fixed-bottom element. |
| Back-navigation problems | None found — the bubble is a fixed-position overlay, z-index 999, bottom-right; every "back"/"switch pathway" control checked is top-left or in-flow, no overlap. |

## One cosmetic observation (not fixed — not friction, flagging only)

Family's "Talk" category page already shows a large decorative Jona character illustration (`fam-jona-figure`, positioned mid-page, `pointer-events:none`, purely visual). The new bottom-right functional bubble now also appears on that same screen. They don't overlap (different screen regions) and only one is interactive, so this isn't a functional duplicate-Jona problem — but it is two Jona depictions on one screen. Not changed, per your "don't redesign, fix friction" instruction — flagging in case you want a design opinion on it later.

## Limitation

I don't have a real HSD account to sign in with in this session, so the journeys above were audited by reading the actual routing/component/context code end-to-end rather than clicking through as a live user. Everything above is grounded in what the code actually does (I traced the real `key=`/`context=`/`showJona=` values for each surface rather than asserting from memory) — but a real click-through on staging before this reaches customers would still be worth doing if you want independent confirmation.
