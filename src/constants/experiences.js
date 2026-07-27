// Rebuild prompt section 8: "Existing experiences that must not be deleted
// ... retain a 'View All Worlds / Experiences' catalog." The six curated
// Worlds (constants/worlds.js) are the primary discovery layer; this is the
// full catalog of everything else already live — read from the real
// constants/apps.js entries (same cardImage/icon/iframeUrl the live
// Dashboard's AppModal already uses), not reinvented data.
//
// SipSpeakLearn is intentionally excluded — it's its own separate,
// dev-only feature flag (sipSpeakLearn/config.js) not yet approved for any
// production nav, curated or catalog.
import { APPS } from "./apps";
import { TOKENS } from "./tokens";

const CATALOG_APP_IDS = ["speak", "wondercamp", "family", "sipswitch", "monkeys-unlock"];

export const LEGACY_EXPERIENCES = CATALOG_APP_IDS.map(id => {
  const app = APPS.find(a => a.id === id);
  return {
    id: app.id,
    name: app.name,
    promise: app.desc,
    launch: "external",
    iframeAppId: app.id,
    accent: app.accent ?? TOKENS.color.gold,
    comingSoon: !!app.comingSoon,
    art: {
      card:   app.cardImage ?? app.image,
      hero:   app.cardImage ?? app.image,
      mobile: app.cardImage ?? app.image,
    },
    artStatus: (app.cardImage ?? app.image) ? "ok" : "missing",
    analyticsName: `experience_${app.id}`,
  };
});

export const LEGACY_EXPERIENCES_MAP = Object.fromEntries(LEGACY_EXPERIENCES.map(e => [e.id, e]));
