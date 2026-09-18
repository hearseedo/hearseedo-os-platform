// HSD Family Home (Phase 3, item 5-6). The real Family experience —
// Hear/See/Do/Talk/Create as visually prominent primary actions (not a
// sidebar), plus "Continue Your Journey" answering "what should I do next".
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS, CATEGORY_STYLE } from "./theme";
import { getActivityProgress, getRecommendedActivity, getLastActivity } from "./familyProgress";
import { localizedTitle } from "./content";
import { MTAU_MIN_AGE_BANDS, getMTAULessonSummary } from "./mtauContent";
import { getMTAUBookProgress, getMTAUCurrentLesson } from "./mtauProgress";
import { logPathwayEvent, PATHWAY_EVENTS } from "../lib/pathwayAnalytics";
import { SELF_PROFILE_ID } from "../lib/profiles";
import FamilyLoading from "./FamilyLoading";
import { GraffitiStyles, spraySplash } from "./graffitiStyles";

const MAIN_CATEGORIES = ["hear", "see", "do", "talk", "create"];

export default function FamilyHome() {
  const { user, profiles, currentProfile, setActiveProfile } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  // undefined = still resolving; null = resolved with no MTAU progress at
  // all (never started) — same loading-vs-empty convention MTAUJourney.jsx
  // already uses for its own bookProgress state.
  const [mtauBookProgress, setMtauBookProgress] = useState(undefined);

  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;
  const ageBand = currentProfile?.ageBand ?? "elementary";
  const mtauAgeAppropriate = MTAU_MIN_AGE_BANDS.includes(ageBand);

  useEffect(() => {
    if (!user?.uid) return;
    getActivityProgress(user.uid, profileId).then(setProgress).catch(() => setProgress({}));
    logPathwayEvent(user.uid, "family_home_viewed", { profileId });
  }, [user?.uid, profileId]);

  useEffect(() => {
    // Reset before fetching for the (possibly new) profile — without this,
    // switching from an MTAU-eligible profile to one that isn't (or to
    // another profile before its own fetch resolves) would leave the
    // PREVIOUS profile's mtauBookProgress in state, leaking their lesson
    // into this profile's Family Home recommendation.
    setMtauBookProgress(undefined);
    if (!user?.uid || !mtauAgeAppropriate) return;
    getMTAUBookProgress(user.uid, profileId, 1).then(setMtauBookProgress).catch(() => setMtauBookProgress({}));
  }, [user?.uid, profileId, mtauAgeAppropriate]);

  if (!user || progress === null) return <FamilyLoading />;

  const recommended = getRecommendedActivity(progress, ageBand);
  const last = getLastActivity(progress);

  // Small, presentation-only extension (Summit Sprint, item 8): if this
  // profile has actually started MTAU, it takes over the "what's next"
  // hero recommendation — the underlying getRecommendedActivity engine
  // above is untouched, so every non-MTAU profile's recommendation
  // behaves exactly as before. A profile that has never opened MTAU is
  // left on the normal Hear/See/Do/Talk/Create loop, not pushed into it.
  const mtauStarted = mtauBookProgress && Object.values(mtauBookProgress).some(p => p !== null);
  const mtauCurrent = mtauStarted ? getMTAUCurrentLesson(1, mtauBookProgress) : null;
  const mtauRecommended = mtauCurrent?.available
    ? { summary: getMTAULessonSummary(1, mtauCurrent.lessonId), lessonId: mtauCurrent.lessonId, inProgress: mtauBookProgress[mtauCurrent.lessonId]?.currentStep != null }
    : null;

  return (
    <div className="fam-world-bg" style={{ minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GraffitiStyles />
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: FAMILY_COLORS.card, borderBottom: `2px solid ${FAMILY_COLORS.border}` }}>
        <button onClick={() => navigate("/choose-path")} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
          {t("path_switch_pathway")}
        </button>
        <div style={{ fontSize: 16, fontWeight: 900, color: FAMILY_COLORS.pink }}>HSD Family</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: FAMILY_COLORS.text, fontWeight: 700 }}>👋 {currentProfile?.name ?? ""}</span>
          {/* Compact EN/JP toggle — reuses the existing useLang() hook and
              its hsd-lang localStorage persistence directly; no second
              language state. Both segments render at all times so the
              current language is always visually obvious (not just a
              single "switch to X" button), and switching is a plain
              setLang() call — the whole app (this header, activity
              titles, MTAU) re-renders from the same shared context with
              no page reload. */}
          <div
            role="group"
            aria-label="Language"
            style={{ display: "flex", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 10, overflow: "hidden" }}
          >
            {["en", "jp"].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                style={{
                  background: lang === l ? FAMILY_COLORS.pink : "transparent",
                  color: lang === l ? "#fff" : FAMILY_COLORS.textMuted,
                  border: "none", padding: "4px 8px", fontSize: 11, fontWeight: 800, cursor: "pointer",
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          {/* Parent mode stays a distinct, separate view (item 3) — never
              blended into the child-facing screens above. */}
          <button onClick={() => navigate("/family/parent")} style={{ background: "none", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 10, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
            👤 {t("fam_parent_mode")}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Family profile switcher (Summit Sprint 1, item 2) — switching who
            is active must happen right here, without leaving Family Home or
            routing through Switch Pathway → Continue → Who's learning?.
            Reuses the exact same setActiveProfile() the pathway picker
            already uses — no second, competing profile-state mechanism. */}
        {profiles.length > 1 && (
          <div
            role="tablist"
            aria-label={t("fam_whos_learning")}
            style={{ display: "flex", gap: 10, overflowX: "auto", marginBottom: 20, paddingBottom: 2 }}
          >
            {profiles.map(p => {
              const isActive = p.id === profileId;
              const label = p.isVirtual ? t("fam_parent_mode") : p.name;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => { if (!isActive) setActiveProfile(p.id); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
                    padding: "6px 14px 6px 6px", borderRadius: 999,
                    border: `2px solid ${isActive ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
                    background: isActive ? FAMILY_COLORS.pinkSoft : FAMILY_COLORS.card,
                    cursor: isActive ? "default" : "pointer",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isActive ? FAMILY_COLORS.pink : FAMILY_COLORS.border,
                      color: isActive ? "#fff" : FAMILY_COLORS.textMuted,
                      fontSize: 14, fontWeight: 800,
                    }}
                  >
                    {p.isVirtual ? "👤" : (label?.[0]?.toUpperCase() ?? "?")}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: isActive ? FAMILY_COLORS.pink : FAMILY_COLORS.text }}>
                    {label}
                  </span>
                  {isActive && <span aria-hidden="true" style={{ fontSize: 12, color: FAMILY_COLORS.pink }}>✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Continue Your Journey — item 6, never leave "what's next" empty.
            family-hero.webp as the full illustrated banner background. */}
        <section
          className="fam-hero-banner"
          style={{
            backgroundImage: "url('/assets/hsd/family/backgrounds/family-hero.webp')",
            border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 24, padding: 20, marginBottom: 28,
            display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap",
            aspectRatio: "16 / 7", minHeight: 220,
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#fce8f2", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
              {t("fam_continue_journey")}
            </div>
            {!mtauRecommended && last && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 4, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                {t("fam_last_activity")}: {last.icon} {localizedTitle(last, lang)}
              </div>
            )}
            <div style={{ fontSize: 19, fontWeight: 800, color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
              {mtauRecommended
                ? `🔓 Monkeys Talk & Unlock — Lesson ${mtauRecommended.lessonId}${mtauRecommended.summary ? ` · ${mtauRecommended.summary.title}` : ""}`
                : recommended ? `${recommended.icon} ${localizedTitle(recommended, lang)}` : "🎉 All caught up!"}
            </div>
          </div>
          {mtauRecommended ? (
            <button
              onClick={() => navigate(`/family/mtau/book/1/lesson/${mtauRecommended.lessonId}`)}
              style={{ padding: "12px 24px", borderRadius: 16, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
            >
              {mtauRecommended.inProgress ? "Continue" : t("fam_start")} →
            </button>
          ) : recommended && (
            <button
              onClick={() => navigate(`/family/activity/${recommended.activityId}`)}
              style={{ padding: "12px 24px", borderRadius: 16, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0 }}
            >
              {t("fam_start")} →
            </button>
          )}
        </section>

        {/* Main actions — visually prominent, not a sidebar (item 5).
            Each character image is the primary visual, not a small icon. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 28 }}>
          {MAIN_CATEGORIES.map(cat => {
            const style = CATEGORY_STYLE[cat];
            return (
              <button
                key={cat}
                className="fam-tile"
                onClick={() => navigate(`/family/${cat}`)}
                style={{
                  background: style.soft, border: `2px solid ${style.color}33`, borderRadius: 20,
                  padding: "14px 10px 16px", textAlign: "center", cursor: "pointer", minHeight: 168,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 6,
                  ...spraySplash(style.color),
                }}
              >
                <img
                  className="fam-tile-char"
                  src={style.image}
                  alt=""
                  width={96}
                  height={96}
                  loading="lazy"
                  style={{ width: 96, height: 96, objectFit: "contain" }}
                />
                <span style={{ position: "relative", zIndex: 1, fontSize: 15, fontWeight: 800, color: style.color }}>{t(`fam_${cat}`)}</span>
              </button>
            );
          })}
        </div>

        {/* My Journey + Family Hub — graffiti badge preview / family scene thumbnail */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <button onClick={() => navigate("/family/journey")} style={secondaryCardStyle}>
            <img
              src="/assets/hsd/family/achievements/achievement-first-step.webp"
              alt=""
              width={52} height={52} loading="lazy"
              style={{ width: 52, height: 52, objectFit: "contain", flexShrink: 0 }}
            />
            <span style={{ fontWeight: 800, color: FAMILY_COLORS.text }}>{t("fam_my_journey")}</span>
          </button>
          <button onClick={() => navigate("/family/hub")} style={secondaryCardStyle}>
            <img
              src={CATEGORY_STYLE.hub.image}
              alt=""
              width={68} height={52} loading="lazy"
              style={{ width: 68, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }}
            />
            <span style={{ fontWeight: 800, color: FAMILY_COLORS.text }}>{t("fam_family_hub")}</span>
          </button>
        </div>

        {/* Monkeys Talk & Unlock entry (Summit Sprint) — visible only to an
            appropriate older learner, same ageBand-gating convention used
            elsewhere in Family. Not a security boundary, just product scoping. */}
        {MTAU_MIN_AGE_BANDS.includes(ageBand) && (
          <button
            onClick={() => navigate("/family/mtau")}
            style={{
              ...secondaryCardStyle, marginTop: 16, width: "100%",
              background: "#15151f", border: "2px solid #e0559c55", color: "#fff",
            }}
          >
            <span style={{ fontSize: 32 }}>🔓</span>
            <div>
              <div style={{ fontWeight: 800, color: "#fff" }}>Monkeys Talk &amp; Unlock</div>
              <div style={{ fontSize: 12, color: "#aaa" }}>Books 1–6 · Speaking journey</div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

const secondaryCardStyle = {
  background: FAMILY_COLORS.card, border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18,
  padding: 18, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
};
