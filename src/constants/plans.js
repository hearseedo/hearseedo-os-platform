/* ─── 5 Active Memberships ──────────────────────────────────────────────────
 *
 *  aiAllowance  = user-facing monthly number shown in Plans page / UI
 *  ai_msgs      = internal daily API limit enforced by chat.js / stripe-webhook.js
 *
 *  University sub-plans (career-ready, global-ready, speak-ready) are LEGACY —
 *  existing subscribers keep access; new users buy University+ instead.
 * ─────────────────────────────────────────────────────────────────────────── */
export const PLANS = [
  /* ── 1. Explorer (free) ─────────────────────────────────────────────────── */
  {
    id:            "free",
    name:          "Explorer",
    nameJp:        "エクスプローラー",
    desc:          "Start your English journey. No credit card needed.",
    price_monthly: 0,
    price_yearly:  0,
    aiAllowance:   5,
    ai_msgs:       5,
    members:       1,
    color:         "#4488ff",
    badge:         null,
    legacy:        false,
    stripe:        { monthly: null, yearly: null },
    features: [
      "5 Jona AI sessions/month",
      "Access to free lessons",
      "Progress dashboard",
    ],
  },

  /* ── 2. Individual ──────────────────────────────────────────────────────── */
  {
    id:            "individual",
    name:          "Individual",
    nameJp:        "個人プラン",
    desc:          "Full platform access. Every app, every lesson — built around you.",
    price_monthly: 2480,
    price_yearly:  19800,
    aiAllowance:   50,
    ai_msgs:       50,
    members:       1,
    color:         "#4488ff",
    badge:         null,
    legacy:        false,
    stripe:        { monthly: "price_1TpbitIxMNaZk137A5viyNCb", yearly: "price_1TpbkAIxMNaZk137jWqHeHDb" },
    features: [
      "All HSD apps unlocked",
      "50 Jona AI sessions/month",
      "Daily coaching from Jona",
      "EIKEN prep, phonics, conversation tools",
      "Progress dashboard",
    ],
  },

  /* ── 3. Family ──────────────────────────────────────────────────────────── */
  {
    id:            "family",
    name:          "Family",
    nameJp:        "ファミリープラン",
    desc:          "Everything in Individual, shared with up to 5 family members. Kids and adults — one price.",
    price_monthly: 3980,
    price_yearly:  34800,
    aiAllowance:   100,
    ai_msgs:       100,
    members:       5,
    color:         "#C9A84C",
    badge:         "Best Value",
    legacy:        false,
    stripe:        { monthly: "price_1TpbkrIxMNaZk137XB9lFqFF", yearly: "price_1TpblxIxMNaZk137BKjgCOl4" },
    features: [
      "All HSD apps for every family member",
      "Up to 5 members (kids + adults)",
      "100 Jona AI sessions/month (shared)",
      "Individual profiles per member",
      "Family progress dashboard",
    ],
  },

  /* ── 4. University+ ─────────────────────────────────────────────────────── */
  {
    id:            "university-bundle",
    name:          "University+",
    nameJp:        "大学生プラス",
    desc:          "Career Ready, Global Ready, and Speak Ready — all three university apps in one plan. Built for Japanese students entering the world.",
    price_monthly: 4980,
    price_yearly:  49800,
    aiAllowance:   150,
    ai_msgs:       150,
    members:       1,
    color:         "#f59e0b",
    badge:         "University",
    legacy:        false,
    path:          "university",
    stripe:        { monthly: "price_1TsbD5IxMNaZk137PacaFJRf", yearly: "price_1TsbD6IxMNaZk137LiewJ3F1" },
    features: [
      "Career Ready — AI interview & resume coaching",
      "Global Ready — TOEFL/IELTS & study abroad prep",
      "Speak Ready — confidence-first speaking practice",
      "150 Jona AI sessions/month",
      "Founding rate — locked for life",
    ],
  },

  /* ── 5. Organization ────────────────────────────────────────────────────── */
  {
    id:            "organization",
    name:          "Organization",
    nameJp:        "法人・学校プラン",
    desc:          "Custom pricing for schools, companies, and language programs. Contact us for a tailored plan.",
    price_monthly: null,
    price_yearly:  null,
    aiAllowance:   null,
    ai_msgs:       null,
    members:       null,
    color:         "#888888",
    badge:         null,
    legacy:        false,
    contactOnly:   true,
    stripe:        { monthly: null, yearly: null },
    features: [
      "Unlimited members",
      "Custom Jona AI allowance",
      "Dedicated onboarding",
      "Analytics dashboard",
      "Priority support",
    ],
  },

  /* ── University sub-plans — LEGACY (existing subscribers keep access) ─── */
  {
    id:            "career-ready",
    name:          "Career Ready",
    nameJp:        "キャリアレディ",
    desc:          "AI interview practice, resume & email writing, and presentation coaching.",
    price_monthly: 1980,
    price_yearly:  19800,
    aiAllowance:   30,
    ai_msgs:       30,
    members:       1,
    color:         "#2ec4b6",
    badge:         "University",
    legacy:        true,
    path:          "university",
    interviewLimit: 30,
    writingLimit:   50,
    stripe:        { monthly: "price_1TrR5oIxMNaZk137JqipjbLU", yearly: "price_1TrRO5IxMNaZk137IsgSb6Zj" },
    features: [],
  },
  {
    id:            "global-ready",
    name:          "Global Ready",
    nameJp:        "グローバルレディ",
    desc:          "Study abroad prep, TOEFL/IELTS, cross-cultural communication and academic English.",
    price_monthly: 1980,
    price_yearly:  19800,
    aiAllowance:   30,
    ai_msgs:       30,
    members:       1,
    color:         "#f59e0b",
    badge:         "University",
    legacy:        true,
    path:          "university",
    stripe:        { monthly: "price_1TrR8zIxMNaZk137LTnyIHAL", yearly: "price_1TrRP3IxMNaZk137TJRI92xk" },
    features: [],
  },
  {
    id:            "speak-ready",
    name:          "Speak Ready",
    nameJp:        "スピークレディ",
    desc:          "Confidence-first speaking practice for real life.",
    price_monthly: 1980,
    price_yearly:  19800,
    aiAllowance:   30,
    ai_msgs:       30,
    members:       1,
    color:         "#f59e0b",
    badge:         "University",
    legacy:        true,
    path:          "university",
    stripe:        { monthly: "price_1TsJDfIxMNaZk137Dj2OH5z4", yearly: "price_1TsJFJIxMNaZk137JgAaIjjF" },
    features: [],
  },

  /* ── Other legacy plans — kept for existing subscribers / admin display ── */
  { id: "all_access",     name: "All Access",            nameJp: "オールアクセス",         legacy: true, aiAllowance: 100, ai_msgs: 100, price_monthly: 4980,  price_yearly: 49800,  members: 1, color: "#e01010",  stripe: { monthly: "price_1Tn5MWIxMNaZk137s02Hgc5l",  yearly: "price_1Tn5MYIxMNaZk137eAmWFQE0"  }, features: [] },
  { id: "phonics",        name: "Monkey Yoga Phonics",   nameJp: "モンキーヨガフォニックス", legacy: true, aiAllowance:  15, ai_msgs:  15, price_monthly: 1280,  price_yearly: 12800,  members: 1, color: "#4488ff",  stripe: { monthly: "price_1Tn5MNIxMNaZk1378uLJ3mvO",  yearly: "price_1Tn5MQIxMNaZk137IcXcUb86"  }, features: [] },
  { id: "eiken",          name: "Eiken Monkey",          nameJp: "英検モンキー",            legacy: true, aiAllowance:  15, ai_msgs:  15, price_monthly: 1258,  price_yearly: 12580,  members: 1, color: "#e01010",  stripe: { monthly: "price_1TicIRIxMNaZk1371JdtuVkF",  yearly: "price_1TicISIxMNaZk137jXrCViFM"  }, features: [] },
  { id: "wondercamp",     name: "Wondercamp",            nameJp: "ワンダーキャンプ",        legacy: true, aiAllowance:  15, ai_msgs:  15, price_monthly: 1680,  price_yearly: 16800,  members: 1, color: "#FF8A6B", stripe: { monthly: "price_1Tn5MnIxMNaZk137gfxeyRSE",  yearly: "price_1Tn5MpIxMNaZk137PCanjKPv"  }, features: [] },
  { id: "sipswitch",      name: "Sip & Switch",          nameJp: "シップ＆スイッチ",        legacy: true, aiAllowance:  15, ai_msgs:  15, price_monthly: 1088,  price_yearly: 10880,  members: 1, color: "#7B5EA7", stripe: { monthly: "price_1TicISIxMNaZk13795L4kNwO",  yearly: "price_1TicITIxMNaZk137oTlKK6ZS"  }, features: [] },
  { id: "speak",          name: "Speak & Sweat",         nameJp: "スピーク＆スウェット",    legacy: true, aiAllowance:  15, ai_msgs:  15, price_monthly: 1020,  price_yearly: 10200,  members: 1, color: "#22c55e", stripe: { monthly: "price_1TicIUIxMNaZk137GBUtmSzX",  yearly: "price_1TicIUIxMNaZk137wmSaPtb7"  }, features: [] },
  { id: "innerkey",       name: "InnerKey",              nameJp: "インナーキー",            legacy: true, aiAllowance:  15, ai_msgs:  15, price_monthly: 1258,  price_yearly: 12580,  members: 1, color: "#f59e0b", stripe: { monthly: "price_1TicIVIxMNaZk1379TRmqgzQ",  yearly: "price_1TicIVIxMNaZk137lpS521aS"  }, features: [] },
  { id: "kids_starter",   name: "Young Learner Bundle",  nameJp: "ヤングラーナーバンドル",  legacy: true, aiAllowance:  30, ai_msgs:  30, price_monthly: 2780,  price_yearly: 27800,  members: 1, color: "#4488ff",  stripe: { monthly: "price_1Tn5MSIxMNaZk137pVDCDNbm",  yearly: "price_1Tn5MUIxMNaZk137g0Y3hREC"  }, features: [] },
  { id: "english_boost",  name: "Exam + Convo Bundle",   nameJp: "試験＋会話バンドル",      legacy: true, aiAllowance:  30, ai_msgs:  30, price_monthly: 2108,  price_yearly: 21080,  members: 1, color: "#e01010",  stripe: { monthly: "price_1TicIYIxMNaZk137muKBEOGa",  yearly: "price_1TicIYIxMNaZk137Us9D8G8B"  }, features: [] },
  { id: "adult_growth",   name: "Active Adult Bundle",   nameJp: "アクティブ大人バンドル",  legacy: true, aiAllowance:  30, ai_msgs:  30, price_monthly: 1853,  price_yearly: 18530,  members: 1, color: "#22c55e", stripe: { monthly: "price_1TicIZIxMNaZk1374JSur2re",  yearly: "price_1TicIaIxMNaZk1377YwVDu2t"  }, features: [] },
  { id: "adult_complete", name: "Adult Complete Bundle", nameJp: "大人完全バンドル",        legacy: true, aiAllowance:  30, ai_msgs:  30, price_monthly: 2873,  price_yearly: 28730,  members: 1, color: "#7B5EA7", stripe: { monthly: "price_1TicIcIxMNaZk137U6xjyQvi",  yearly: "price_1TicIcIxMNaZk137sHthQBMC"  }, features: [] },
  { id: "family_full",    name: "Family Full",           nameJp: "ファミリーフル",          legacy: true, aiAllowance:  30, ai_msgs:  30, price_monthly: 3980,  price_yearly: 39800,  members: 5, color: "#e01010",  stripe: { monthly: null, yearly: null }, features: [] },
  { id: "family_core",    name: "Family Core",           nameJp: "ファミリーコア",          legacy: true, aiAllowance:  30, ai_msgs:  30, price_monthly: 2780,  price_yearly: 27800,  members: 3, color: "#4488ff",  stripe: { monthly: "price_1TnagjIxMNaZk137pzA7MVmv",  yearly: "price_1Tnai6IxMNaZk137zYHSznc2"  }, features: [] },
  { id: "family_plus",    name: "Family Plus",           nameJp: "ファミリープラス",        legacy: true, aiAllowance:  60, ai_msgs:  60, price_monthly: 4280,  price_yearly: 42800,  members: 5, color: "#e01010",  stripe: { monthly: "price_1Tnai8IxMNaZk137DowXFIHs",  yearly: "price_1TnaiTIxMNaZk137PT4WXsVh"  }, features: [] },
  { id: "family_premium", name: "Family Premium",        nameJp: "ファミリープレミアム",    legacy: true, aiAllowance: 100, ai_msgs: 100, price_monthly: 5980,  price_yearly: 59800,  members: 5, color: "#C9A84C", stripe: { monthly: "price_1TnaiBIxMNaZk1378n8Urtek",  yearly: "price_1TnaifIxMNaZk1377I2i888y"  }, features: [] },
];

/* ─── Convenience exports ────────────────────────────────────────────────── */

/** Plans shown on the /plans page — non-legacy only */
export const ACTIVE_PLANS = PLANS.filter(p => !p.legacy);

/** Legacy plans kept for existing subscribers and admin display */
export const LEGACY_PLANS = PLANS.filter(p => p.legacy);

/** Backwards-compat for Admin.jsx */
export const FAMILY_PLANS = PLANS.filter(p => p.id.startsWith("family_") && p.legacy);

/** AI message limits by plan ID (daily internal limit) */
export const AI_LIMITS = Object.fromEntries(
  PLANS.filter(p => p.ai_msgs != null).map(p => [p.id, p.ai_msgs])
);
