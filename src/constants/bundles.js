import { APP_MAP } from "./apps.js";

export const BUNDLES = [
  {
    id: "kids_starter",
    name: "Kids Starter",
    price: 1580,
    apps: ["phonics", "wondercamp"],
    savingsPerMonth: 780,
    tagline: "The kids zone is fully loaded and ready.",
  },
  {
    id: "english_boost",
    name: "English Boost",
    price: 1980,
    apps: ["eiken", "speak"],
    savingsPerMonth: 280,
    tagline: "Your English training suite is standing by.",
  },
  {
    id: "adult_growth",
    name: "Adult Growth",
    price: 2280,
    apps: ["sipswitch", "innerkey"],
    savingsPerMonth: 480,
    tagline: "Your personal growth platform is online.",
  },
  {
    id: "family_full",
    name: "Family Full",
    price: 2980,
    apps: ["phonics", "wondercamp", "family", "speak"],
    savingsPerMonth: 1020,
    tagline: "The full family learning suite is active.",
  },
  {
    id: "all_access",
    name: "All Access",
    price: 3980,
    apps: ["phonics", "eiken", "speak", "wondercamp", "family", "sipswitch", "innerkey"],
    savingsPerMonth: 2500,
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
