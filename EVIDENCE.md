# HSD OS — Production Evidence
*Last updated: 2026-07-07*

---

## Live Production URLs

| Asset | URL | Status |
|-------|-----|--------|
| HSD OS Platform | https://app.hsdos.ai | ✅ Live |
| Landing Page | https://hearseedo-landing.netlify.app | ✅ Live |
| Eiken AI Coach | https://hearseedo-eiken.netlify.app | ✅ Live |
| WonderCamp | https://wondercamp.netlify.app | ✅ Live |
| Gemini Learning Path | https://app.hsdos.ai/.netlify/functions/learning-path | ✅ Live |
| Gemini Assessment Score | https://app.hsdos.ai/.netlify/functions/assessment-score | ✅ Live |
| Gemini Pronunciation Check | https://app.hsdos.ai/.netlify/functions/pronunciation-check | ✅ Live |
| Gemini Daily Coaching Card | https://app.hsdos.ai/.netlify/functions/coaching-card | ✅ Live |
| Jona AI Chat | https://app.hsdos.ai/.netlify/functions/chat | ✅ Live |
| Stripe Webhook | https://app.hsdos.ai/.netlify/functions/stripe-webhook | ✅ Live |

---

## Gemini API — Live Execution Log

The following is a real API response captured from the Google Gemini API in production on **2026-06-19**:

**Request:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
Model: gemini-2.5-flash
```

**Response:**
```json
{
  "candidates": [
    {
      "content": {
        "parts": [{ "text": "HSD OS Gemini API is live in production." }],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 12,
    "candidatesTokenCount": 10,
    "totalTokenCount": 40,
    "thoughtsTokenCount": 18,
    "serviceTier": "standard"
  },
  "modelVersion": "gemini-2.5-flash",
  "responseId": "1CU1asHWGqna1e8P843o4QQ"
}
```

**Token usage confirmed:** 40 total tokens | Model: `gemini-2.5-flash` | Date: 2026-06-19

---

## Gemini Functions — Five Server-Side AI Agents

All five Gemini functions run server-side on Netlify. API keys are never exposed to the browser.

### 1. Learning Path Generation (`learning-path.js`)

Every new user onboarding triggers a live Gemini API call that generates a personalised, multi-week learning path based on their level, goal, and learning style.

Logs emitted on every execution:
```
GEMINI_LEARNING_PATH_GENERATED {
  "timestamp": "<ISO timestamp>",
  "model": "gemini-2.5-flash",
  "inputTokens": <n>,
  "outputTokens": <n>,
  "level": "<student level>",
  "goal": "<student goal>",
  "time": "<study time>",
  "style": "<learning style>",
  "cefrAssigned": "<A1–C2>",
  "primaryApp": "<app id>"
}
```

### 2. Assessment Scoring (`assessment-score.js`)

Gemini evaluates each user's placement assessment (MCQ + speaking transcript) and returns a CEFR level (A1–C2) and baseline confidence score. This is the foundation for the entire personalised learning experience.

### 3. Pronunciation Feedback (`pronunciation-check.js`)

Gemini analyses a learner's spoken English transcript and returns phoneme-level feedback, identifying specific pronunciation errors and providing corrective guidance matched to their CEFR level.

### 4. Daily Coaching Card (`coaching-card.js`)  *(added 2026-07-07)*

Gemini generates a unique personalised coaching card for every user, every day. A deterministic daily seed (hash of uid + date) selects from 60 specific coaching domains and 7 coaching angles — ensuring no two users receive the same card on the same day, and no user sees a repeated pattern for 60+ days.

Logs emitted on every card generation:
```
GEMINI_COACHING_CARD_GENERATED {
  "model": "gemini-2.5-flash",
  "uid": "<uid>",
  "domain": "<today's coaching domain>",
  "angle": "<today's coaching angle>",
  "inputTokens": <n>,
  "outputTokens": <n>,
  "date": "<YYYY-MM-DD JST>"
}
```

Cards are cached in Firestore (`users/{uid}/coachingCards/{date}`) so each user receives one unique card per day, regenerated fresh the following day.

### 5. Jona AI Chat (`chat.js`)  *(migrated to Gemini 2026-07-07)*

The most-used feature on the platform — the daily conversational AI coach that every user interacts with. Migrated from Claude to Gemini 2.5 Flash so that 100% of AI intelligence in HSD OS AI is now Gemini-powered.

Logs emitted on every Jona message:
```
GEMINI_JONA_CHAT_GENERATED {
  "model": "gemini-2.5-flash",
  "uid": "<uid>",
  "plan": "<user plan>",
  "inputTokens": <n>,
  "outputTokens": <n>,
  "cached": false
}
```

The Jona persona ("You are HSD AI — never mention Claude or Anthropic") is enforced via Gemini `systemInstruction`. Rate limiting, per-user daily quotas, and Firestore response caching are all preserved.

Live function logs: https://app.netlify.com/projects/hearseedo-os-ai/logs/functions

---

## Firebase — Real-Time Production Data

All user data is stored in Cloud Firestore under project `hear-see-do-os-ai`.

**Collections in production:**
- `users/{uid}` — profile, plan, confidence score, CEFR level, streak, XP, founding member status
- `users/{uid}/learningPath/current` — Gemini-generated personalised learning path
- `users/{uid}/coachingCards/{date}` — Gemini daily coaching card (cached per day)
- `users/{uid}/missions/{date}` — daily missions with real-event auto-completion
- `users/{uid}/appProgress/{module}` — cross-app progress tracking
- `users/{uid}/weeklyBriefing/{week}` — Jona weekly AI coaching records
- `users/{uid}/familyMembers/{id}` — child profiles for family accounts
- `referrals/{uid}` — ambassador programme referral tracking
- `meta/signups` — founding member slot counter (first 200 paying users)

Firebase project: https://console.firebase.google.com/project/hear-see-do-os-ai

---

## Stripe — Live Payment Infrastructure

Stripe is live in production with real subscription billing.

**Webhook endpoint:** `https://app.hsdos.ai/.netlify/functions/stripe-webhook`  
**Webhook events handled:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`  
**Plans active:** Free · Individual ¥2,480/month · Family ¥3,980/month  
**Annual billing:** 17% off (2 months free)  
**Founding Member programme:** First 200 paying users receive a lifetime badge (tracked atomically in Firestore)

Stripe Dashboard: https://dashboard.stripe.com

---

## Platform Features — Built June 2 – July 7, 2026

| Feature | Description | AI Used |
|---------|-------------|---------|
| CEFR Placement Assessment | MCQ + speaking scored by Gemini | Gemini 2.5 Flash |
| Personalised Learning Path | Generated by Gemini on onboarding | Gemini 2.5 Flash |
| Pronunciation Feedback | Phoneme-level analysis via Gemini | Gemini 2.5 Flash |
| Daily Coaching Card | 60-domain rotation, unique per user/day | Gemini 2.5 Flash |
| Jona AI Chat Assistant | Conversational English coach with voice | Gemini 2.5 Flash + ElevenLabs TTS |
| WonderCamp Teacher Resources | 36 lesson plans, paid-gated, printable worksheets | — |
| CEFR Roadmap | Full A1–C2 with Eiken, TOEIC, IELTS equivalents | — |
| Daily Missions | Auto-complete via real events (messages sent, lessons done) | — |
| Family Profiles | Child accounts with separate progress tracking | Gemini (per child) |
| Leaderboard | XP-based, admin-excluded, real-time | — |
| Founding Member Badges | First 200 paying users, atomically tracked | — |
| Ambassador Referral System | Tiered badges, commission tracking | — |
| Subscription Management | Stripe webhooks → Firestore in real time | — |

---

## Deployment History

All deployments logged at: https://app.netlify.com/projects/hearseedo-os-ai/deploys

**Platform built:** June 2, 2026  
**Production deploys:** 35+  
**GitHub repository:** https://github.com/hearseedo/hearseedo-os-platform  
**GitHub PR (session changes):** https://github.com/hearseedo/hearseedo-os-platform/pull/1

---

## AI Models Running in Production

| Model | Provider | Function | When Triggered |
|-------|----------|----------|----------------|
| gemini-2.5-flash | Google | Learning path generation | Every new user onboarding |
| gemini-2.5-flash | Google | Assessment scoring (CEFR) | Every assessment completion |
| gemini-2.5-flash | Google | Pronunciation feedback | Every pronunciation check |
| gemini-2.5-flash | Google | Daily coaching card | Once per user per day |
| gemini-2.5-flash | Google | Jona AI chat | Every student message |
| ElevenLabs TTS | ElevenLabs | Jona voice (Daniel voice) | Every voice-enabled session |

All AI calls are server-side only. No API keys are exposed to the browser.

---

*Project owner: Jonathan Waltho / Hear See Do Empire*  
*Contact: hearseedo.english@gmail.com*  
*Location: Nagoya, Japan*
