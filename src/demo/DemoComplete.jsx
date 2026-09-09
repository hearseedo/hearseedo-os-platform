import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

// Split out of DemoProgress.jsx — that page used to render this narrator +
// closing card on the same mount as its own "progress" narrator, so both
// speakAsJona() calls fired at once and overlapped. Own page = own mount =
// only one JonaNarrator speaking at a time.
export default function DemoComplete() {
  const navigate = useNavigate();
  const { lang } = useLang();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle
        eyebrow={pick(lang, "Demo Complete", "デモ完了")}
        title={pick(lang, "That's Alex's journey", "これがAlexの journey です")}
      />

      <JonaNarrator pose="encouraging" text={pick(lang, JONA_SCRIPT.close, JONA_SCRIPT_JP.close)} />

      <Card style={{ textAlign: "center", border: `1px solid ${COLORS.red}`, background: "rgba(224,16,16,0.06)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.red, marginBottom: 8 }}>
          {pick(lang, "Demo Complete", "デモ完了")}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>
          {pick(lang, "That's the full journey — assessment to real progress.", "アセスメントから実際の成長まで — これが全体の journey です。")}
        </div>
        <p style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, margin: "0 0 20px" }}>
          {pick(
            lang,
            "Every HSD OS learner follows this same path — Jona just adapts it to their level and goal.",
            "すべてのHSD OS学習者が同じ道をたどります — Jonaがそれぞれのレベルと目標に合わせて調整するだけです。"
          )}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("/demo")}
            style={{ padding: "14px 28px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.text, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            {pick(lang, "↻ Restart the Demo", "↻ デモをもう一度")}
          </button>
          <a
            href="https://app.hsdos.ai?mode=signup"
            style={{ padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            {pick(lang, "Start Your Own Journey →", "自分の journey を始める →")}
          </a>
        </div>
      </Card>
    </div>
  );
}
