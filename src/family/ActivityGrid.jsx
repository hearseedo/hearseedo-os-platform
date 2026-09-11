// Category browser — one reusable component for Hear/See/Do/Talk/Create/Hub
// (item 5/8), not six separate hand-built pages.
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS, CATEGORY_STYLE } from "./theme";
import { getActivitiesByCategory } from "./content";
import { getActivityProgress } from "./familyProgress";
import { SELF_PROFILE_ID } from "../lib/profiles";
import { CATEGORIES } from "./content";
import FamilyLoading from "./FamilyLoading";
import { GraffitiStyles } from "./graffitiStyles";
import { SECTION_META, JONA_FIGURE_SRC, SectionBackground } from "./sectionBackgrounds";

export default function ActivityGrid({ category: categoryProp }) {
  const params = useParams();
  const category = categoryProp ?? params.category;
  const { user, currentProfile } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;
  const ageBand = currentProfile?.ageBand ?? null;

  useEffect(() => {
    if (!user?.uid) return;
    getActivityProgress(user.uid, profileId).then(setProgress).catch(() => setProgress({}));
  }, [user?.uid, profileId]);

  if (!user || progress === null) return <FamilyLoading />;
  if (!CATEGORIES.includes(category)) return null;

  const style = CATEGORY_STYLE[category];
  const activities = getActivitiesByCategory(category, ageBand);
  const isHub = category === "hub";
  const section = SECTION_META[category]; // set for hear/see/do/talk/create only
  const isTalk = category === "talk";

  if (section) {
    return (
      <div className="fam-section" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#f3f1f8" }}>
        <SectionBackground category={category} />
        {isTalk && (
          <img
            src={JONA_FIGURE_SRC}
            alt="Jona, the HSDOS learning guide"
            aria-hidden="true"
            className="fam-jona-figure"
          />
        )}

        <div className="fam-section-content">
          <header style={{ padding: "16px 20px 8px" }}>
            <button className="fam-section-back" onClick={() => navigate("/family/home")}>
              {t("fam_back_to_home")}
            </button>
            <div className="fam-section-title">
              <span>{style.icon}</span> {t(`fam_${category}`)}
            </div>
          </header>

          <div style={{ maxWidth: 1180, margin: "0 auto", padding: "16px 20px 60px" }}>
            <div className="fam-section-grid">
              {activities.map(a => {
                const done = progress[a.activityId]?.completed;
                return (
                  <button
                    key={a.activityId}
                    className="fam-section-card"
                    onClick={() => navigate(`/family/activity/${a.activityId}`)}
                    style={{ border: `1.5px solid ${done ? style.color : style.color + "55"}` }}
                  >
                    {done && <span style={{ position: "absolute", top: 10, right: 10, fontSize: 18, zIndex: 2 }}>✅</span>}
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{a.icon}</div>
                    <div className="fam-section-card-title">{a.title}</div>
                    <div className="fam-section-card-meta">{a.duration} min</div>
                  </button>
                );
              })}
              {activities.length === 0 && (
                <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
                  More {t(`fam_${category}`)} activities coming soon!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={isHub ? "fam-world-bg" : undefined} style={{ minHeight: "100vh", background: isHub ? undefined : FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {isHub && <GraffitiStyles />}
      <header style={{ padding: "16px 20px", background: isHub ? "transparent" : style.soft, borderBottom: `2px solid ${FAMILY_COLORS.border}` }}>
        <button onClick={() => navigate("/family/home")} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer", marginBottom: 8 }}>
          {t("fam_back_to_home")}
        </button>
        <div style={{ fontSize: 22, fontWeight: 900, color: style.color, display: "flex", alignItems: "center", gap: 10 }}>
          <span>{style.icon}</span> {t(`fam_${category}`)}
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div
          className={isHub ? "fam-hub-grid" : undefined}
          style={isHub ? undefined : { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}
        >
          {activities.map(a => {
            const done = progress[a.activityId]?.completed;
            const imageUrl = isHub ? a.media?.imageUrl : null;
            return (
              <button
                key={a.activityId}
                className={isHub ? "fam-hub-card" : undefined}
                onClick={() => navigate(`/family/activity/${a.activityId}`)}
                style={{
                  background: FAMILY_COLORS.card, border: `2px solid ${done ? style.color : FAMILY_COLORS.border}`,
                  borderRadius: 18, textAlign: "left", cursor: "pointer", position: "relative",
                  minHeight: imageUrl ? "auto" : 120,
                  padding: imageUrl ? 0 : 16,
                  overflow: imageUrl ? "hidden" : "visible",
                }}
              >
                {done && <span style={{ position: "absolute", top: 10, right: 10, fontSize: 18, zIndex: 2 }}>✅</span>}
                {imageUrl ? (
                  <>
                    <img
                      className="fam-hub-card-img"
                      src={imageUrl}
                      alt=""
                      width={640} height={360}
                      loading="lazy"
                      style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", objectPosition: "center 40%" }}
                    />
                    <div className="fam-underline" style={{ padding: "14px 16px 16px", color: style.color }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: FAMILY_COLORS.text, marginBottom: 4 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: FAMILY_COLORS.textMuted }}>{a.duration} min</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{a.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: FAMILY_COLORS.text, marginBottom: 4 }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: FAMILY_COLORS.textMuted }}>{a.duration} min</div>
                  </>
                )}
              </button>
            );
          })}
          {activities.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: FAMILY_COLORS.textMuted, fontSize: 14 }}>
              More {t(`fam_${category}`)} activities coming soon!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
