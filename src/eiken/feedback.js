// EIKEN Monkey — confidence-first feedback formatter.
// The spec's core tone rule lives in exactly one place: celebrate effort →
// reinforce success → improve one thing → encourage another attempt. Every
// lesson type and the interview simulator import this fragment for their
// Gemini system prompts, and format results through formatFeedback(), so the
// tone requirement can't drift between screens.
export const CONFIDENCE_FIRST_RULE =
  `Never say "wrong" or "incorrect." Always respond in this order: ` +
  `(1) celebrate the student's effort, (2) reinforce what they got right, ` +
  `(3) suggest ONE specific thing to improve, (4) encourage another attempt. ` +
  `Be warm and specific, never generic.`;

// Canonical JSON contract every evaluation prompt asks Gemini to return.
// `praise` = effort + reinforcement combined (steps 1-2), `tip` = the one
// thing to improve (step 3), `correction` = a concrete example/model answer.
export function evaluationJsonContract({ tipLabel = "one specific, encouraging tip", correctionLabel = "a brief, concrete example" } = {}) {
  return `Respond ONLY as JSON (no markdown): {"score":1-5,"praise":"one warm sentence celebrating effort and what went right","tip":"${tipLabel}","correction":"${correctionLabel}"}`;
}

// Builds a full system prompt for an evaluation call: persona + confidence
// rule + JSON contract, so every lesson type's prompt has the same shape.
export function buildEvaluationSystemPrompt(taskDescription, jsonOptions) {
  return `You are Jonathan AI, a warm and encouraging EIKEN teacher. ${taskDescription} ${CONFIDENCE_FIRST_RULE} ${evaluationJsonContract(jsonOptions)}`;
}

// Client-side fallback used when the AI call fails — keeps the same
// confidence-first shape even offline/on error, never a bare "wrong."
export function fallbackFeedback(isCorrect, correctAnswerText) {
  return {
    score: isCorrect ? 4 : 2,
    praise: isCorrect ? "Great job — that's correct! You're building real momentum." : "Good effort working through that one!",
    tip: isCorrect ? "Keep noticing the small details in each question." : "Take a moment to re-read the key details before choosing.",
    correction: correctAnswerText ? `The answer is "${correctAnswerText}".` : "",
  };
}
