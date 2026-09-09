import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { DEMO_ASSESSMENT, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

export default function DemoAssessment() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const [step, setStep] = useState(0); // 0..questions.length-1 = questions, then "result"
  const [picked, setPicked] = useState(null);
  const { questions, result } = DEMO_ASSESSMENT;
  const showResult = step >= questions.length;

  function choose(i) {
    if (picked !== null) return;
    setPicked(i);
    setTimeout(() => {
      setPicked(null);
      setStep((s) => s + 1);
    }, 500);
  }

  if (showResult) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PageTitle
          eyebrow={pick(lang, "Assessment complete", "アセスメント完了")}
          title={pick(lang, "Alex's baseline result", "Alexのベースライン結果")}
        />
        <JonaNarrator pose="encouraging" text={pick(lang, JONA_SCRIPT.assessmentResult, JONA_SCRIPT_JP.assessmentResult)} />
        <Card>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 36, fontWeight: 800, color: COLORS.red }}>{result.cefr}</span>
            <span style={{ fontSize: 14, color: COLORS.textMuted }}>
              {pick(lang, result.cefrName, result.cefrNameJp)} · {result.score}% {pick(lang, "confidence", "自信度")}
            </span>
          </div>
          <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
            {pick(lang, result.encouragement, result.encouragementJp)}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.success, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                {pick(lang, "Strengths", "強み")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: COLORS.text, lineHeight: 1.8 }}>
                {(pick(lang, result.strengths, result.strengthsJp)).map((s) => <li key={s}>{s}</li>)}
              </ul>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gold, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                {pick(lang, "Growth areas", "成長ポイント")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: COLORS.text, lineHeight: 1.8 }}>
                {(pick(lang, result.gaps, result.gapsJp)).map((g) => <li key={g}>{g}</li>)}
              </ul>
            </div>
          </div>
        </Card>
        <button
          onClick={() => navigate("/demo/jona")}
          style={{ alignSelf: "flex-start", padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          {pick(lang, "See Jona's Decision →", "Jonaの決定を見る →")}
        </button>
      </div>
    );
  }

  const q = questions[step];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle
        eyebrow={pick(lang, `Question ${step + 1} of ${questions.length}`, `質問 ${step + 1} / ${questions.length}`)}
        title={pick(lang, "Placement Assessment", "プレースメントアセスメント")}
        subtitle={pick(
          lang,
          "Alex answers a few quick questions so we can find the right starting point.",
          "Alexがいくつかの質問に答え、最適なスタート地点を見つけます。"
        )}
      />
      {step === 0 && <JonaNarrator pose="listening" text={pick(lang, JONA_SCRIPT.assessment, JONA_SCRIPT_JP.assessment)} />}
      <Card>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 18 }}>{pick(lang, q.prompt, q.promptJp)}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(pick(lang, q.options, q.optionsJp)).map((opt, i) => {
            const isPicked = picked === i;
            const isCorrect = picked !== null && i === q.correctIndex;
            return (
              <button
                key={opt}
                onClick={() => choose(i)}
                style={{
                  textAlign: "left",
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: `1px solid ${isCorrect ? COLORS.success : isPicked ? COLORS.red : COLORS.border}`,
                  background: isCorrect ? "rgba(34,197,94,0.1)" : COLORS.surface,
                  color: COLORS.text,
                  fontSize: 14,
                  cursor: picked === null ? "pointer" : "default",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
