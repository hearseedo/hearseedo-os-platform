// Server-side mirror of src/lib/pathwayAccess.js's inferLegacyPathways().
// Netlify's functions folder is CommonJS-scoped (package.json) and can't
// import that ES module, same boundary as _pricePlanMap.js. Keep this in
// sync if the client-side inference logic changes — used only by
// migrate-pathway-access.js to compute the ONE-TIME lazy-migration value
// written to a legacy account's pathwayAccess field.

const APP_PATHWAY_MAP = {
  phonics:          "family",
  eiken:             "family",
  wondercamp:        "family",
  "monkeys-unlock":  "family",
  family:            "family",
  "career-ready":    "student",
  "global-ready":    "student",
  "speak-ready":     "student",
  innerkey:          "adult",
  sipswitch:         "adult",
  speak:             "adult",
  "sip-speak-learn": "adult",
};

function inferLegacyPathways(account) {
  const subs = account?.subscriptions ?? [];
  const accessible = new Set();

  for (const appId of subs) {
    const pathway = APP_PATHWAY_MAP[appId];
    if (pathway) accessible.add(pathway);
  }
  if (account?.accountType === "family") accessible.add("family");

  if (accessible.size === 0 && account?.plan && account.plan !== "free") {
    accessible.add("adult");
  }

  return [...accessible];
}

module.exports = { inferLegacyPathways, APP_PATHWAY_MAP };
