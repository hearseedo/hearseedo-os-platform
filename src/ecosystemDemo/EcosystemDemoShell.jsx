// HSD OS AI ecosystem demo — the new /demo, replacing the old redirect to
// the Family-only demo (2026-09-24). /family-demo itself is untouched and
// still fully reachable — it becomes the "Family" example this demo walks
// through in steps 3-5, not deleted. Same proven shell pattern as
// src/familyDemo/FamilyDemoShell.jsx, generalized: no single pathway's
// color owns this shell, so it uses a neutral dark-gold platform identity
// instead of any one pathway's accent.
import { createContext, useContext, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMobile } from "../hooks/useMobile";
import { cancelBrowserTts } from "../lib/browserNarration";

// Background fix (2026-09-24) — this shell previously had no imagery at
// all, just a flat ECO.bg fill, which looked unfinished next to
// StudentHome/AdultHome/FamilyHome's hero photos and /choose-path's
// painted-street background. Reuses the SAME approved choose-path artwork
// (not a new asset) — thematically it's the right fit, since this demo is
// effectively a guided tour of that exact "one platform, many pathways"
// concept.
const DEMO_BG = {
  desktop: "/assets/choose-path/choose-your-path-bg.webp",
  mobile:  "/assets/choose-path/choose-your-path-bg-mobile.webp",
};

export const ECO = {
  bg: "#0a0a0a",
  card: "#141414",
  border: "#2a2a2a",
  text: "#ffffff",
  textMuted: "#999999",
  gold: "#C9A84C",
};

const STEPS = [
  { path: "/eco-demo", key: "Welcome" },
  { path: "/eco-demo/journey", key: "Choose" },
  { path: "/eco-demo/discover", key: "Discover" },
  { path: "/eco-demo/meet-jona", key: "Meet Jona" },
  { path: "/eco-demo/confidence", key: "Confidence" },
  { path: "/eco-demo/connected", key: "Connected" },
];

const JourneyContext = createContext({ pathwayId: "family", setPathwayId: () => {}, voiceOn: true });
export function useJourney() {
  return useContext(JourneyContext);
}

export default function EcosystemDemoShell() {
  const [pathwayId, setPathwayId] = useState("family");
  // Step narration voice (2026-09-24, "voice needs to follow through, each
  // step") — on by default so it's felt immediately, same "core
  // interaction, not an opt-in" reasoning as GlobalJonaAssistant's own
  // voiceOn default; a mute toggle still exists for a shared/public device.
  const [voiceOn, setVoiceOn] = useState(true);
  useEffect(() => cancelBrowserTts, []); // stop narration if the whole demo unmounts (e.g. back button)
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMobile();
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.path === location.pathname));

  const goTo = (i) => { cancelBrowserTts(); navigate(STEPS[Math.min(Math.max(i, 0), STEPS.length - 1)].path); };

  return (
    <JourneyContext.Provider value={{ pathwayId, setPathwayId, voiceOn }}>
      <style>{".eco-step-nav::-webkit-scrollbar { display: none; }"}</style>
      <div
        aria-hidden="true"
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: `linear-gradient(180deg, rgba(10,10,10,0.62), rgba(10,10,10,0.90) 65%), url('${isMobile ? DEMO_BG.mobile : DEMO_BG.desktop}')`,
          backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", color: ECO.text, display: "flex", flexDirection: "column", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 10, minHeight: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `2px solid ${ECO.border}`, background: "rgba(13,13,13,0.85)", backdropFilter: "blur(6px)", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontWeight: 900, letterSpacing: 0.5, color: ECO.gold, fontSize: 16 }}>HSD OS AI</span>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => { if (voiceOn) cancelBrowserTts(); setVoiceOn((v) => !v); }}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: voiceOn ? "rgba(201,168,76,0.12)" : "transparent",
                border: `1px solid ${voiceOn ? ECO.gold : ECO.border}`, borderRadius: 20, padding: "4px 10px",
                color: voiceOn ? ECO.gold : ECO.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              {voiceOn ? "🔊" : "🔇"} Jona's voice
            </button>
            <button onClick={() => { cancelBrowserTts(); navigate("/eco-demo"); }} style={{ background: "none", border: "none", color: ECO.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Restart</button>
            <button onClick={() => { cancelBrowserTts(); navigate("/"); }} style={{ background: "none", border: "none", color: ECO.textMuted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Exit</button>
          </div>
        </header>

        <nav className="eco-step-nav" style={{ display: "flex", overflowX: "auto", gap: 6, padding: "12px 20px", borderBottom: `2px solid ${ECO.border}`, background: "rgba(13,13,13,0.85)", backdropFilter: "blur(6px)", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {STEPS.map((step, i) => {
            const active = i === currentIndex;
            const complete = i < currentIndex;
            return (
              <button key={step.path} onClick={() => goTo(i)} style={{
                display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 999,
                border: `2px solid ${active ? ECO.gold : ECO.border}`, background: active ? "rgba(201,168,76,0.12)" : "transparent",
                color: active ? ECO.gold : complete ? ECO.text : ECO.textMuted, fontSize: 12, fontWeight: active ? 800 : 600, cursor: "pointer",
              }}>
                <span style={{ width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, background: complete ? "#22c55e" : active ? ECO.gold : ECO.border, color: complete || active ? "#0a0700" : ECO.textMuted }}>
                  {complete ? "✓" : i + 1}
                </span>
                {step.key}
              </button>
            );
          })}
        </nav>

        <main style={{ flex: 1, padding: "28px 20px 110px", maxWidth: 860, margin: "0 auto", width: "100%" }}>
          <Outlet />
        </main>

        <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", borderTop: `2px solid ${ECO.border}`, background: "rgba(13,13,13,0.9)", backdropFilter: "blur(6px)", zIndex: 2 }}>
          <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} style={{ padding: "10px 18px", borderRadius: 12, border: `2px solid ${ECO.border}`, background: "transparent", color: currentIndex === 0 ? ECO.border : ECO.text, fontSize: 13, fontWeight: 700, cursor: currentIndex === 0 ? "default" : "pointer" }}>
            ← Back
          </button>
          <span style={{ fontSize: 12, color: ECO.textMuted, fontWeight: 700 }}>Step {currentIndex + 1} of {STEPS.length}</span>
          <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === STEPS.length - 1} style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: currentIndex === STEPS.length - 1 ? ECO.border : ECO.gold, color: currentIndex === STEPS.length - 1 ? ECO.textMuted : "#0a0700", fontSize: 13, fontWeight: 800, cursor: currentIndex === STEPS.length - 1 ? "default" : "pointer" }}>
            Next →
          </button>
        </footer>
      </div>
    </JourneyContext.Provider>
  );
}
