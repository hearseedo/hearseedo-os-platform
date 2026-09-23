// HSD Students pathway home (/student). Replaces the previous behavior of
// bouncing straight to the generic Dashboard — a curated landing page for
// the apps that belong here. Career Ready/Global Ready/Speak Ready are
// already mapped to "student" in constants/pathways.js's APP_PATHWAY_MAP;
// EIKEN is added here too (2026-09-23 direction) as genuine student
// test-prep, even though that map still lists it under "family" for
// account-access inference — this page doesn't change that map, it just
// also surfaces EIKEN's existing native modal (same AppModal launch
// Dashboard.jsx already uses, no new EIKEN implementation) here.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PATHWAYS } from "../constants/pathways";
import { APP_MAP } from "../constants/apps";
import AppModal from "../components/AppModal";

const APPS = [
  { id: "career-ready", name: "Career Ready", desc: "English confidence for university life and career.", icon: "🎓", route: "/career-ready" },
  { id: "global-ready", name: "Global Ready", desc: "Confidence for study abroad, travel, and international life.", icon: "🌍", route: "/global-ready" },
  { id: "speak-ready", name: "Speak Ready", desc: "Confidence-first speaking practice for real life.", icon: "🗣️", route: "/speak-ready" },
  { id: "eiken", name: "EIKEN", desc: "EIKEN Grade 5 through Grade 1 — placement, missions, and confidence-first coaching.", icon: "🐒", route: null },
];

const pathway = PATHWAYS.student;

export default function StudentHome() {
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
          {APPS.map((app) => (
            <button
              key={app.id}
              onClick={() => open(app)}
              style={{
                textAlign: "left", background: "#141414", border: `1px solid ${pathway.accent.primary}33`, borderRadius: 16,
                padding: 22, cursor: "pointer", color: "#fff",
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 12 }}>{app.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{app.name}</div>
              <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5 }}>{app.desc}</div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: pathway.accent.primary }}>Open →</div>
            </button>
          ))}
        </div>
      </div>

      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} activeMember={null} />
    </div>
  );
}
