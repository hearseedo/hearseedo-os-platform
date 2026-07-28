// Simple, explicit grouping for the Worlds page — user-requested ("organize
// the worlds into categories easy for users to navigate, remember
// simplicity"). Deliberately a flat id → category lookup rather than
// inferring from the underlying registries' audience fields, which use
// inconsistent shapes (arrays vs strings) and vocabularies across
// constants/worlds.js and constants/apps.js — a hand-picked list of 4
// categories is simpler to scan than a derived one.
export const CATEGORY_ORDER = ["Kids", "Teens & University", "Adults", "Family"];

export const CATEGORY_BY_ID = {
  // Kids
  "phonics":         "Kids",
  "eiken":            "Kids",
  "wondercamp":       "Kids",
  "monkeys-unlock":   "Kids",
  // Teens & University
  "speak-ready":      "Teens & University",
  "global-ready":      "Teens & University",
  "career-ready":      "Teens & University",
  // Adults
  "innerkey":          "Adults",
  "sipswitch":          "Adults",
  "speak":              "Adults",
  "sip-speak-learn":    "Adults",
  // Family
  "family":            "Family",
};

export function groupByCategory(items) {
  const groups = Object.fromEntries(CATEGORY_ORDER.map(c => [c, []]));
  for (const item of items) {
    const cat = CATEGORY_BY_ID[item.id];
    if (cat) groups[cat].push(item);
  }
  return groups;
}
