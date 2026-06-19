# HSD OS — Revenue Infrastructure & Profit Evidence

## Status: Revenue-Ready in Production

HSD OS launched on June 2, 2026. The full revenue infrastructure — subscription billing,
webhook processing, customer portal, and checkout — is live in production today.
The platform is accepting paying subscribers.

---

## Stripe Integration — Live in Production

**Stripe Account:** Live mode (not test mode)
**Webhook Endpoint:** https://hearseedo-os-ai.netlify.app/.netlify/functions/stripe-webhook
**Checkout Endpoint:** https://hearseedo-os-ai.netlify.app/.netlify/functions/create-checkout
**Customer Portal:** https://hearseedo-os-ai.netlify.app/.netlify/functions/customer-portal

All endpoints are live and responding. Webhook is verified with HMAC signature validation.

---

## Active Subscription Plans — Stripe Price IDs

| Plan | Monthly Price | Yearly Price | Stripe Monthly ID | Stripe Yearly ID |
|------|-------------|-------------|-------------------|------------------|
| Monkey Yoga Phonics | ¥833/mo | ¥8,330/yr | price_1TicIQIxMNaZk137aOQ0RqGQ | price_1TicIRIxMNaZk137YvD6AOKz |
| Eiken Monkey | ¥1,258/mo | ¥12,580/yr | price_1TicIRIxMNaZk1371JdtuVkF | price_1TicISIxMNaZk137jXrCViFM |
| Sip & Switch | ¥1,088/mo | ¥10,880/yr | price_1TicISIxMNaZk13795L4kNwO | price_1TicITIxMNaZk137oTlKK6ZS |
| Speak & Sweat | ¥1,020/mo | ¥10,200/yr | price_1TicIUIxMNaZk137GBUtmSzX | price_1TicIUIxMNaZk137wmSaPtb7 |
| InnerKey | ¥1,258/mo | ¥12,580/yr | price_1TicIVIxMNaZk1379TRmqgzQ | price_1TicIVIxMNaZk137lpS521aS |
| Young Learner Bundle | ¥2,480/mo | ¥24,800/yr | price_1TicIWIxMNaZk137JEOT7cXu | price_1TicIXIxMNaZk1377hgS7Ka2 |
| Exam + Convo Bundle | ¥2,108/mo | ¥21,080/yr | price_1TicIYIxMNaZk137muKBEOGa | price_1TicIYIxMNaZk137Us9D8G8B |
| Active Adult Bundle | ¥1,853/mo | ¥18,530/yr | price_1TicIZIxMNaZk1374JSur2re | price_1TicIaIxMNaZk1377YwVDu2t |
| Family Complete Bundle | ¥2,858/mo | ¥28,580/yr | price_1TicIaIxMNaZk137IdoAG5xv | price_1TicIbIxMNaZk137oFxCXLsy |
| Adult Complete Bundle | ¥2,873/mo | ¥28,730/yr | price_1TicIcIxMNaZk137U6xjyQvi | price_1TicIcIxMNaZk137sHthQBMC |
| All Access | ¥4,680/mo | ¥46,800/yr | price_1TicIdIxMNaZk137G3NXTVfb | price_1TicIdIxMNaZk1374kCylvKO |

**11 active plans across 2 billing cycles (monthly + yearly)**

---

## Revenue Model — Projected MRR by Subscriber Count

| Subscribers | Avg Plan (¥1,800/mo) | MRR | ARR |
|-------------|---------------------|-----|-----|
| 10 | ¥1,800 | ¥18,000 | ¥216,000 |
| 50 | ¥1,800 | ¥90,000 | ¥1,080,000 |
| 100 | ¥1,800 | ¥180,000 | ¥2,160,000 |
| 500 | ¥1,800 | ¥900,000 | ¥10,800,000 |
| 1,000 | ¥1,800 | ¥1,800,000 | ¥21,600,000 |

**Break-even: ~35–40 subscribers** (infrastructure costs ~¥60,000/month at current scale)

---

## Operating Cost Structure

| Cost | Monthly (at launch) | Monthly (1,000 users) |
|------|--------------------|-----------------------|
| Netlify (hosting + functions) | ¥0–¥7,500 | ¥15,000 |
| Firebase (auth + Firestore) | ¥0 (Spark plan) | ¥8,000 |
| Gemini API (per-user calls) | <¥1/user | ¥1,000 |
| Claude API (per-message) | ~¥2/1,000 tokens | ¥20,000 |
| ElevenLabs TTS | ~¥1,500 | ¥15,000 |
| Stripe fees | 2.9% + ¥30/transaction | ~¥54,000 |
| **Total** | **~¥10,000** | **~¥113,000** |

At 1,000 subscribers (¥1,800 avg): **¥1,687,000/month net margin (~94%)**

---

## Why This Model Reaches Profitability Quickly

1. **Serverless infrastructure** — zero fixed server costs, scales with users
2. **AI inference is marginal** — Gemini and Claude costs are per-call, not per-seat
3. **No human teachers** — Jona (AI) replaces the most expensive line item in EdTech
4. **Recurring billing** — Stripe handles renewals automatically with zero manual work
5. **Free entry point** — HSD Family app is free for all users, creating a habit loop
   that converts to paid subscriptions without a sales team

---

## Revenue Infrastructure Files in This Repository

| File | Purpose |
|------|---------|
| `netlify/functions/create-checkout.js` | Creates Stripe checkout sessions |
| `netlify/functions/stripe-webhook.js` | Processes payments, upgrades, cancellations |
| `netlify/functions/customer-portal.js` | Self-serve billing management |
| `src/constants/plans.js` | All 11 plans with Stripe price IDs |
| `src/pages/Plans.jsx` | Public-facing pricing page |

---

## Live Platform

- **Platform:** https://hearseedo-os-ai.netlify.app
- **Pricing page:** https://hearseedo-os-ai.netlify.app/plans
- **Landing page:** https://hearseedo-landing.netlify.app

Subscriptions can be purchased today. All revenue flows directly to the
Stripe account under Hear See Do Empire (Jonathan Waltho).

---

*Revenue file generated: 2026-06-19*
*Project owner: Jonathan Waltho / Hear See Do Empire*
*Contact: hearseedo.english@gmail.com*
