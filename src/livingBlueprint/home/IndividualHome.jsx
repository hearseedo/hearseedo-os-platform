import { TOKENS } from "../../constants/tokens";
import { confidenceLabel } from "../../lib/confidenceEngine";
import MissionHero from "../components/MissionHero";
import MetricCard from "../components/MetricCard";
import { getTodaysRecommendation } from "./recommendation";

function timeAwareGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Rebuild prompt section 6 — Individual Home: header, Today's Mission hero,
// daily metrics, and at most three recommended next actions.
export default function IndividualHome({ user }) {
  const firstName = user?.name?.split(" ")[0] || "there";
  const { world, lesson, challenge } = getTodaysRecommendation(user || {});

  const nextActions = [
    { id: "continue", label: `Continue ${world.name}`, detail: lesson, icon: "▶" },
    { id: "jona",      label: "Jona recommends", detail: challenge, icon: "jona" },
    { id: "goal",      label: "Set this week's goal", detail: "Not set yet — Progress will track it here.", icon: "◈" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: TOKENS.space[5] }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: TOKENS.color.surfaceRaised, border: `1px solid ${TOKENS.color.border}`, fontWeight: 800, fontSize: TOKENS.font.size.lg,
          }}>
            {firstName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>{timeAwareGreeting()}</div>
            <div style={{ fontSize: TOKENS.font.size.lg, fontWeight: 800 }}>{firstName}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: TOKENS.font.size.lg, fontWeight: 800, color: TOKENS.color.gold }}>{user?.xpEarned ?? 0}</div>
            <div style={{ fontSize: 10, color: TOKENS.color.textDim }}>HSD Points</div>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${TOKENS.color.border}`, color: TOKENS.color.textMuted,
          }}>
            ▣
          </div>
        </div>
      </div>

      <MissionHero world={world} missionName={lesson} />

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <MetricCard label="Streak" value={`${user?.streak ?? 0} days`} />
        <MetricCard label="Progress" value={`${user?.lessonsCompleted ?? 0} lessons`} sub={`${user?.hoursLearned ?? 0} hrs learned`} />
        <MetricCard label="Confidence" value={`${user?.confidenceScore ?? 0}%`} sub={confidenceLabel(user?.confidenceScore ?? 0)} />
      </div>

      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>NEXT UP</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {nextActions.map(action => (
          <div key={action.id} style={{
            display: "flex", alignItems: "center", gap: 14, padding: 14,
            borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised,
          }}>
            {action.icon === "jona" ? (
              <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", position: "relative", flexShrink: 0, border: `1px solid ${TOKENS.color.goldDim}` }}>
                <img src="/assets/jona/pose-pointing.png" alt="" style={{ position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)", width: 48, height: "auto" }} />
              </div>
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: TOKENS.color.gold, border: `1px solid ${TOKENS.color.border}`, flexShrink: 0 }}>
                {action.icon}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: TOKENS.font.size.sm }}>{action.label}</div>
              <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>{action.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
