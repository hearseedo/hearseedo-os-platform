import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { DEMO_JONA_DECISION, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

export default function DemoJonaDecision() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [revealed, setRevealed] = useState(false);
  const { reasoning, reasoningJp, recommendation } = DEMO_JONA_DECISION;

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle
        eyebrow={pick(lang, "Jona's Decision", "Jonaの決定")}
        title={pick(lang, "Jona reviews the assessment", "Jonaがアセスメントを確認")}
        subtitle={pick(
          lang,
          "Jona, the AI coach, turns Alex's result into a concrete learning path.",
          "AIコーチのJonaが、Alexの結果を具体的な学習パスへと変えます。"
        )}
      />

      <JonaNarrator pose={revealed ? "encouraging" : "thinking"} text={pick(lang, JONA_SCRIPT.jona, JONA_SCRIPT_JP.jona)} />

      {revealed && (
        <Card>
          <ul style={{ margin: "0 0 16px", paddingLeft: 18, fontSize: 13, color: COLORS.textMuted, lineHeight: 1.8 }}>
            {(pick(lang, reasoning, reasoningJp)).map((r) => <li key={r}>{r}</li>)}
          </ul>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: COLORS.red, marginBottom: 10 }}>
              {pick(lang, "Recommendation", "おすすめ")}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>{recommendation.icon}</span>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {recommendation.app} — {pick(lang, recommendation.path, recommendation.pathJp)}
              </div>
            </div>
            <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 4 }}>
              <b>{pick(lang, "First lesson:", "最初のレッスン：")}</b> {pick(lang, recommendation.lesson, recommendation.lessonJp)}
            </div>
            <div style={{ fontSize: 13, color: COLORS.text, marginBottom: 10 }}>
              <b>{pick(lang, "Challenge:", "チャレンジ：")}</b> {pick(lang, recommendation.challenge, recommendation.challengeJp)}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, fontStyle: "italic" }}>
              {pick(lang, recommendation.reason, recommendation.reasonJp)}
            </div>
          </div>
        </Card>
      )}

      {revealed && (
        <button
          onClick={() => navigate("/demo/apps")}
          style={{ alignSelf: "flex-start", padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          {pick(lang, "See the Confidence-Building Apps →", "自信を育てるアプリを見る →")}
        </button>
      )}
    </div>
  );
}
