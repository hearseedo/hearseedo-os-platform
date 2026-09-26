// Adults demo pathway — café roleplay content. A small, fixed menu (never
// invented items), matched by a bounded keyword scan (see evaluateOrder.js)
// — not real language understanding, and never claimed to be.
export const MENU_DRINKS = ["coffee", "tea", "latte", "cappuccino", "espresso", "hot chocolate"];
export const SIZES = ["small", "medium", "large"];

export const SIZE_SYNONYMS = { small: "small", medium: "medium", large: "large", tall: "medium" };
export const SERVICE_PATTERNS = [
  { pattern: /\b(to go|take ?away|takeout)\b/i, value: "to go" },
  { pattern: /\b(for here|stay(ing)? here|here)\b/i, value: "for here" },
];
