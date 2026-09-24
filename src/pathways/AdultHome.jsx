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
import ProfileSwitcher from "../components/ProfileSwitcher";

const APPS = [
  { id: "innerkey", icon: "🔑", route: null },
  { id: "sipswitch", icon: "☕", route: null },
  { id: "speak", icon: "💬", route: null },
  { id: "sip-speak-learn", name: "Sip Speak Learn", desc: "Adult conversation practice, one session at a time.", icon: "🗣️", route: "/sip-speak-learn" },
];

const pathway = PATHWAYS.adult;

export default function AdultHome() {
  const { user, currentProfile, profiles } = useAuth();
  const navigate = useNavigate();
  const [selectedApp, setSelectedApp] = useState(null);
  const displayName = currentProfile?.name || user?.name;
  const hasSwitcher = profiles?.length > 1;

  function open(app) {
    if (app.route) { navigate(app.route); return; }
    const registryEntry = APP_MAP[app.id];
    if (registryEntry) setSelectedApp(registryEntry);
  }

  return (
    <div style={{ minHeight: "100vh", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative" }}>
      {/* Full-viewport hero photo (2026-09-23), same fixed-backdrop
          pattern as HSD Family and Student. */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0.55), rgba(10,10,10,0.88) 70%), url('/assets/hsd/pathways/adult-hero.webp')",
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
      <header style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("/choose-path")} style={{ background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer" }}>
          ← Switch pathway
        </button>
        {/* ProfileSwitcher (P0, 2026-09-24) — see StudentHome.jsx for the
            same pattern/rationale. */}
        {hasSwitcher && <ProfileSwitcher accent="#fff" />}
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Identity display (2026-09-24) — same pattern as StudentHome/
            FamilyHome; no new architecture, just surfacing existing data. */}
        {!hasSwitcher && displayName && (
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            Hi, {displayName} 👋
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: pathway.accent.primary, marginBottom: 8 }}>
          {pathway.displayName}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>{pathway.tagline}</h1>
        <p style={{ color: "#ccc", fontSize: 15, marginBottom: 36, maxWidth: 560 }}>{pathway.description}</p>

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
                  textAlign: "left", background: "rgba(20,20,20,0.75)", backdropFilter: "blur(6px)",
                  border: `1px solid ${pathway.accent.primary}55`, borderRadius: 16,
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
      </div>

      {/* activeMember (2026-09-24 fix) — was hardcoded null; see
          StudentHome.jsx for the same fix and rationale. */}
      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} activeMember={currentProfile?.isVirtual ? null : currentProfile} />
    </div>
  );
}
