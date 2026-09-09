import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { useLang } from "../../hooks/useLang";
import { getTodaysRecommendation } from "../home/recommendation";

const SAMPLE_ARTIFACTS = [
  { name: "Golden Key", img: "/assets/achievements/golden-key.jpg" },
  { name: "Compass",    img: "/assets/achievements/compass.jpg" },
  { name: "Star",       img: "/assets/achievements/star.jpg" },
];

// Rebuild prompt section 9 — World landing page template, for `launch:
// "internal"` Worlds (hero + journey, all inside the HSDOS shell). External
// and modal Worlds use WorldLaunch.jsx instead.
export default function WorldLanding({ world, user }) {
  const navigate = useNavigate();
  const { t } = useLang();
  const { lesson } = getTodaysRecommendation(user || {});

  return (
    <div>
      <div style={{
        position: "relative", borderRadius: TOKENS.radius.xl, overflow: "hidden", minHeight: 320,
        border: `1px solid ${TOKENS.color.border}`, boxShadow: TOKENS.shadow.soft,
        display: "flex", alignItems: "flex-end", marginBottom: TOKENS.space[6],
      }}>
        {world.artStatus === "missing" ? (
          <div style={{ position: "absolute", inset: 0, background: TOKENS.color.surfaceRaised, display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.color.textDim, fontSize: TOKENS.font.size.xs }}>
            ART MISSING — placeholder
          </div>
        ) : (
          <img src={world.art.hero} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(5,6,8,0.94) 0%, rgba(5,6,8,0.5) 55%, rgba(5,6,8,0.15) 100%)" }} />

        <div style={{ position: "relative", padding: TOKENS.space[6], width: "100%" }}>
          <h1 style={{ fontSize: TOKENS.font.size["3xl"], fontWeight: 800, marginBottom: 8 }}>{world.name}</h1>
          <p style={{ color: TOKENS.color.textMuted, maxWidth: 460, marginBottom: 20, lineHeight: 1.5 }}>{world.promise}</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={() => navigate(world.route)}
              style={{ padding: "12px 28px", borderRadius: TOKENS.radius.pill, border: "none", background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, cursor: "pointer" }}
            >
              {t("lb_begin")}
            </button>
            <a href="#journey" style={{ padding: "12px 20px", borderRadius: TOKENS.radius.pill, border: `1px solid ${TOKENS.color.border}`, color: TOKENS.color.starlight, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center" }}>
              {t("lb_view_journey")}
            </a>
          </div>
        </div>
      </div>

      <div id="journey" style={{ display: "grid", gap: TOKENS.space[5], gridTemplateColumns: "2fr 1fr" }}>
        <div>
          <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>{t("lb_current_mission_label")}</div>
          <div style={{ padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised, marginBottom: TOKENS.space[5] }}>
            {lesson}
          </div>

          <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>{t("lb_next_milestones")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: TOKENS.space[5] }}>
            {[t("lb_milestone_1"), t("lb_milestone_2"), t("lb_milestone_3")].map((m, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: TOKENS.radius.md, border: `1px solid ${TOKENS.color.border}` }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", border: `1px solid ${TOKENS.color.goldDim}`, flexShrink: 0 }} />
                <span style={{ fontSize: TOKENS.font.size.sm }}>{m}</span>
              </div>
            ))}
          </div>

          <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>{t("lb_recent_activity")}</div>
          <div style={{ fontSize: TOKENS.font.size.sm, color: TOKENS.color.textMuted }}>{t("lb_no_recent_activity")}</div>
        </div>

        <div>
          <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>{t("lb_sample_artifacts")}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: TOKENS.space[5] }}>
            {SAMPLE_ARTIFACTS.map(a => (
              <img key={a.name} src={a.img} alt={a.name} title={a.name} style={{ width: 56, height: 56, borderRadius: TOKENS.radius.md, objectFit: "cover", border: `1px solid ${TOKENS.color.border}` }} />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: TOKENS.space[3], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.goldDim}`, background: "rgba(201,168,76,0.06)" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", position: "relative", flexShrink: 0, border: `1px solid ${TOKENS.color.goldDim}` }}>
              <img src="/assets/jona/pose-encouraging.png" alt="" style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", width: 48, height: "auto" }} />
            </div>
            <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>
              {t("lb_jona_says").replace("{msg}", lesson)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
