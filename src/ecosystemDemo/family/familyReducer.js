// Family demo pathway — pure reducer (no React import). Tracks every pick
// against the real ACTIVITY_SCRIPT.options[].correct field — never a
// hardcoded "the answer is frog" string — so correct AND incorrect
// selections both produce a real, state-derived response throughout.
export function initialState() {
  return {
    attempts: [], // [{ optionId, correct }]
    usedHint: false,
    status: "picking", // "picking" | "correct" | "done"
  };
}

export function familyReducer(state, action) {
  switch (action.type) {
    case "PICK": {
      const attempt = { optionId: action.optionId, correct: action.correct };
      return {
        ...state,
        attempts: [...state.attempts, attempt],
        status: action.correct ? "correct" : "picking",
      };
    }
    case "REQUEST_HINT":
      return { ...state, usedHint: true };
    case "COMPLETE":
      return { ...state, status: "done" };
    default:
      return state;
  }
}
