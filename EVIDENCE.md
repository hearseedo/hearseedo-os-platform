# HSD OS — Production Evidence

## Live Production URLs

| Asset | URL | Status |
|-------|-----|--------|
| HSD OS Platform | https://hearseedo-os-ai.netlify.app | ✅ Live |
| Landing Page | https://hearseedo-landing.netlify.app | ✅ Live |
| Eiken AI Coach | https://hearseedo-eiken.netlify.app | ✅ Live |
| Wondercamp | https://wondercamp.netlify.app | ✅ Live |
| Gemini API Endpoint | https://hearseedo-os-ai.netlify.app/.netlify/functions/learning-path | ✅ Live |
| Claude API Endpoint | https://hearseedo-os-ai.netlify.app/.netlify/functions/chat | ✅ Live |

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

## Gemini Learning Path Function — Server-Side Agent

Every new user triggers a live Gemini API call via `netlify/functions/learning-path.js`.

The function logs the following to Netlify Function Logs on every execution:

```
GEMINI_LEARNING_PATH_GENERATED {
  "timestamp": "<ISO timestamp>",
  "model": "gemini-2.5-flash",
  "inputTokens": <prompt token count>,
  "outputTokens": <response token count>,
  "level": "<student level>",
  "goal": "<student goal>",
  "time": "<study time>",
  "style": "<learning style>",
  "cefrAssigned": "<A1–C2>",
  "primaryApp": "<app id>"
}
```

Live function logs available at:
https://app.netlify.com/projects/hearseedo-os-ai/logs/functions

---

## Firebase — Real-Time Production Data

All user data, learning paths, and progress are stored in Cloud Firestore under project `hear-see-do-os-ai`.

**Collections in production:**
- `users/{uid}` — user profiles, subscriptions, confidence scores, streaks
- `users/{uid}/learningPath/current` — Gemini-generated personalised learning path
- `users/{uid}/appProgress/{module}` — cross-app progress tracking
- `users/{uid}/weeklyBriefing/{week}` — Jona weekly AI coaching records

Firebase project: https://console.firebase.google.com/project/hear-see-do-os-ai

---

## Stripe — Live Payment Infrastructure

Stripe is live in production with real subscription billing.

**Webhook endpoint:** `https://hearseedo-os-ai.netlify.app/.netlify/functions/stripe-webhook`
**Plans active:** 11 subscription plans (individual apps + bundles + All Access)
**Price range:** ¥833–¥4,680/month

Stripe Dashboard: https://dashboard.stripe.com

---

## Deployment History

All deployments are logged at:
https://app.netlify.com/projects/hearseedo-os-ai/deploys

**Platform built and deployed:** June 2–19, 2026 (17 days)
**Total production deploys:** 20+
**GitHub repository:** https://github.com/hearseedo/hearseedo-os-platform

---

## AI Models Running in Production

| Model | Provider | Function | Calls Triggered |
|-------|----------|----------|----------------|
| gemini-2.5-flash | Google | Learning path generation | Every new user onboarding |
| claude-sonnet-4-6 | Anthropic | Jona AI chat + weekly briefing | Every student message |
| ElevenLabs TTS | ElevenLabs | Jona voice responses | Every voice-enabled session |

All AI calls are server-side only. API keys are stored as Netlify environment variables and never exposed to the browser.

---

*Evidence file generated: 2026-06-19*
*Project owner: Jonathan Waltho / Hear See Do Empire*
*Contact: hearseedo.english@gmail.com*
