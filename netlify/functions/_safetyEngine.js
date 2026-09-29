// Talk with Jona (Gemini Live) — Gate B Stage 4: shared safety
// classification core. See
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_FINAL_ARCHITECTURE_2026-09-28.md §1
// and docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md §2 for the
// approved architecture this implements.
//
// This is NOT a keyword classifier (unlike the existing, deliberately
// interim _safetyClassifier.js, which chat.js keeps using unchanged — see
// that file's own comment; migrating Ask Jona to this engine is an
// explicitly separate, later decision). It is a structured call to Gemini
// that reasons across four dimensions before naming a tier, so that
// "we learned about suicide prevention at school" (topic) and
// "I want to hurt myself" (personal, stated intent) can never collapse
// into the same signal the way a keyword match does.
//
// NO SEMANTIC PRE-FILTER (Stage 3 Revision §2, binding for the child beta):
// every substantive transcript chunk is classified by the model. The only
// input that skips the model entirely is a chunk with NO text at all
// (empty/whitespace-only) — a null-input guard, not a judgment call: there
// is nothing in an empty string that could have been a disclosure.
//
// Malformed/invalid model output is a SUPERVISOR FAILURE, never NORMAL
// (explicit instruction). classify() throws SafetyClassificationError in
// that case; callers (live-transcript-classify.js) must route that to the
// §5/§8 failure-policy path, not treat it as a clean "all clear" reading.

const DIMENSION_ENUMS = {
  register:   ["topic", "third_person", "personal"],
  intent:     ["none", "ideation", "stated_intent"],
  imminence:  ["none", "unspecified", "immediate"],
};
const VALID_TIERS = ["NORMAL", "SENSITIVE", "UNCERTAIN", "HIGH_RISK", "IMMEDIATE_DANGER"];
const VALID_CONFIDENCE = ["low", "medium", "high"];

const MODEL = "gemini-2.5-flash";

class SafetyClassificationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = "SafetyClassificationError";
    if (cause) this.cause = cause;
  }
}

// Fixed, non-client-suppliable system prompt (Stage 3 §1). The child never
// sees this and can never influence it — it is built entirely server-side
// from a constant plus the classifier's own required JSON schema.
const CLASSIFIER_SYSTEM_PROMPT = `You are a child-safety classifier for a live spoken-English learning conversation between a child and an AI tutor named Jona. You will be given the child's most recent spoken turn (transcribed) plus a short window of recent conversation context. Your ONLY job is to classify this turn across four dimensions, then name an overall tier. You are not Jona, you do not respond to the child, and nothing you output is ever shown to the child.

Dimensions:
- register: "topic" (discussing the subject in the abstract, e.g. a school lesson, a book, a historical event), "third_person" (about someone else, e.g. a friend or family member), or "personal" (about the child themself, right now).
- intent: "none" (no expressed desire/plan to act), "ideation" (thinking about it, without a stated plan), or "stated_intent" (an actual expressed intention or plan).
- imminence: "none", "unspecified" (some intent but no immediate timeframe/means), or "immediate" (right now, or with a stated timeframe/means).

Standing rule, the single most important thing to get right: framing narrows the REGISTER dimension only. It never overrides intent or imminence. A request that dresses an actionable, personal, harmful ask in "it's for a school project" or "it's just a story" framing must still be judged on the underlying intent/imminence, not cleared because of the framing. Conversely, a genuine topic-only discussion (e.g. "we learned about suicide prevention at school today") must be read as register=topic, intent=none, imminence=none, and classified NORMAL — the mere presence of a serious word is never sufficient on its own to escalate.

Tiers, in increasing severity:
- NORMAL: ordinary conversation, including topic-only discussion of serious subjects with no personal intent/imminence signal.
- SENSITIVE: real but lower-acuity distress (loneliness, sadness, emotional dependency on Jona) with no self-harm/danger signal.
- UNCERTAIN: you genuinely cannot tell, from this turn plus the given context, whether this is SENSITIVE or higher — a single ambiguous line with no clarifying context either way. Use this rather than guessing when confidence would otherwise be low on a reading that could plausibly be SENSITIVE or above.
- HIGH_RISK: a real, credible personal-safety concern without an immediate-action signal — a third-person disclosure needing attention, abuse/grooming/exploitation disclosure, ongoing bullying/harm, self-harm ideation without a stated immediate plan.
- IMMEDIATE_DANGER: a personal, stated intent to harm self or others with an immediate timeframe or stated means.

Always set confidence honestly ("low" on anything genuinely ambiguous — this is what should push you toward UNCERTAIN instead of guessing at a hard tier). Respond with structured JSON only, matching the required schema exactly.`;

function buildUserPrompt({ text, lang, priorTurnsContext }) {
  const langLine = lang === "jp"
    ? "The child's interface language is Japanese; the transcript may be in Japanese, English, or a mix — classify based on meaning, not language."
    : "The child's interface language is English; the transcript may include some Japanese — classify based on meaning, not language.";
  const contextBlock = Array.isArray(priorTurnsContext) && priorTurnsContext.length
    ? `Recent conversation context (oldest first, transcript text only):\n${priorTurnsContext.slice(-3).map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n`
    : "";
  return `${langLine}\n\n${contextBlock}Classify this turn:\n"${text}"`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    register:   { type: "STRING", enum: DIMENSION_ENUMS.register },
    intent:     { type: "STRING", enum: DIMENSION_ENUMS.intent },
    imminence:  { type: "STRING", enum: DIMENSION_ENUMS.imminence },
    tier:       { type: "STRING", enum: VALID_TIERS },
    confidence: { type: "STRING", enum: VALID_CONFIDENCE },
    reasoning:  { type: "STRING" },
  },
  required: ["register", "intent", "imminence", "tier", "confidence", "reasoning"],
};

function isNonEmptyEnum(value, allowed) {
  return typeof value === "string" && allowed.includes(value);
}

/**
 * Validates a parsed classifier response has exactly the required shape.
 * Returns the validated object, or throws SafetyClassificationError.
 */
function validateClassification(parsed) {
  if (!parsed || typeof parsed !== "object") {
    throw new SafetyClassificationError("Classifier output is not an object");
  }
  if (!isNonEmptyEnum(parsed.register, DIMENSION_ENUMS.register)) {
    throw new SafetyClassificationError(`Classifier output has invalid register: ${JSON.stringify(parsed.register)}`);
  }
  if (!isNonEmptyEnum(parsed.intent, DIMENSION_ENUMS.intent)) {
    throw new SafetyClassificationError(`Classifier output has invalid intent: ${JSON.stringify(parsed.intent)}`);
  }
  if (!isNonEmptyEnum(parsed.imminence, DIMENSION_ENUMS.imminence)) {
    throw new SafetyClassificationError(`Classifier output has invalid imminence: ${JSON.stringify(parsed.imminence)}`);
  }
  if (!isNonEmptyEnum(parsed.tier, VALID_TIERS)) {
    throw new SafetyClassificationError(`Classifier output has invalid tier: ${JSON.stringify(parsed.tier)}`);
  }
  if (!isNonEmptyEnum(parsed.confidence, VALID_CONFIDENCE)) {
    throw new SafetyClassificationError(`Classifier output has invalid confidence: ${JSON.stringify(parsed.confidence)}`);
  }
  if (typeof parsed.reasoning !== "string") {
    throw new SafetyClassificationError("Classifier output is missing reasoning");
  }
  return {
    dimensions: { register: parsed.register, intent: parsed.intent, imminence: parsed.imminence },
    tier: parsed.tier,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
  };
}

/**
 * Classifies a single transcript chunk. `fetchImpl`/`apiKey` are injectable
 * so this can be unit-tested without a real network call or a live Gemini
 * project (same pattern _profileContext.js already uses for firestoreFetch).
 *
 * @param {{ text: string, lang?: "en"|"jp", priorTurnsContext?: string[] }} input
 * @param {{ fetchImpl?: typeof fetch, apiKey?: string }} [deps]
 * @returns {Promise<{ dimensions: object, tier: string, confidence: string, reasoning: string, skipped?: boolean }>}
 */
async function classify(input, deps = {}) {
  const text = (input?.text || "").trim();

  // Null-input guard (Stage 3 Revision §2) — NOT a semantic pre-filter.
  // Only a truly empty/whitespace transcript chunk skips the model; there
  // is no early-exit for any turn that has actual content, however short.
  if (!text) {
    return {
      dimensions: { register: "topic", intent: "none", imminence: "none" },
      tier: "NORMAL",
      confidence: "high",
      reasoning: "Empty transcript chunk — nothing to classify.",
      skipped: true,
    };
  }

  const fetchImpl = deps.fetchImpl || fetch;
  const apiKey = deps.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new SafetyClassificationError("Safety engine is not configured (missing GEMINI_API_KEY)");
  }

  const requestBody = {
    contents: [{ role: "user", parts: [{ text: buildUserPrompt({ text, lang: input.lang, priorTurnsContext: input.priorTurnsContext }) }] }],
    systemInstruction: { parts: [{ text: CLASSIFIER_SYSTEM_PROMPT }] },
    generationConfig: {
      temperature: 0.1, // low temperature — this is a classification task, not creative generation
      maxOutputTokens: 400,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  let res;
  try {
    res = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) }
    );
  } catch (e) {
    throw new SafetyClassificationError("Safety classifier network request failed", e);
  }

  if (!res.ok) {
    let errText = "";
    try { errText = await res.text(); } catch { /* ignore */ }
    throw new SafetyClassificationError(`Safety classifier request failed: ${res.status} ${errText}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new SafetyClassificationError("Safety classifier returned invalid JSON envelope", e);
  }

  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const rawText = (parts.find((p) => !p.thought) ?? parts[0])?.text;
  if (!rawText) {
    throw new SafetyClassificationError("Safety classifier returned an empty candidate");
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    throw new SafetyClassificationError("Safety classifier output was not valid JSON", e);
  }

  return validateClassification(parsed);
}

module.exports = {
  classify,
  validateClassification,
  SafetyClassificationError,
  VALID_TIERS,
  VALID_CONFIDENCE,
  DIMENSION_ENUMS,
  CLASSIFIER_SYSTEM_PROMPT,
};
