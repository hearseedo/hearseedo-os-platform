import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { VoiceProvider, useVoice } from "./VoiceContext";
import { useLang } from "../hooks/useLang";
import { ui } from "./i18n";

const STEPS = [
  { path: "/demo", key: "start" },
  { path: "/demo/assessment", key: "assessment" },
  { path: "/demo/jona", key: "jonaDecision" },
  { path: "/demo/apps", key: "confidenceApps" },
  { path: "/demo/engine", key: "oneEngine" },
  { path: "/demo/learning", key: "learning" },
  { path: "/demo/progress", key: "progress" },
  { path: "/demo/complete", key: "close" },
];

export default function DemoShell() {
  return (
    <VoiceProvider>
      <DemoShellInner />
    </VoiceProvider>
  );
}

function DemoShellInner() {
  const { voiceOn, toggleVoice } = useVoice();
  const { lang, setLang } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.path === location.pathname));

  const goTo = (i) => navigate(STEPS[Math.min(Math.max(i, 0), STEPS.length - 1)].path);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, letterSpacing: 1 }}>HSD OS</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: COLORS.red,
              border: `1px solid ${COLORS.red}`,
              borderRadius: 999,
              padding: "3px 8px",
            }}
          >
            {ui("demoMode", lang)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 6, overflow: "hidden" }}>
            {["en", "jp"].map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  background: lang === l ? COLORS.red : "transparent",
                  border: "none",
                  color: lang === l ? "#fff" : COLORS.textMuted,
                  cursor: "pointer",
                }}
              >
                {l === "en" ? "EN" : "日本語"}
              </button>
            ))}
          </div>
          <button
            onClick={toggleVoice}
            title={voiceOn ? "Mute Jona" : "Unmute Jona"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: `1px solid ${voiceOn ? COLORS.red : COLORS.border}`,
              borderRadius: 999,
              padding: "4px 10px",
              color: voiceOn ? COLORS.red : COLORS.textMuted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {voiceOn ? `🔊 ${ui("voiceOn", lang)}` : `🔇 ${ui("voiceOff", lang)}`}
          </button>
          <button
            onClick={() => navigate("/demo")}
            style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}
          >
            {ui("restartDemo", lang)}
          </button>
          <button
            onClick={() => navigate("/")}
            style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}
          >
            {ui("exitDemo", lang)}
          </button>
        </div>
      </header>

      <nav
        style={{
          display: "flex",
          overflowX: "auto",
          gap: 4,
          padding: "12px 20px",
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.bg,
        }}
      >
        {STEPS.map((step, i) => {
          const active = i === currentIndex;
          const complete = i < currentIndex;
          return (
            <button
              key={step.path}
              onClick={() => goTo(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? COLORS.red : COLORS.border}`,
                background: active ? COLORS.redGlow : "transparent",
                color: active ? COLORS.text : complete ? COLORS.textMuted : COLORS.textDim,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  background: complete ? COLORS.success : active ? COLORS.red : COLORS.card,
                  color: complete || active ? "#fff" : COLORS.textDim,
                }}
              >
                {complete ? "✓" : i + 1}
              </span>
              {ui(step.key, lang)}
            </button>
          );
        })}
      </nav>

      <main style={{ flex: 1, padding: "24px 20px 100px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
        <Outlet />
      </main>

      <footer
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
        }}
      >
        <button
          onClick={() => goTo(currentIndex - 1)}
          disabled={currentIndex === 0}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: `1px solid ${COLORS.border}`,
            background: "transparent",
            color: currentIndex === 0 ? COLORS.textDim : COLORS.text,
            fontSize: 13,
            fontWeight: 600,
            cursor: currentIndex === 0 ? "default" : "pointer",
          }}
        >
          {ui("back", lang)}
        </button>
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>
          {ui("stepOf", lang).replace("{n}", currentIndex + 1).replace("{total}", STEPS.length)}
        </span>
        <button
          onClick={() => goTo(currentIndex + 1)}
          disabled={currentIndex === STEPS.length - 1}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: currentIndex === STEPS.length - 1 ? COLORS.card : COLORS.red,
            color: currentIndex === STEPS.length - 1 ? COLORS.textDim : "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: currentIndex === STEPS.length - 1 ? "default" : "pointer",
          }}
        >
          {ui("next", lang)}
        </button>
      </footer>
    </div>
  );
}
