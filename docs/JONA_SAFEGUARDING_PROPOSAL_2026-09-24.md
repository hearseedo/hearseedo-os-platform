# Jona Confidence & Child-Safety Knowledge Base — Proposal (research only)

**Date:** 2026-09-24
**Status:** RESEARCH AND POLICY-DESIGN PHASE ONLY, per Jonathan's explicit instruction. Nothing in this document has been implemented. The P0-B code shipped today (see `docs/JONA_ARCHITECTURE_AUDIT_2026-09-24.md`, P0-B) uses only a placeholder keyword classifier and a single restricted-response prompt — it does NOT yet implement the tiered policy below. This document is what would replace/inform that placeholder, pending your review.
**What Jona is:** an HSD learning and confidence coach informed by evidence-based child-development, educational, safeguarding, and mental-health first-response principles. **Jona is never a therapist, psychologist, doctor, diagnostician, or replacement for professional care**, and must never represent itself as one.

Sources were verified live (via web search) on 2026-09-24, not recalled from memory alone, given the safety-critical nature of this content — URLs and key facts below were checked at that date.

---

## 1. Proposed authoritative source list

| # | Source | Link | Date verified | Why this source |
|---|---|---|---|---|
| 1 | **UNICEF — Policy Guidance on AI for Children 2.0** | [unicef.org/innocenti — PDF](https://www.unicef.org/innocenti/media/1341/file/UNICEF-Global-Insight-policy-guidance-AI-children-2.0-2021.pdf) | Published Nov 2021; live 2026-09-24 | Purpose-written for AI products used by/around children — the closest thing to a direct "how should an AI product treat children" standard that exists. Nine principles (well-being, inclusion, fairness, data/privacy, safety, transparency, accountability, preparedness, enabling environment). |
| 2 | **NSPCC — Talking to children about AI / AI safety tips for parents** | [nspcc.org.uk](https://www.nspcc.org.uk/keeping-children-safe/online-safety/talking-to-children-about-ai/), [2025 safety-tips page](https://www.nspcc.org.uk/about-us/news-opinion/2025/artificial-intelligence-safety-tips-for-parents/) | 2025 pages, live 2026-09-24 | UK's leading child-protection charity; explicitly covers AI chatbots (not just general online safety). Top recommendation — never share full name/address/school/phone/photos with an AI — already matches HSD's existing `SERVER_SAFETY_FLOOR`, a useful independent confirmation the current baseline is directionally right. |
| 3 | **Samaritans — Media guidelines for reporting suicide and self-harm** | [samaritans.org/mediaguidelines](https://www.samaritans.org/about-samaritans/media-guidelines/) | Current/live 2026-09-24 | The established standard for how to talk about suicide/self-harm without causing harm (avoid method detail, avoid framing that could be imitated, emphasize that crisis can be survived) — directly informs how Jona's restricted safety response should be *worded*, not just what it should say. |
| 4 | **American Academy of Pediatrics (AAP)** — child development stage guidance | aap.org (general reference, not a single document) | Ongoing/standard reference | For age-appropriate response calibration (distinct from crisis material) — how Jona should generally speak to a 5-year-old vs. a 14-year-old. Supporting reference only, not a safety-crisis source. |
| 5 | **Japan Children and Families Agency (こども家庭庁) — 児童相談所虐待対応ダイヤル「189」** | [cfa.go.jp](https://www.cfa.go.jp/policies/jidougyakutai/gyakutai-taiou-dial/) | Live 2026-09-24 | The official, government-run, nationwide, 24/7, free, anonymous child-abuse consultation line for Japan. This is the primary Japan-specific escalation resource — HSD's audience is primarily in Japan, so a UK/US hotline would be actively wrong to show a child here. |
| 6 | **チャイルドライン (Childline Japan)** | [childline.or.jp](https://childline.or.jp/en/) | Live 2026-09-24 | Japan's general child (up to 18) listening/consultation line — 0120-99-7777, free, daily 4pm-9pm, plus online chat. Broader than abuse-specific 189 — appropriate for "I feel really sad / nobody understands me"-tier distress, not just abuse. |
| 7 | **TELL Japan (Tokyo English Life Line)** | [telljp.com/lifeline](https://telljp.com/lifeline/) | Live 2026-09-24 | English-language crisis/mental-health line in Japan (0800-300-8355, 9am-11pm daily, plus chat). Relevant because HSD's families include English-learning households who may be more comfortable in English than Japanese during a crisis — this is a genuinely Japan-specific consideration, not a US/UK default. |
| 8 | **Common Sense Media** — AI-and-kids guidance | commonsensemedia.org | Ongoing reference | Explicitly **supporting research/context only, per your instruction — not treated as a primary authority for safeguarding or mental-health response policy.** Useful for interface/UX-level decisions (how a chatbot should present itself), not for crisis-response wording. |
| 9 | **Japan APPI (Act on the Protection of Personal Information) — proposed 2026 amendments on children's data** | [Mori Hamada & Matsumoto summary](https://www.morihamada.com/en/insights/newsletters/138006), [Nishimura & Asahi summary](https://www.nishimura.com/en/knowledge/newsletters/data_protection_250108) | Amendment process ongoing as of 2026-09-24 | Not a safeguarding-response source — a **legal** one. Directly relevant because these amendments introduce a statutory framework specifically for children under 16's data, including new parental-consent/notice duties. See Section 9 below — this needs professional legal review, not my interpretation. |

**Explicitly not used as a source:** generating safety rules from the LLM's own judgment, or from generic "AI best practices" content — per your instruction not to invent this from an LLM.

**Gap I could not close in this pass:** a citable, professional (not just a hotline directory site) Japanese-language clinical source equivalent to Samaritans specifically for how to *word* a response about self-harm to a Japanese-speaking child — worth a follow-up search, or input from a Japan-based child-safeguarding professional if HSD has access to one.

---

## 2. Principle derived from each source → where Jona would use it

| Source | Principle | Where it applies |
|---|---|---|
| UNICEF AI-for-Children | "Ensure safety for children" + "Protect children's data and privacy" as co-equal, non-negotiable principles | Justifies P0-B's core design: safety response must never be blocked by a paywall/quota (directly echoes UNICEF's framing that safety can't be secondary to product/business goals) |
| UNICEF AI-for-Children | "Transparency, explainability and accountability" | Jona should never claim to be human, never obscure that it's an AI — already in `SERVER_SAFETY_FLOOR`, would carry forward unchanged |
| NSPCC | Never request/store PII (name, address, school, phone, photos) | Already implemented in `SERVER_SAFETY_FLOOR`; this source independently confirms it's the right baseline |
| NSPCC | Always point to "a parent or another safe adult like a teacher" | Directly the shape of `RESTRICTED_SAFETY_SYSTEM`'s current instruction — confirms the wording direction, not a change |
| Samaritans | Don't dramatize, don't ask for/repeat method details, emphasize that a crisis can be survived, always pair distress acknowledgment with a next step (not just sympathy alone) | Should reshape the *wording* of IMMEDIATE_DANGER/HIGH_RISK responses specifically — current `RESTRICTED_SAFETY_SYSTEM` is close but wasn't written against this standard explicitly; worth a wording pass once this proposal is approved |
| AAP (age-stage reference) | Calibrate tone/vocabulary to developmental stage | Not yet built — would require passing an age band into the safety response the same way `context.level` now flows into normal Jona (P0-E) |
| 189 / Childline Japan / TELL Japan | The actual resource named in a response must be geographically and linguistically correct | Replaces the current placeholder instruction ("trusted adults and local support services can help — do not invent a specific phone number") with real, named, verified resources — see Section 3 |
| Japan APPI amendments | Any policy that logs even metadata about a child's safety-relevant message needs to account for a specific children's-data legal regime, not just general privacy hygiene | Directly relevant to Section 7/9 below — the current `safetyEvents` collection (uid/tier/timestamp only, no content) was designed conservatively before this research, and should be reviewed against the amendment once it's closer to final |

---

## 3. Japan-specific escalation resources (verified 2026-09-24)

| Situation | Resource | Contact | Notes |
|---|---|---|---|
| Suspected abuse, being hurt by someone, unsafe at home | **189 (いちはやく)** — Children and Families Agency | Call 189, free, 24/7, anonymous | Government-run, nationwide, routes to the nearest child welfare center |
| General distress, loneliness, "nobody understands me" | **Childline Japan (チャイルドライン)** | 0120-99-7777, free, daily 4pm-9pm; chat at childline.or.jp/chat | For children up to 18; explicitly non-judgmental, doesn't lecture |
| English-speaking family in crisis | **TELL Japan Lifeline** | 0800-300-8355, free, daily 9am-11pm; chat available | Most HSD families are English-learning households — this may be more accessible than a Japanese-only line for a parent, even if the child's message is in English |
| Immediate physical danger | Japan emergency services | **110** (police) / **119** (fire/ambulance) | Standard Japan emergency numbers — Jona should mention these only for IMMEDIATE_DANGER-tier physical danger, not general distress |

**Important scoping note:** none of these numbers should be hardcoded into a place a child could misuse them (e.g., prank-calling 110) — the response should describe *who to tell* (a parent, guardian, teacher) as the primary action, with the resource offered as a secondary, adult-facing option, consistent with NSPCC's "point to a trusted adult first" principle above.

---

## 4. Proposed tier definitions

Refines the placeholder `_safetyClassifier.js` tiers shipped in P0-B with a clearer, source-grounded definition of each:

- **NORMAL** — no distress or safety signal. Normal Jona, normal quota.
- **SENSITIVE** — real but lower-acuity emotional distress (loneliness, sadness, feeling misunderstood) with no indication of physical danger or abuse. Restricted safety response, warm and brief, encourages talking to a trusted adult, but doesn't escalate further.
- **HIGH_RISK** — indications of being hurt, touched inappropriately, told to keep something secret from parents, or afraid to go home. Restricted safety response with a firmer, clearer push toward telling a trusted adult *now*, and — pending your review — potentially a distinct internal severity flag for admin review sooner than a routine log scan.
- **IMMEDIATE_DANGER** — explicit self-harm, suicide, or acute physical danger language. Restricted safety response using Samaritans-informed wording (acknowledge without dramatizing, no method discussion, always paired with an actionable next step), naming an actual Japan-appropriate resource per Section 3, plus the trusted-adult instruction.

**Open design question for you:** should HIGH_RISK/IMMEDIATE_DANGER trigger anything beyond a log entry — e.g., a notification to HSD admin for same-day review, given these categories specifically (not SENSITIVE)? Section 6 sketches an option but this is explicitly a decision for you, not something I should build unprompted.

---

## 5. Example Jona responses per tier (draft — for your review, not final copy)

- **SENSITIVE** (e.g., "nobody understands me"): *"That sounds really hard to carry by yourself. You don't have to — talking to a parent, guardian, or teacher about how you're feeling can really help, even if it feels a bit scary to start. I'm always here to help with your English learning too, whenever you're ready."*

- **HIGH_RISK** (e.g., "please don't tell my parents, it's a secret" + something troubling): *"I hear you, and I want you to know it's okay to tell a trusted adult about this — a parent, another family member, or a teacher — even if someone asked you to keep it secret. Secrets that make you feel unsafe are not secrets you have to keep. Please talk to someone you trust as soon as you can."*

- **IMMEDIATE_DANGER** (e.g., explicit self-harm language): *"I'm really glad you told me. What you're feeling matters, and you don't have to go through this alone. Please tell a parent, guardian, or another adult you trust right now — or you can call Childline Japan at 0120-99-7777 (free, every day 4-9pm) to talk to someone. If you or someone else is in immediate danger, please call 119."*

These are a first draft only — wording should ideally get a review pass from someone with direct child-safeguarding-communication experience, not just this research pass, before shipping.

---

## 6. Parent/trusted-adult escalation logic (proposed, not built)

Two distinct things that shouldn't be conflated:
1. **What Jona tells the child to do** — always "tell a trusted adult," per Sections 4-5. This is the primary mechanism and doesn't require any new HSD infrastructure.
2. **Whether HSD itself notifies anyone** — this is the open question flagged in Section 4. Options, for your decision:
   - (a) No proactive notification — safety events are logged (Section 7) and reviewable by admin, but nothing pushes a notification anywhere. Simplest, lowest false-positive-harm risk, matches "Jona is a coach, not a monitoring system."
   - (b) HIGH_RISK/IMMEDIATE_DANGER events generate an admin-facing alert (e.g., a dashboard badge or email digest) for same-day human review, without contacting the family directly and without exposing message content — a human decides whether/how to follow up.
   - (c) Direct-to-parent notification — flagged here only to explicitly **not recommend** without further thought: a child in an unsafe home (HIGH_RISK) may be at *greater* risk if the parent themselves is notified automatically. This is exactly the kind of situation where an automatic action could cause harm, which is why any escalation logic needs real safeguarding expertise before being built, not just this research pass.

Recommendation: (b) as the P1 target, explicitly not (c), with (a) as the safe minimum already achieved by P0-B's current logging.

---

## 7. What information is logged for safety events

Per your instruction (unchanged from P0-B's existing implementation, carried forward here): `users/{uid}/safetyEvents/{eventId}` stores **only**:
- `tier` (NORMAL is never logged — only SENSITIVE/HIGH_RISK/IMMEDIATE_DANGER)
- `timestamp`
- `profileId` (which family member, if applicable — routing metadata, not identity beyond what HSD already has)

Admin-read only (via `isAdminEmail()`); no client write path exists at all; written server-side via the service-account-authenticated `firestoreFetch`, which bypasses Firestore rules by design (same pattern as other server-only collections like `curriculumProgress`).

## 8. What is deliberately NOT stored

- The actual message text that triggered the classification — never logged, never persisted anywhere.
- Conversation history around the flagged message.
- Which specific keyword/pattern matched (would risk reconstructing the message's content from the log).
- Anything that would let a HIGH_RISK/IMMEDIATE_DANGER event be correlated back to a specific quote from the child, even indirectly.

This mirrors the 2026-09-09 audit's existing finding that HSD doesn't persist AI conversation content generally — this proposal keeps that property for safety events specifically, on purpose, even though it means an admin reviewing the log can see *that* something happened but not *what* was said. That tradeoff (auditability vs. content exposure) is itself worth your explicit sign-off, since reasonable people could weigh it differently — flagging rather than assuming.

## 9. Legal/privacy questions that need professional review

I want to be explicit that none of the following should be treated as legal advice — I'm flagging where a lawyer or compliance professional should look, not answering these myself:

1. **Japan's proposed APPI amendments (Section 1, source #9)** introduce specific statutory obligations for processing under-16s' personal data, including parent/guardian-directed consent and notice requirements. `safetyEvents` logging (Section 7) is metadata-only and arguably minimal, but "does this specific logging practice need to be disclosed in a specific way under the amended APPI" is a real open question once those amendments finalize — needs a lawyer familiar with Japanese data protection law, not my reading of newsletter summaries.
2. **Mandatory reporting obligations** — in some jurisdictions, an organization that becomes aware of a child abuse disclosure has legal reporting obligations of its own, separate from what the tool tells the child to do. Does Japanese law (or HSD's own terms/policies) create any such obligation for HSD as a platform operator when a HIGH_RISK/IMMEDIATE_DANGER event is logged? This is a genuine question for a lawyer, not something I should assume either way.
3. **Cross-border data question** — if any AI provider processing (Gemini, currently US/Google-operated) is itself subject to scrutiny under child-data-specific rules once the APPI amendment lands, that's worth a compliance review independent of this safety-layer proposal.
4. **Terms of Service / Privacy Policy accuracy** — once any version of this safety layer ships, HSD's own public privacy policy should accurately describe what's logged (Section 7) and what isn't (Section 8), reviewed by whoever normally handles that document.

---

**Nothing above has been implemented.** Per your instruction, this is the proposal for your review — the next step, if approved, is translating an approved version of Sections 4-6 into actual code (replacing P0-B's current placeholder classifier and single restricted prompt with the tiered, sourced version here), which I have not started.
