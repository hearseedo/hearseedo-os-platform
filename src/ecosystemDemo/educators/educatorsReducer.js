// Educators demo pathway — pure reducer (no React import). Everything here
// is ephemeral, sandbox-only state: selecting a learner and adding a
// suggested activity to the "sample practice plan" never touches any real
// backend, Firestore collection, or production Educator data — explicitly
// out of scope per this task's authorization.
export function initialState() {
  return {
    selectedLearnerId: null,
    planItems: [], // [{ learnerId, suggestionKey }]
    status: "browsing", // "browsing" | "done"
  };
}

export function educatorsReducer(state, action) {
  switch (action.type) {
    case "SELECT_LEARNER":
      return { ...state, selectedLearnerId: action.learnerId };
    case "ADD_TO_PLAN": {
      const already = state.planItems.some((item) => item.learnerId === action.learnerId && item.suggestionKey === action.suggestionKey);
      if (already) return state;
      return { ...state, planItems: [...state.planItems, { learnerId: action.learnerId, suggestionKey: action.suggestionKey }] };
    }
    case "COMPLETE":
      return { ...state, status: "done" };
    default:
      return state;
  }
}
