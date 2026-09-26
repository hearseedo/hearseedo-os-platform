// Adults demo pathway — bounded keyword-scan slot extraction. This is NOT
// real language understanding: it looks for a small, fixed vocabulary
// (drink names, size words, "to go"/"for here" phrases) at a word boundary.
// A request phrased without any of these exact words won't be recognized —
// that limitation is real and stated to the visitor, not hidden.
import { MENU_DRINKS, SIZE_SYNONYMS, SERVICE_PATTERNS } from "./data.js";

function findDrink(text) {
  const lower = text.toLowerCase();
  return MENU_DRINKS.find((d) => new RegExp(`\\b${d}\\b`, "i").test(lower)) ?? null;
}

function findSize(text) {
  const lower = text.toLowerCase();
  const match = Object.keys(SIZE_SYNONYMS).find((word) => new RegExp(`\\b${word}\\b`, "i").test(lower));
  return match ? SIZE_SYNONYMS[match] : null;
}

function findService(text) {
  const found = SERVICE_PATTERNS.find(({ pattern }) => pattern.test(text));
  return found?.value ?? null;
}

/**
 * Extracts whatever slots this specific message mentions — does not know
 * about slots mentioned in earlier turns. The caller merges results across
 * turns (see adultsReducer.js).
 * @param {string} text
 * @returns {{ drink: string|null, size: string|null, service: string|null }}
 */
export function evaluateOrder(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { drink: null, size: null, service: null };
  return { drink: findDrink(trimmed), size: findSize(trimmed), service: findService(trimmed) };
}

/**
 * @param {{ drink: string|null, size: string|null, service: string|null }} order
 * @returns {"drink"|"size"|"service"|null} the next slot to ask about, in a
 *   fixed order (drink, then size, then service) — null means the order is
 *   complete and must be accepted immediately, never re-asked.
 */
export function nextMissingSlot(order) {
  if (!order.drink) return "drink";
  if (!order.size) return "size";
  if (!order.service) return "service";
  return null;
}
