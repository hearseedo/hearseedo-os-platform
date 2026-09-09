import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { COLORS } from "../constants/colors";
import { ALEX_PROFILE, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";
import { useVoice } from "./VoiceContext";
import { speakAsJona } from "./voice";

export default function DemoStart() {
  const navigate = useNavigate();
  const { lang } = useLang();
  const { voiceOn } = useVoice();
  const [speaking, setSpeaking] = useState(false);

  // Browsers block audio.play() that isn't triggered by a user gesture, so
  // JonaNarrator's usual autoplay-on-mount greeting is silently dropped the
  // first time anyone lands here — there's been no click yet. This button
  // click IS a real user gesture, so it's the sole trigger for this line on
  // this page (JonaNarrator below has autoPlay={false} for the same text, so
  // there is only ever one Audio object — two independent attempts at the
  // same line is what caused the overlap). Navigation waits for the line to
  // actually finish (or fires immediately if voice is off or playback fails,
  // so the demo never gets stuck on this step).
  const handleStart = () => {
    if (!voiceOn) { navigate("/demo/assessment"); return; }
    const text = pick(lang, JONA_SCRIPT.start, JONA_SCRIPT_JP.start);
    setSpeaking(true);
    speakAsJona(text, lang)
      .then((audio) => {
        audio.onended = () => { setSpeaking(false); navigate("/demo/assessment"); };
      })
      .catch(() => { setSpeaking(false); navigate("/demo/assessment"); });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px" }}>
          {pick(lang, "Welcome to HSD OS — Demo Mode", "HSD OS へようこそ — デモモード")}
        </h1>
        <p style={{ color: COLORS.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          {pick(
            lang,
            "This is a guided, pre-scripted walkthrough of the full learner journey — from first assessment to measurable progress — using a sample learner. Nothing here calls a live AI model or database, so the experience is identical every time you run it.",
            "これは、サンプル学習者を使った学習者ジャーニー全体のガイド付きデモです — 最初のアセスメントから測定可能な成長まで。ライブAIモデルやデータベースは一切呼び出さないため、何度実行しても同じ体験になります。"
          )}
        </p>
      </div>

      <JonaNarrator pose="waving" text={pick(lang, JONA_SCRIPT.start, JONA_SCRIPT_JP.start)} autoPlay={false} externalSpeaking={speaking} />

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
            }}
          >
            {ALEX_PROFILE.avatar}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{ALEX_PROFILE.name}, {ALEX_PROFILE.age}</div>
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>{pick(lang, ALEX_PROFILE.role, ALEX_PROFILE.roleJp)}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 20 }}>
          <Stat label={pick(lang, "English level", "英語レベル")} value={ALEX_PROFILE.level} />
          <Stat label={pick(lang, "Confidence", "自信度")} value={`${ALEX_PROFILE.confidenceScore}%`} />
          <Stat label={pick(lang, "Goal", "目標")} value={pick(lang, ALEX_PROFILE.goal, ALEX_PROFILE.goalJp)} />
        </div>
      </Card>

      <p style={{ color: COLORS.textDim, fontSize: 12, lineHeight: 1.6, margin: 0 }}>
        {pick(
          lang,
          "You'll follow Alex through: taking the placement assessment, watching Jona decide on a learning path, completing a real lesson, seeing measurable progress, and finally the wider toolkit that supports the journey.",
          "この後、Alexの歩みを追っていきます：プレースメントアセスメントの受講、Jonaが学習パスを決定する様子、実際のレッスンの完了、測定可能な成長、そして最後に旅を支える幅広いツール群です。"
        )}
      </p>

      <button
        onClick={handleStart}
        style={{
          alignSelf: "flex-start",
          padding: "14px 28px",
          borderRadius: 8,
          border: "none",
          background: COLORS.red,
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {pick(lang, "Start Demo →", "デモを開始 →")}
      </button>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: COLORS.textDim, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
