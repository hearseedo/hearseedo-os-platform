import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { DEMO_LEARNING, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

export default function DemoLearning() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [practiced, setPracticed] = useState(false);
  const { category, categoryJp, question, questionJp, tip, tipJp, sampleAnswer, sampleAnswerJp, feedback, reward } = DEMO_LEARNING;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle eyebrow={pick(lang, category, categoryJp)} title={pick(lang, question, questionJp)} subtitle={pick(lang, tip, tipJp)} />

      <JonaNarrator pose="talking" text={pick(lang, JONA_SCRIPT.learning, JONA_SCRIPT_JP.learning)} />

      <Card>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: COLORS.textDim, marginBottom: 10 }}>
          {pick(lang, "Alex's answer", "Alexの回答")}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: COLORS.text, margin: 0 }}>{pick(lang, sampleAnswer, sampleAnswerJp)}</p>

        {!practiced ? (
          <button
            onClick={() => setPracticed(true)}
            style={{ marginTop: 18, padding: "10px 20px", borderRadius: 8, border: `1px solid ${COLORS.red}`, background: "transparent", color: COLORS.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
          >
            {pick(lang, "▶ Get Feedback", "▶ フィードバックを見る")}
          </button>
        ) : (
          <div style={{ marginTop: 18, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.success, marginBottom: 10 }}>
              {pick(lang, feedback.headline, feedback.headlineJp)}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: COLORS.textMuted, lineHeight: 1.8 }}>
              {(pick(lang, feedback.points, feedback.pointsJp)).map((p) => <li key={p}>{p}</li>)}
            </ul>
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <Pill label={`+${reward.xp} XP`} color={COLORS.gold} />
              <Pill label={pick(lang, `+${reward.confidenceDelta}% confidence`, `自信度 +${reward.confidenceDelta}%`)} color={COLORS.success} />
            </div>
          </div>
        )}
      </Card>

      {practiced && (
        <button
          onClick={() => navigate("/demo/progress")}
          style={{ alignSelf: "flex-start", padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          {pick(lang, "See Alex's Progress →", "Alexの成長を見る →")}
        </button>
      )}
    </div>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}22`, borderRadius: 999, padding: "4px 12px" }}>
      {label}
    </span>
  );
}
