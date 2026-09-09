import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { DEMO_ECOSYSTEM, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

// Split out of DemoApps.jsx — that page used to render this narrator +
// ecosystem grid on the same mount as its own "apps" narrator, so both
// speakAsJona() calls fired at once and overlapped. Own page = own mount =
// only one JonaNarrator speaking at a time.
export default function DemoEngine() {
  const navigate = useNavigate();
  const { lang } = useLang();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle
        eyebrow={pick(lang, "One Engine", "ひとつのエンジン")}
        title={pick(lang, "One decision engine — built for every learner", "ひとつの決定エンジンが — すべての学習者のために")}
        subtitle={pick(
          lang,
          "The same engine that built Alex's path adapts to any learner.",
          "Alexのパスを作ったのと同じエンジンが、あらゆる学習者に対応します。"
        )}
      />

      <JonaNarrator pose="encouraging" text={pick(lang, JONA_SCRIPT.engine, JONA_SCRIPT_JP.engine)} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {DEMO_ECOSYSTEM.map((app) => (
          <Card key={app.id} style={{ padding: 0, overflow: "hidden" }}>
            <img src={app.image} alt={app.name} style={{ width: "100%", height: 80, objectFit: "cover", display: "block" }} />
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: COLORS.gold, marginBottom: 4 }}>
                {pick(lang, app.audience, app.audienceJp)}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{app.name}</div>
              <p style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, margin: 0 }}>{pick(lang, app.blurb, app.blurbJp)}</p>
            </div>
          </Card>
        ))}
      </div>

      <button
        onClick={() => navigate("/demo/learning")}
        style={{ alignSelf: "flex-start", padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
      >
        {pick(lang, "Start First Lesson →", "最初のレッスンを始める →")}
      </button>
    </div>
  );
}
