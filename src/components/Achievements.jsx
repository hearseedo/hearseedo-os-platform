import { useState } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";

// HSD Family visual pass (2026-09-09) — real badge artwork for the subset of
// achievements the supplied "HSD_Street_Graffiti_Achievement_Badges" set
// covers, mapped by closest title/theme match (see the report for the full
// mapping rationale). Additive metadata only — never read by `check()` or
// any filter/unlock logic, and the default (non-family) Badge rendering
// below ignores it entirely, so Dashboard/RewardsPanel are unaffected.
const BADGE_BASE = "/assets/hsd/family/achievements";
const FAMILY_BADGE_IMAGE = {
  xp_100:                 `${BADGE_BASE}/achievement-first-step.webp`,
  streak_7:                `${BADGE_BASE}/achievement-7-day-streak.webp`,
  streak_30:               `${BADGE_BASE}/achievement-30-day-streak.webp`,
  family_first_talk:       `${BADGE_BASE}/achievement-first-conversation.webp`,
  family_10_attempts:      `${BADGE_BASE}/achievement-10-conversations.webp`,
  family_story_explorer:   `${BADGE_BASE}/achievement-world-explorer.webp`,
  family_challenge:        `${BADGE_BASE}/achievement-mission-complete.webp`,
  lesson_10:                `${BADGE_BASE}/achievement-word-builder.webp`,
  family_great_listener:   `${BADGE_BASE}/achievement-super-listener.webp`,
  family_brave_speaker:    `${BADGE_BASE}/achievement-confident-speaker.webp`,
  conf_25:                 `${BADGE_BASE}/achievement-confidence-builder.webp`,
};

export const ACHIEVEMENTS = [
  { id: "streak_3",   category: "streak",     title: "On a Roll",          titleJp: "絶好調",           desc: "3-day streak",           descJp: "3日連続ストリーク",           icon: "🔥", xp: 50,   check: (u) => (u.streak ?? 0) >= 3   },
  { id: "streak_7",   category: "streak",     title: "Week Warrior",       titleJp: "週間戦士",         desc: "7-day streak",           descJp: "7日連続ストリーク",           icon: "🔥", xp: 150,  check: (u) => (u.streak ?? 0) >= 7   },
  { id: "streak_30",  category: "streak",     title: "Monthly Master",     titleJp: "月間マスター",     desc: "30-day streak",          descJp: "30日連続ストリーク",          icon: "🔥", xp: 500,  check: (u) => (u.streak ?? 0) >= 30  },
  { id: "streak_100", category: "streak",     title: "Legend",             titleJp: "レジェンド",       desc: "100-day streak",         descJp: "100日連続ストリーク",         icon: "🔥", xp: 2000, check: (u) => (u.streak ?? 0) >= 100 },
  { id: "xp_100",     category: "xp",         title: "First Steps",        titleJp: "最初の一歩",       desc: "Earn 100 XP",            descJp: "100 XP獲得",                icon: "⭐", xp: 25,   check: (u) => (u.xpEarned ?? 0) >= 100   },
  { id: "xp_500",     category: "xp",         title: "Getting Serious",    titleJp: "本気モード",       desc: "Earn 500 XP",            descJp: "500 XP獲得",                icon: "⭐", xp: 75,   check: (u) => (u.xpEarned ?? 0) >= 500   },
  { id: "xp_1000",    category: "xp",         title: "Power Learner",      titleJp: "パワーラーナー",   desc: "Earn 1,000 XP",          descJp: "1,000 XP獲得",              icon: "⭐", xp: 200,  check: (u) => (u.xpEarned ?? 0) >= 1000  },
  { id: "xp_5000",    category: "xp",         title: "XP Champion",        titleJp: "XPチャンピオン",   desc: "Earn 5,000 XP",          descJp: "5,000 XP獲得",              icon: "⭐", xp: 750,  check: (u) => (u.xpEarned ?? 0) >= 5000  },
  { id: "conf_25",    category: "confidence", title: "Building Up",        titleJp: "成長中",           desc: "Reach 25% confidence",   descJp: "自信度25%達成",             icon: "💪", xp: 50,   check: (u) => (u.confidenceScore ?? 0) >= 25  },
  { id: "conf_50",    category: "confidence", title: "Half Way There",     titleJp: "折り返し地点",     desc: "Reach 50% confidence",   descJp: "自信度50%達成",             icon: "💪", xp: 150,  check: (u) => (u.confidenceScore ?? 0) >= 50  },
  { id: "conf_75",    category: "confidence", title: "Highly Confident",   titleJp: "高い自信",         desc: "Reach 75% confidence",   descJp: "自信度75%達成",             icon: "💪", xp: 300,  check: (u) => (u.confidenceScore ?? 0) >= 75  },
  { id: "conf_100",   category: "confidence", title: "Unstoppable",        titleJp: "止まらない",       desc: "Reach 100% confidence",  descJp: "自信度100%達成",            icon: "💪", xp: 1000, check: (u) => (u.confidenceScore ?? 0) >= 100 },
  { id: "app_first",  category: "apps",       title: "First Launch",       titleJp: "初起動",           desc: "Unlock your first app",  descJp: "最初のアプリを解除",         icon: "📱", xp: 50,   check: (u) => (u.subscriptions ?? []).length >= 1 },
  { id: "app_three",  category: "apps",       title: "App Explorer",       titleJp: "アプリ探検家",     desc: "Unlock 3 apps",          descJp: "3つのアプリを解除",          icon: "📱", xp: 200,  check: (u) => (u.subscriptions ?? []).length >= 3 },
  { id: "app_all",    category: "apps",       title: "Full Access",        titleJp: "フルアクセス",     desc: "Unlock all 7 apps",      descJp: "全7アプリを解除",            icon: "📱", xp: 1000, check: (u) => (u.subscriptions ?? []).length >= 7 },
  { id: "lesson_1",   category: "lessons",    title: "First Lesson",       titleJp: "最初のレッスン",   desc: "Complete 1 lesson",      descJp: "1レッスン完了",             icon: "📖", xp: 25,   check: (u) => (u.lessonsCompleted ?? 0) >= 1   },
  { id: "lesson_10",  category: "lessons",    title: "Study Habit",        titleJp: "学習習慣",         desc: "Complete 10 lessons",    descJp: "10レッスン完了",            icon: "📖", xp: 100,  check: (u) => (u.lessonsCompleted ?? 0) >= 10  },
  { id: "lesson_50",  category: "lessons",    title: "Dedicated Learner",  titleJp: "熱心な学習者",     desc: "Complete 50 lessons",    descJp: "50レッスン完了",            icon: "📖", xp: 400,  check: (u) => (u.lessonsCompleted ?? 0) >= 50  },
  { id: "lesson_100", category: "lessons",    title: "100 Club",           titleJp: "100クラブ",       desc: "Complete 100 lessons",   descJp: "100レッスン完了",           icon: "📖", xp: 1000, check: (u) => (u.lessonsCompleted ?? 0) >= 100 },
  { id: "family_add", category: "special",    title: "Family First",       titleJp: "ファミリーファースト", desc: "Add a family member",    descJp: "家族メンバーを追加",       icon: "👨‍👩‍👧", xp: 100,  check: (u) => (u.familyMembers ?? []).length >= 1 },
  { id: "all_access", category: "special",    title: "All Access Member",  titleJp: "オールアクセス会員", desc: "Upgrade to All Access",  descJp: "オールアクセスにアップグレード", icon: "👑", xp: 500,  check: (u) => u.plan === "all_access"   },
  { id: "founding",   category: "special",    title: "Founding Member",    titleJp: "ファウンディングメンバー", desc: "Joined in the first wave", descJp: "第一波に参加", icon: "🌟", xp: 2000, check: (u) => !!u.isFoundingMember  },
  // ── HSD Family (Phase 3, 2026-09-09) — reuses this same architecture,
  // checked against the new familyXxxCompleted counters src/family/
  // familyProgress.js bumps on each activity completion. Deliberately a
  // small starter set (item 22: "enough to test whether achievements
  // motivate children", not dozens yet).
  { id: "family_first_talk", category: "family", title: "First Conversation", titleJp: "はじめての会話",   desc: "Talk to Jona for the first time", descJp: "はじめてJonaと話した", icon: "👋", xp: 50,  check: (u) => (u.familyTalkCompleted ?? 0) >= 1 },
  { id: "family_brave_speaker", category: "family", title: "Brave Speaker",   titleJp: "勇敢なスピーカー", desc: "Complete 3 Talk to Jona activities", descJp: "Jonaとの会話を3回完了", icon: "🎤", xp: 150, check: (u) => (u.familyTalkCompleted ?? 0) >= 3 },
  { id: "family_great_listener", category: "family", title: "Great Listener", titleJp: "聞き上手",        desc: "Complete 3 Hear activities",      descJp: "Hearアクティビティを3回完了", icon: "👂", xp: 100, check: (u) => (u.familyHearCompleted ?? 0) >= 3 },
  { id: "family_story_explorer", category: "family", title: "Story Explorer", titleJp: "ストーリー探検家", desc: "Complete 2 See activities",        descJp: "Seeアクティビティを2回完了", icon: "📖", xp: 100, check: (u) => (u.familySeeCompleted ?? 0) >= 2 },
  { id: "family_movement_master", category: "family", title: "Movement Master", titleJp: "ムーブメントマスター", desc: "Complete 3 Do activities", descJp: "Doアクティビティを3回完了", icon: "🤸", xp: 100, check: (u) => (u.familyDoCompleted ?? 0) >= 3 },
  { id: "family_creative_thinker", category: "family", title: "Creative Thinker", titleJp: "クリエイティブシンカー", desc: "Complete 2 Create activities", descJp: "Createアクティビティを2回完了", icon: "🎨", xp: 100, check: (u) => (u.familyCreateCompleted ?? 0) >= 2 },
  { id: "family_challenge",  category: "family", title: "Family Challenge", titleJp: "ファミリーチャレンジ", desc: "Complete a Family Hub activity together", descJp: "ファミリーハブのアクティビティを一緒に完了", icon: "👨‍👩‍👧", xp: 100, check: (u) => (u.familyHubCompleted ?? 0) >= 1 },
  { id: "family_5day",       category: "family", title: "5-Day Journey",    titleJp: "5日間の旅",       desc: "Reach a 5-day streak",             descJp: "5日連続ストリーク達成",     icon: "🔥", xp: 150, check: (u) => (u.streak ?? 0) >= 5 },
  { id: "family_10_attempts", category: "family", title: "10 Speaking Attempts", titleJp: "10回のスピーキング挑戦", desc: "Complete 5 speaking-focused activities", descJp: "スピーキング活動を5回完了", icon: "💬", xp: 250, check: (u) => (u.familyTalkCompleted ?? 0) >= 5 },
];

const CATEGORIES = [
  { id: "all",        label: "All",        labelJp: "すべて" },
  { id: "streak",     label: "Streaks",    labelJp: "ストリーク" },
  { id: "xp",         label: "XP",         labelJp: "XP" },
  { id: "confidence", label: "Confidence", labelJp: "自信度" },
  { id: "apps",       label: "Apps",       labelJp: "アプリ" },
  { id: "lessons",    label: "Lessons",    labelJp: "レッスン" },
  { id: "special",    label: "Special",    labelJp: "スペシャル" },
  { id: "family",     label: "Family",     labelJp: "ファミリー" },
];

const CAT_COLOR = {
  streak: COLORS.red, xp: COLORS.gold, confidence: "#4488ff",
  apps: COLORS.success, lessons: "#7B5EA7", special: "#ff6b35", family: "#e0559c",
};

export default function Achievements({ user, variant = "default" }) {
  const { lang, t } = useLang();
  const [filter, setFilter] = useState("all");
  const u = user ?? {};

  const earned = ACHIEVEMENTS.filter((a) => a.check(u));
  const locked = ACHIEVEMENTS.filter((a) => !a.check(u));
  const visible = (list) => filter === "all" ? list : list.filter((a) => a.category === filter);
  const totalXP = earned.reduce((s, a) => s + a.xp, 0);
  const pct     = Math.round((earned.length / ACHIEVEMENTS.length) * 100);

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label={t("badges_earned")} value={`${earned.length} / ${ACHIEVEMENTS.length}`} color={COLORS.gold}    variant={variant} />
        <StatCard label={t("bonus_xp")}      value={`+${totalXP.toLocaleString()}`}              color={COLORS.red}     variant={variant} />
        <StatCard label={t("completion")}    value={`${pct}%`}                                   color={COLORS.success} variant={variant} />
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 6, background: variant === "family" ? "#f0e4ea" : "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${COLORS.red}, ${COLORS.gold})`, borderRadius: 3, transition: "width 1s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: variant === "family" ? "#8a7a8a" : COLORS.textDim, marginTop: 4 }}>{t("lb_achievements_unlocked_of").replace("{n}", earned.length).replace("{total}", ACHIEVEMENTS.length)}</div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {CATEGORIES.map((c) => {
          const active = filter === c.id;
          const color  = CAT_COLOR[c.id] ?? COLORS.red;
          return (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 400,
              background: active ? color : "transparent",
              border: `1px solid ${active ? color : (variant === "family" ? "#e5d5dd" : "#2a2a2a")}`,
              color: active ? "#fff" : (variant === "family" ? "#8a7a8a" : COLORS.textMuted),
              cursor: "pointer", transition: "all 0.15s",
            }}>{lang === "jp" ? c.labelJp : c.label}</button>
          );
        })}
      </div>

      {/* Earned */}
      {visible(earned).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.success, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            ✓ {t("earned")} ({visible(earned).length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 10 }}>
            {visible(earned).map((a) => <Badge key={a.id} a={a} earned lang={lang} variant={variant} />)}
          </div>
        </div>
      )}

      {/* Locked */}
      {visible(locked).length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            {t("locked_badge")} ({visible(locked).length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 10 }}>
            {visible(locked).map((a) => <Badge key={a.id} a={a} earned={false} lang={lang} variant={variant} />)}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fam-badge-pop{0%{transform:scale(0.85);filter:saturate(0.4)}60%{transform:scale(1.06);filter:saturate(1.3)}100%{transform:scale(1);filter:saturate(1)}}
        .fam-ach-earned .fam-ach-visual{animation:fam-badge-pop 0.5s ease}
        @media (prefers-reduced-motion: reduce){.fam-ach-earned .fam-ach-visual{animation:none}}
      `}</style>
    </div>
  );
}

// Category-based CSS fallback for achievements outside the supplied badge
// set (item: "restrained category-based fallback ... without generating new
// artwork or displaying emojis"). A colored stencil ring + monogram, not an
// icon font/emoji.
function CategoryFallbackBadge({ category, earned, color }) {
  const letter = (category || "?").charAt(0).toUpperCase();
  return (
    <div style={{
      width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
      background: earned ? `radial-gradient(circle at 35% 30%, ${color}55, ${color}22 70%)` : "#eee",
      border: `3px solid ${earned ? color : "#ccc"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      filter: earned ? "none" : "grayscale(1)",
    }}>
      <span style={{ fontSize: 22, fontWeight: 900, color: earned ? color : "#999", fontFamily: "'Arial Black', sans-serif" }}>{letter}</span>
    </div>
  );
}

function Badge({ a, earned, lang, variant = "default" }) {
  const color = CAT_COLOR[a.category] ?? COLORS.red;

  if (variant === "family") {
    const badgeImage = FAMILY_BADGE_IMAGE[a.id];
    return (
      <div className={`fam-badge-frame ${earned ? "fam-ach-earned fam-badge-earned" : "fam-badge-locked"}`} style={{
        background: earned ? `${color}0d` : "#faf7f5",
        border: `2px solid ${earned ? color + "55" : "#eee"}`,
        borderRadius: 16, padding: "14px 14px 16px", textAlign: "center",
      }}>
        {!earned && <div className="fam-badge-overlay" />}
        <div className="fam-ach-visual" style={{ marginBottom: 8, position: "relative" }}>
          {badgeImage ? (
            <img
              className="fam-badge-img"
              src={badgeImage}
              alt=""
              width={72} height={72} loading="lazy"
              style={{ width: 72, height: 72, objectFit: "contain", margin: "0 auto", display: "block" }}
            />
          ) : (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <CategoryFallbackBadge category={a.category} earned={earned} color={color} />
            </div>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: earned ? "#3a2a3a" : "#8a7a8a", marginBottom: 3, position: "relative" }}>{lang === "jp" ? a.titleJp : a.title}</div>
        <div style={{ fontSize: 11, color: "#8a7a8a", marginBottom: 8, lineHeight: 1.4, position: "relative" }}>{lang === "jp" ? a.descJp : a.desc}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: earned ? color : "#bbb", position: "relative" }}>+{a.xp} XP</div>
      </div>
    );
  }

  return (
    <div style={{
      background: earned ? `${color}0d` : COLORS.card,
      border: `1px solid ${earned ? color + "44" : "#1e1e1e"}`,
      borderRadius: 12, padding: "14px 16px",
      opacity: earned ? 1 : 0.45, transition: "all 0.2s",
    }}>
      <div style={{ fontSize: 30, marginBottom: 8, filter: earned ? "none" : "grayscale(1) brightness(0.5)" }}>{a.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: earned ? COLORS.text : COLORS.textMuted, marginBottom: 3 }}>{lang === "jp" ? a.titleJp : a.title}</div>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, lineHeight: 1.4 }}>{lang === "jp" ? a.descJp : a.desc}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: earned ? color : "#333" }}>+{a.xp} XP</div>
    </div>
  );
}

function StatCard({ label, value, color, variant = "default" }) {
  if (variant === "family") {
    return (
      <div style={{
        position: "relative", overflow: "hidden",
        background: `radial-gradient(circle at 20% 15%, ${color}22, transparent 55%), #fff`,
        border: `2px solid ${color}33`, borderRadius: 16, padding: "16px 16px 18px",
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
        <div style={{ fontSize: 11, color: "#8a7a8a", marginTop: 3, fontWeight: 600 }}>{label}</div>
      </div>
    );
  }
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>{label}</div>
    </div>
  );
}
