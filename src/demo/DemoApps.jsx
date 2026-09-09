import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { DEMO_APPS, JONA_SCRIPT, JONA_SCRIPT_JP } from "./data";
import { Card, PageTitle } from "./components";
import JonaNarrator from "./JonaNarrator";
import { useLang } from "../hooks/useLang";
import { pick } from "./i18n";

export default function DemoApps() {
  const navigate = useNavigate();
  const { lang } = useLang();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageTitle
        eyebrow={pick(lang, "The wider toolkit", "幅広いツール群")}
        title={pick(lang, "Apps that build Alex's confidence", "Alexの自信を育てるアプリ")}
        subtitle={pick(
          lang,
          "Career Ready is the primary path, but Alex has the whole HSD OS ecosystem working toward the same goal.",
          "Career Readyが主な学習パスですが、HSD OSのエコシステム全体が同じゴールに向けてAlexを支えます。"
        )}
      />

      <JonaNarrator pose="talking" text={pick(lang, JONA_SCRIPT.apps, JONA_SCRIPT_JP.apps)} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {DEMO_APPS.map((app) => (
          <Card key={app.id} style={{ padding: 0, overflow: "hidden", border: app.primary ? `1px solid ${COLORS.red}` : `1px solid ${COLORS.border}` }}>
            {app.image ? (
              <img src={app.image} alt={app.name} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: 110, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, background: COLORS.surface }}>
                {app.icon}
              </div>
            )}
            <div style={{ padding: 16 }}>
              <div
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                  color: app.primary ? COLORS.red : COLORS.textDim, marginBottom: 6,
                }}
              >
                {pick(lang, app.tag, app.tagJp)}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{app.name}</div>
              <p style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, margin: "0 0 10px" }}>{pick(lang, app.blurb, app.blurbJp)}</p>
              <p style={{ fontSize: 11, color: COLORS.success, lineHeight: 1.5, margin: 0 }}>{pick(lang, app.confidenceRole, app.confidenceRoleJp)}</p>
            </div>
          </Card>
        ))}
      </div>

      <button
        onClick={() => navigate("/demo/engine")}
        style={{ alignSelf: "flex-start", padding: "14px 28px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
      >
        {pick(lang, "See the Decision Engine →", "決定エンジンを見る →")}
      </button>
    </div>
  );
}
