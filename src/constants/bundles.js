import { APP_MAP } from "./apps.js";

export const BUNDLES = [
  {
    id: "kids_starter",
    name: "Young Learner Bundle",
    price: 2780,
    apps: ["phonics", "wondercamp"],
    savingsPerMonth: 180,
    tagline: "The kids zone is fully loaded and ready.",
  },
  {
    id: "english_boost",
    name: "English Boost",
    price: 2108,
    apps: ["eiken", "speak"],
    savingsPerMonth: 170,
    tagline: "Your English training suite is standing by.",
  },
  {
    id: "adult_growth",
    name: "Active Adult Bundle",
    price: 1853,
    apps: ["sipswitch", "speak"],
    savingsPerMonth: 255,
    tagline: "Your personal growth platform is online.",
  },
  {
    id: "adult_complete",
    name: "Adult Complete Bundle",
    price: 2873,
    apps: ["eiken", "sipswitch", "innerkey"],
    savingsPerMonth: 731,
    tagline: "The complete adult English system is yours.",
  },
  {
    id: "all_access",
    name: "All Access",
    price: 4980,
    apps: ["phonics", "eiken", "speak", "wondercamp", "family", "sipswitch", "innerkey"],
    savingsPerMonth: 2584,
    tagline: "Full access confirmed. The entire HSD ecosystem is yours.",
  },
];

export const BUNDLE_MAP = Object.fromEntries(BUNDLES.map((b) => [b.id, b]));

export function getWelcomeLine(plan, subscriptions = []) {
  if (plan === "all_access") return "Full access confirmed. The entire HSD ecosystem is yours.";
  const bundle = BUNDLES.find((b) => b.id === plan);
  if (bundle) return bundle.tagline;
  if (subscriptions.length === 1) {
    const app = APP_MAP[subscriptions[0]];
    return `Your ${app?.name || subscriptions[0]} is ready and waiting.`;
  }
  if (subscriptions.length > 1) {
    return `You have ${subscriptions.length} apps ready. Where would you like to begin?`;
  }
  return "Your platform is online.";
}
