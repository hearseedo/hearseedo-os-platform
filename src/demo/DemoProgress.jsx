import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { DEMO_PROGRESS, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import ConfidenceRing from "../components/ConfidenceRing";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

export default function DemoProgress() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { before, after, weeklyTrend, milestones } = DEMO_PROGRESS;
  const max = Math.max(...weeklyTrend);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle
        eyebrow={pick(lang, "Two weeks later", "2週間後")}
        title={pick(lang, "Alex's progress", "Alexの成長")}
        subtitle={pick(
          lang,
          "Same learner, same goal — measurable movement from one scripted session to the next.",
          "同じ学習者、同じ目標 — 一つのセッションから次へ、測定可能な変化が生まれます。"
        )}
      />

      <JonaNarrator pose="celebrating" text={pick(lang, JONA_SCRIPT.progress, JONA_SCRIPT_JP.progress)} />

      <Card style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            {pick(lang, "Before", "施策前")}
          </div>
          <ConfidenceRing score={before.confidence} />
        </div>
        <div style={{ fontSize: 24, color: COLORS.textDim }}>→</div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
            {pick(lang, "After", "施策後")}
          </div>
          <ConfidenceRing score={after.confidence} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 140 }}>
          <MiniStat label={pick(lang, "CEFR level", "CEFRレベル")} value={after.cefr} />
          <MiniStat label={pick(lang, "Practice streak", "連続練習日数")} value={pick(lang, `${after.streak} days`, `${after.streak}日`)} />
          <MiniStat label={pick(lang, "Hours learned", "学習時間")} value={`${after.hours}h`} />
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: COLORS.textDim, marginBottom: 14 }}>
          {pick(lang, "Confidence trend", "自信度の推移")}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
          {weeklyTrend.map((v, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: "100%",
                  height: `${(v / max) * 64}px`,
                  background: COLORS.red,
                  borderRadius: "4px 4px 0 0",
                  opacity: 0.5 + (i / weeklyTrend.length) * 0.5,
                }}
              />
              <span style={{ fontSize: 10, color: COLORS.textDim }}>{v}%</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: COLORS.textDim, marginBottom: 14 }}>
          {pick(lang, "Milestones", "マイルストーン")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {milestones.map((m) => (
            <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: m.done ? COLORS.text : COLORS.textDim }}>
              <span style={{ color: m.done ? COLORS.success : COLORS.textDim }}>{m.done ? "✓" : "○"}</span>
              {pick(lang, m.label, m.labelJp)}
            </div>
          ))}
        </div>
      </Card>

      <button
        onClick={() => navigate("/demo/complete")}
        style={{ alignSelf: "flex-start", padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
      >
        {pick(lang, "See the Full Journey →", "全体の journey を見る →")}
      </button>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
