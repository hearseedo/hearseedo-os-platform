// HSD Adults pathway home (/adult). Same idea as StudentHome — a curated
// landing page for the apps already mapped to "adult" in
// constants/pathways.js's APP_PATHWAY_MAP. Three are iframe sub-apps
// (launched exactly the way Dashboard.jsx already launches them, via the
// existing AppModal + constants/apps.js APP_MAP — not a new launch
// mechanism), one (Sip Speak Learn) is a real native page.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PATHWAYS } from "../constants/pathways";
import { APP_MAP } from "../constants/apps";
import AppModal from "../components/AppModal";

const APPS = [
  { id: "innerkey", icon: "🔑", route: null },
  { id: "sipswitch", icon: "☕", route: null },
  { id: "speak", icon: "💬", route: null },
  { id: "sip-speak-learn", name: "Sip Speak Learn", desc: "Adult conversation practice, one session at a time.", icon: "🗣️", route: "/sip-speak-learn" },
];

const pathway = PATHWAYS.adult;

export default function AdultHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedApp, setSelectedApp] = useState(null);

  function open(app) {
    if (app.route) { navigate(app.route); return; }
    const registryEntry = APP_MAP[app.id];
    if (registryEntry) setSelectedApp(registryEntry);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ padding: "20px 20px 0" }}>
        <button onClick={() => navigate("/choose-path")} style={{ background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer" }}>
          ← Switch pathway
        </button>
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 60px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: pathway.accent.primary, marginBottom: 8 }}>
          {pathway.displayName}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>{pathway.tagline}</h1>
        <p style={{ color: "#999", fontSize: 15, marginBottom: 36, maxWidth: 560 }}>{pathway.description}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {APPS.map((app) => {
            const registryEntry = APP_MAP[app.id];
            const name = app.name ?? registryEntry?.name;
            const desc = app.desc ?? registryEntry?.desc;
            return (
              <button
                key={app.id}
                onClick={() => open(app)}
                style={{
                  textAlign: "left", background: "#141414", border: `1px solid ${pathway.accent.primary}33`, borderRadius: 16,
                  padding: 22, cursor: "pointer", color: "#fff",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 12 }}>{app.icon}</div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{name}</div>
                <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5 }}>{desc}</div>
                <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: pathway.accent.primary }}>Open →</div>
              </button>
            );
          })}
        </div>
      </div>

      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} activeMember={null} />
    </div>
  );
}
