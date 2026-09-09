// HSD Family Home (Phase 3, item 5-6). The real Family experience —
// Hear/See/Do/Talk/Create as visually prominent primary actions (not a
// sidebar), plus "Continue Your Journey" answering "what should I do next".
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS, CATEGORY_STYLE } from "./theme";
import { getActivityProgress, getRecommendedActivity, getLastActivity } from "./familyProgress";
import { logPathwayEvent, PATHWAY_EVENTS } from "../lib/pathwayAnalytics";
import { SELF_PROFILE_ID } from "../lib/profiles";
import FamilyLoading from "./FamilyLoading";

const MAIN_CATEGORIES = ["hear", "see", "do", "talk", "create"];

export default function FamilyHome() {
  const { user, currentProfile } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;
  const ageBand = currentProfile?.ageBand ?? "elementary";

  useEffect(() => {
    if (!user?.uid) return;
    getActivityProgress(user.uid, profileId).then(setProgress).catch(() => setProgress({}));
    logPathwayEvent(user.uid, "family_home_viewed", { profileId });
  }, [user?.uid, profileId]);

  if (!user || progress === null) return <FamilyLoading />;

  const recommended = getRecommendedActivity(progress, ageBand);
  const last = getLastActivity(progress);

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: FAMILY_COLORS.card, borderBottom: `2px solid ${FAMILY_COLORS.border}` }}>
        <button onClick={() => navigate("/choose-path")} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
          {t("path_switch_pathway")}
        </button>
        <div style={{ fontSize: 16, fontWeight: 900, color: FAMILY_COLORS.pink }}>HSD Family</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: FAMILY_COLORS.text, fontWeight: 700 }}>👋 {currentProfile?.name ?? ""}</span>
          {/* Parent mode stays a distinct, separate view (item 3) — never
              blended into the child-facing screens above. */}
          <button onClick={() => navigate("/family/parent")} style={{ background: "none", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 10, padding: "4px 10px", fontSize: 12, fontWeight: 700, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
            👤 {t("fam_parent_mode")}
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
        {/* Continue Your Journey — item 6, never leave "what's next" empty */}
        <section style={{
          background: `linear-gradient(135deg, ${FAMILY_COLORS.pinkSoft}, #fff)`,
          border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 24, padding: 20, marginBottom: 28,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
        }}>
          <img src="/assets/hsd/family/characters/family-jona.webp" alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
              {t("fam_continue_journey")}
            </div>
            {last && (
              <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, marginBottom: 4 }}>
                {t("fam_last_activity")}: {last.icon} {last.title}
              </div>
            )}
            <div style={{ fontSize: 17, fontWeight: 800, color: FAMILY_COLORS.text }}>
              {recommended ? `${recommended.icon} ${recommended.title}` : "🎉 All caught up!"}
            </div>
          </div>
          {recommended && (
            <button
              onClick={() => navigate(`/family/activity/${recommended.activityId}`)}
              style={{ padding: "12px 24px", borderRadius: 16, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
            >
              {t("fam_start")} →
            </button>
          )}
        </section>

        {/* Main actions — visually prominent, not a sidebar (item 5) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16, marginBottom: 28 }}>
          {MAIN_CATEGORIES.map(cat => {
            const style = CATEGORY_STYLE[cat];
            return (
              <button
                key={cat}
                onClick={() => navigate(`/family/${cat}`)}
                style={{
                  background: style.soft, border: `2px solid ${style.color}33`, borderRadius: 20,
                  padding: "20px 14px", textAlign: "center", cursor: "pointer", minHeight: 130,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <span style={{ fontSize: 32 }}>{style.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: style.color }}>{t(`fam_${cat}`)}</span>
              </button>
            );
          })}
        </div>

        {/* My Journey + Family Hub */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <button onClick={() => navigate("/family/journey")} style={secondaryCardStyle}>
            <span style={{ fontSize: 24 }}>⭐</span>
            <span style={{ fontWeight: 800, color: FAMILY_COLORS.text }}>{t("fam_my_journey")}</span>
          </button>
          <button onClick={() => navigate("/family/hub")} style={secondaryCardStyle}>
            <span style={{ fontSize: 24 }}>👨‍👩‍👧</span>
            <span style={{ fontWeight: 800, color: FAMILY_COLORS.text }}>{t("fam_family_hub")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const secondaryCardStyle = {
  background: FAMILY_COLORS.card, border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18,
  padding: 18, display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
};
