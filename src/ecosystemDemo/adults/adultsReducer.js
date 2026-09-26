// Adults demo pathway — pure reducer (no React import). Merges recognized
// slots across turns (a visitor may state drink, size, and service across
// several messages, or all at once) and only ever asks about a slot that's
// still genuinely missing — a complete request is accepted immediately,
// never forced through an unnecessary follow-up script.
import { evaluateOrder, nextMissingSlot } from "./evaluateOrder.js";

export function initialState() {
  return {
    order: { drink: null, size: null, service: null },
    turns: [], // [{ role: "visitor" | "barista", text }]
    usedHint: false,
    status: "ordering", // "ordering" | "complete"
  };
}

function mergeOrder(existing, found) {
  return {
    drink: existing.drink ?? found.drink,
    size: existing.size ?? found.size,
    service: existing.service ?? found.service,
  };
}

export function adultsReducer(state, action) {
  switch (action.type) {
    case "SUBMIT_MESSAGE": {
      const text = (action.text ?? "").trim();
      if (!text) return state;
      const found = evaluateOrder(text);
      const order = mergeOrder(state.order, found);
      const missing = nextMissingSlot(order);
      const turns = [...state.turns, { role: "visitor", text }];
      return {
        ...state,
        order,
        turns,
        status: missing ? "ordering" : "complete",
      };
    }
    case "REQUEST_HINT":
      return { ...state, usedHint: true };
    case "RESET":
      return initialState();
    default:
      return state;
  }
}
