// Rebuild prompt section 8: "Existing experiences that must not be deleted
// ... retain a 'View All Worlds / Experiences' catalog." The six curated
// Worlds (constants/worlds.js) are the primary discovery layer; this is the
// full catalog of everything else already live — read from the real
// constants/apps.js entries (same cardImage/icon/iframeUrl the live
// Dashboard's AppModal already uses), not reinvented data.
import { APPS } from "./apps";
import { TOKENS } from "./tokens";

const CATALOG_APP_IDS = ["speak", "wondercamp", "family", "sipswitch", "monkeys-unlock"];

// Dedicated hero/mobile crops exist for these (constants/apps.js only carries
// a single cardImage, shared with the live AppModal header — hero/mobile
// are Living Blueprint-only, so they're mapped here instead of added there).
const ART_OVERRIDES = {
  speak:           { hero: "/assets/worlds/speak-sweat-hero.jpg",     mobile: "/assets/worlds/speak-sweat-mobile.jpg" },
  wondercamp:      { hero: "/assets/worlds/wondercamp-hero.jpg",      mobile: "/assets/worlds/wondercamp-mobile.jpg" },
  family:          { hero: "/assets/worlds/family-hero.jpg",          mobile: "/assets/worlds/family-mobile.jpg" },
  sipswitch:       { hero: "/assets/worlds/sip-switch-hero.jpg",      mobile: "/assets/worlds/sip-switch-mobile.jpg" },
};

export const LEGACY_EXPERIENCES = CATALOG_APP_IDS.map(id => {
  const app = APPS.find(a => a.id === id);
  const overrides = ART_OVERRIDES[id];
  const fallback = app.cardImage ?? app.image;
  return {
    id: app.id,
    name: app.name,
    promise: app.desc,
    launch: "external",
    iframeAppId: app.id,
    accent: app.accent ?? TOKENS.color.gold,
    comingSoon: !!app.comingSoon,
    audience: app.audience,
    art: {
      card:   app.cardImage ?? fallback,
      hero:   overrides?.hero ?? fallback,
      mobile: overrides?.mobile ?? fallback,
    },
    artStatus: fallback ? "ok" : "missing",
    analyticsName: `experience_${app.id}`,
  };
});

// SipSpeakLearn isn't in constants/apps.js — it's its own separate, dev-only
// feature flag (sipSpeakLearn/config.js), not part of the live app registry
// or subscription model. Listed here as coming soon per explicit request;
// worldAccess.js has no APP_REGISTRY_MAP entry for it, so it always reads
// as unlocked — comingSoon is what actually gates it in WorldLaunch.
export const SIP_SPEAK_LEARN_EXPERIENCE = {
  id: "sip-speak-learn",
  name: "Sip Speak Learn",
  promise: "Adult conversation practice over drinks and games — journaled and replayed.",
  launch: "external",
  iframeAppId: null,
  accent: TOKENS.color.gold,
  comingSoon: true,
  audience: "adult",
  art: {
    card:   "/assets/worlds/sip-speak-learn-card.jpg",
    hero:   "/assets/worlds/sip-speak-learn-hero.jpg",
    mobile: "/assets/worlds/sip-speak-learn-mobile.jpg",
  },
  artStatus: "ok",
  analyticsName: "experience_sip_speak_learn",
};

export const ALL_EXPERIENCES = [...LEGACY_EXPERIENCES, SIP_SPEAK_LEARN_EXPERIENCE];

export const LEGACY_EXPERIENCES_MAP = Object.fromEntries(ALL_EXPERIENCES.map(e => [e.id, e]));
