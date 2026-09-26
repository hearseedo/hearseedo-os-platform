// Students demo pathway — pure state reducer (no React import), so its
// transitions are directly unit-testable. Pathway-local: not part of the
// shell-wide useJourney() context, which stays limited to pathwayId/voiceOn
// so later-phase pathways don't collide with this one's shape.
import { evaluateAttempt } from "./evaluateAttempt.js";

/**
 * @typedef {{
 *   text: string,
 *   source: "typed" | "starter",
 *   startedFromStarterId: string | null,
 *   hasReason: boolean,
 *   timestamp: number,
 * }} Attempt
 */

export function initialState(questionIndex = 0) {
  return {
    questionIndex,
    attempts: [],
    usedStarterId: null,
    usedHint: false,
    modelAnswerRevealed: false,
    helpRequestedCount: 0,
    status: "answering", // "answering" | "reviewing" | "retried" | "done"
    priorObservation: null,
  };
}

function lastAttemptText(attempts) {
  return attempts.length ? attempts[attempts.length - 1].text : null;
}

export function studentsReducer(state, action) {
  switch (action.type) {
    case "USE_STARTER": {
      return { ...state, usedStarterId: action.starterId };
    }

    case "SUBMIT_ATTEMPT": {
      const text = (action.text ?? "").trim();
      if (!text) return state;
      const previousText = lastAttemptText(state.attempts);
      const evaluation = evaluateAttempt(text, previousText);
      const attempt = {
        text,
        source: state.usedStarterId ? "starter" : "typed",
        startedFromStarterId: state.usedStarterId,
        hasReason: evaluation.hasReason,
        timestamp: Date.now(),
      };
      return {
        ...state,
        attempts: [...state.attempts, attempt],
        status: state.attempts.length === 0 ? "reviewing" : "retried",
      };
    }

    case "REQUEST_HELP": {
      return { ...state, usedHint: true, helpRequestedCount: state.helpRequestedCount + 1 };
    }

    case "REVEAL_MODEL_ANSWER": {
      return { ...state, modelAnswerRevealed: true, usedHint: true };
    }

    case "RETRY": {
      // Resets input affordances for a new attempt, but never discards the
      // attempts history — results must be able to show the full arc.
      return { ...state, usedStarterId: null };
    }

    case "COMPLETE": {
      return { ...state, status: "done" };
    }

    case "NEXT_QUESTION": {
      const last = state.attempts[state.attempts.length - 1];
      const observation = last?.hasReason
        ? (state.attempts.length > 1 && !state.attempts[0].hasReason ? "added_reason" : "reason_from_start")
        : "present_no_reason";
      return {
        ...initialState(action.nextIndex),
        priorObservation: observation,
      };
    }

    default:
      return state;
  }
}
