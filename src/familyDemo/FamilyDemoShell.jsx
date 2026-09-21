// HSD Family Demo — a scripted, no-auth walkthrough of the HSD Family
// pathway. Visually distinct from (and replaces) the old XPRIZE-era
// Confidence Adult demo: bright/rounded Family identity (src/family/theme.js)
// instead of the dark Confidence look, and a family storyline instead of
// an adult job-interview storyline.
//
// Runs entirely on scripted data (src/familyDemo/data.js) — no Gemini,
// Firestore, Stripe, or ElevenLabs calls anywhere in this feature.
import { createContext, useContext, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { FAMILY_COLORS } from "../family/theme";

const STEPS = [
  { path: "/family-demo", key: "Welcome" },
  { path: "/family-demo/home", key: "Family Home" },
  { path: "/family-demo/ask-jona", key: "Ask Jona" },
  { path: "/family-demo/activity", key: "Lesson" },
  { path: "/family-demo/confidence", key: "Check-in" },
  { path: "/family-demo/progress", key: "Progress" },
  { path: "/family-demo/programs", key: "Programs" },
  { path: "/family-demo/complete", key: "Done" },
];

const VoiceContext = createContext({ voiceOn: false, toggleVoice: () => {} });
export function useVoice() {
  return useContext(VoiceContext);
}

export default function FamilyDemoShell() {
  const [voiceOn, setVoiceOn] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.path === location.pathname));

  const goTo = (i) => navigate(STEPS[Math.min(Math.max(i, 0), STEPS.length - 1)].path);

  return (
    <VoiceContext.Provider value={{ voiceOn, toggleVoice: () => setVoiceOn((v) => !v) }}>
      <style>{".family-demo-step-nav::-webkit-scrollbar { display: none; }"}</style>
      <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, color: FAMILY_COLORS.text, display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <header
          style={{
            position: "sticky", top: 0, zIndex: 10, minHeight: 60,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 20px", borderBottom: `2px solid ${FAMILY_COLORS.border}`,
            background: FAMILY_COLORS.card, flexWrap: "wrap", gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 900, letterSpacing: 0.5, color: FAMILY_COLORS.pink, fontSize: 16 }}>HSD Family</span>
            <span
              style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: FAMILY_COLORS.pink, border: `2px solid ${FAMILY_COLORS.pink}`, borderRadius: 999, padding: "3px 8px",
              }}
            >
              Demo Mode
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => setVoiceOn((v) => !v)}
              title={voiceOn ? "Mute Jona" : "Unmute Jona"}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "none",
                border: `2px solid ${voiceOn ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`, borderRadius: 999,
                padding: "5px 12px", color: voiceOn ? FAMILY_COLORS.pink : FAMILY_COLORS.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {voiceOn ? "🔊 Jona's voice on" : "🔇 Jona's voice off"}
            </button>
            <button onClick={() => navigate("/family-demo")} style={{ background: "none", border: "none", color: FAMILY_COLORS.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Restart Demo
            </button>
            <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: FAMILY_COLORS.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Exit Demo
            </button>
          </div>
        </header>

        <nav
          className="family-demo-step-nav"
          style={{ display: "flex", overflowX: "auto", gap: 6, padding: "12px 20px", borderBottom: `2px solid ${FAMILY_COLORS.border}`, background: FAMILY_COLORS.bg, scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {STEPS.map((step, i) => {
            const active = i === currentIndex;
            const complete = i < currentIndex;
            return (
              <button
                key={step.path}
                onClick={() => goTo(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  padding: "6px 12px", borderRadius: 999,
                  border: `2px solid ${active ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
                  background: active ? FAMILY_COLORS.pinkSoft : "#fff",
                  color: active ? FAMILY_COLORS.pink : complete ? FAMILY_COLORS.text : FAMILY_COLORS.textMuted,
                  fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer",
                }}
              >
                <span
                  style={{
                    width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, background: complete ? FAMILY_COLORS.green : active ? FAMILY_COLORS.pink : FAMILY_COLORS.border,
                    color: complete || active ? "#fff" : FAMILY_COLORS.textMuted,
                  }}
                >
                  {complete ? "✓" : i + 1}
                </span>
                {step.key}
              </button>
            );
          })}
        </nav>

        <main style={{ flex: 1, padding: "28px 20px 110px", maxWidth: 760, margin: "0 auto", width: "100%" }}>
          <Outlet />
        </main>

        <footer
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, height: 68,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 20px", borderTop: `2px solid ${FAMILY_COLORS.border}`, background: FAMILY_COLORS.card,
          }}
        >
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            style={{
              padding: "10px 18px", borderRadius: 12, border: `2px solid ${FAMILY_COLORS.border}`, background: "transparent",
              color: currentIndex === 0 ? FAMILY_COLORS.border : FAMILY_COLORS.text, fontSize: 13, fontWeight: 700,
              cursor: currentIndex === 0 ? "default" : "pointer",
            }}
          >
            ← Back
          </button>
          <span style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, fontWeight: 700 }}>
            Step {currentIndex + 1} of {STEPS.length}
          </span>
          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === STEPS.length - 1}
            style={{
              padding: "10px 18px", borderRadius: 12, border: "none",
              background: currentIndex === STEPS.length - 1 ? FAMILY_COLORS.border : FAMILY_COLORS.pink,
              color: currentIndex === STEPS.length - 1 ? FAMILY_COLORS.textMuted : "#fff", fontSize: 13, fontWeight: 800,
              cursor: currentIndex === STEPS.length - 1 ? "default" : "pointer",
            }}
          >
            Next →
          </button>
        </footer>
      </div>
    </VoiceContext.Provider>
  );
}
