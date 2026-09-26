// Wraps a pathway reducer to add a monotonic `generation` counter that
// increments on every real state transition (2026-09-27). Used to invalidate
// a pending GlobalJonaAssistant scripted reply (see jonaSendDecision.js /
// GlobalJonaAssistant's demoGeneration prop) whenever the visitor submits a
// new attempt, retries, moves to a new question, resets, or switches
// selection — without touching the underlying pathway reducers themselves
// (kept pure and independently tested, unchanged by this wrapper).
//
// Deliberately outside the pure reducer files: those already have their own
// unit tests asserting exact returned-state shapes, and this stays a thin,
// generic, separately-tested layer rather than retrofitting a `generation`
// field into four reducers' every branch.
export function withGeneration(reducer) {
  return function reducerWithGeneration(state, action) {
    const next = reducer(state, action);
    if (next === state) return state; // a no-op action never bumps generation
    return { ...next, generation: (state?.generation ?? 0) + 1 };
  };
}
