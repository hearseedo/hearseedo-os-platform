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

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ padding: "16px 20px", background: style.soft, borderBottom: `2px solid ${FAMILY_COLORS.border}` }}>
        <button onClick={() => navigate("/family/home")} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer", marginBottom: 8 }}>
          {t("fam_back_to_home")}
        </button>
        <div style={{ fontSize: 22, fontWeight: 900, color: style.color, display: "flex", alignItems: "center", gap: 10 }}>
          <span>{style.icon}</span> {t(`fam_${category}`)}
        </div>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "24px 20px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
          {activities.map(a => {
            const done = progress[a.activityId]?.completed;
            return (
              <button
                key={a.activityId}
                onClick={() => navigate(`/family/activity/${a.activityId}`)}
                style={{
                  background: FAMILY_COLORS.card, border: `2px solid ${done ? style.color : FAMILY_COLORS.border}`,
                  borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", position: "relative", minHeight: 120,
                }}
              >
                {done && <span style={{ position: "absolute", top: 10, right: 10, fontSize: 18 }}>✅</span>}
                <div style={{ fontSize: 28, marginBottom: 8 }}>{a.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: FAMILY_COLORS.text, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 11, color: FAMILY_COLORS.textMuted }}>{a.duration} min</div>
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
