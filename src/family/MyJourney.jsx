// Child-friendly progress view (item 7). Reuses the EXISTING Achievements
// component/architecture (item 7: "do not create a second competing
// progress system") — just passes the current PROFILE (self or child)
// instead of the raw account, and adds a simple category-completion summary
// on top, distinguishing participation/attempts from raw accuracy (item 21).
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FAMILY_COLORS, CATEGORY_STYLE } from "./theme";
import { getActivityProgress, getCompletionStats } from "./familyProgress";
import { SELF_PROFILE_ID } from "../lib/profiles";
import Achievements from "../components/Achievements";
import FamilyLoading from "./FamilyLoading";
import { CATEGORIES } from "./content";

export default function MyJourney() {
  const { user, currentProfile } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);

  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;

  useEffect(() => {
    if (!user?.uid) return;
    getActivityProgress(user.uid, profileId).then(setProgress).catch(() => setProgress({}));
  }, [user?.uid, profileId]);

  if (!user || progress === null) return <FamilyLoading />;

  const stats = getCompletionStats(progress);
  // Reuse the same Achievements component/checks — pass the current
  // profile merged with the family* counters it reads, not a parallel object.
  const achievementUser = { ...currentProfile, streak: user.streak ?? 0 };

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ padding: "16px 20px" }}>
        <button onClick={() => navigate("/family/home")} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
          {t("fam_back_to_home")}
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: FAMILY_COLORS.pink, marginTop: 8 }}>⭐ {t("fam_my_journey")}</h1>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 60px" }}>
        {/* Participation, not just accuracy (item 21) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
          {CATEGORIES.filter(c => c !== "hub").map(cat => {
            const style = CATEGORY_STYLE[cat];
            const s = stats[cat];
            return (
              <div key={cat} style={{ background: style.soft, border: `2px solid ${style.color}33`, borderRadius: 16, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{style.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: style.color }}>{t(`fam_${cat}`)}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: FAMILY_COLORS.text }}>{s.done}/{s.total}</div>
              </div>
            );
          })}
        </div>

        <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 20, padding: 20 }}>
          <Achievements user={achievementUser} />
        </div>
      </div>
    </div>
  );
}
