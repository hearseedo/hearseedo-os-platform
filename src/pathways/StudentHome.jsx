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
import { useLang } from "../hooks/useLang";
import { PATHWAYS, getPathwayText } from "../constants/pathways";
import { APP_MAP } from "../constants/apps";
import AppModal from "../components/AppModal";
import ProfileSwitcher from "../components/ProfileSwitcher";

const APPS = [
  { id: "career-ready", name: "Career Ready", desc: "English confidence for university life and career.", icon: "🎓", route: "/career-ready" },
  { id: "global-ready", name: "Global Ready", desc: "Confidence for study abroad, travel, and international life.", icon: "🌍", route: "/global-ready" },
  { id: "speak-ready", name: "Speak Ready", desc: "Confidence-first speaking practice for real life.", icon: "🗣️", route: "/speak-ready" },
  { id: "eiken", name: "EIKEN", desc: "EIKEN Grade 5 through Grade 1 — placement, missions, and confidence-first coaching.", icon: "🐒", route: null },
];

const pathway = PATHWAYS.student;

export default function StudentHome() {
  const { user, currentProfile, profiles } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [selectedApp, setSelectedApp] = useState(null);
  const displayName = currentProfile?.name || user?.name;
  const hasSwitcher = profiles?.length > 1;
  const text = getPathwayText(pathway, lang);

  function open(app) {
    if (app.route) { navigate(app.route); return; }
    const registryEntry = APP_MAP[app.id];
    if (registryEntry) setSelectedApp(registryEntry);
  }

  return (
    <div style={{ minHeight: "100vh", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative" }}>
      {/* Full-viewport hero photo (2026-09-23), same fixed-backdrop
          pattern as HSD Family — dark gradient overlay keeps the white
          text/translucent cards readable over it. */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: "linear-gradient(180deg, rgba(10,10,10,0.55), rgba(10,10,10,0.88) 70%), url('/assets/hsd/pathways/student-hero.webp')",
          backgroundSize: "cover", backgroundPosition: "center",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>
      <header style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate("/choose-path")} style={{ background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer" }}>
          ← {t("path_switch_pathway")}
        </button>
        {/* ProfileSwitcher (P0, 2026-09-24) — renders nothing for a
            single-profile account, so the plain "Hi, {name}" line below
            still covers that case; never both at once. */}
        {hasSwitcher && <ProfileSwitcher accent="#fff" />}
      </header>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 20px 60px" }}>
        {/* Identity display (2026-09-24) — "who is currently using HSD"
            should always be obvious, not just which pathway. Same data
            useAuth() already computes for FamilyHome's "👋 {name}" header;
            no new architecture, just surfacing it here too. */}
        {!hasSwitcher && displayName && (
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>
            Hi, {displayName} 👋
          </div>
        )}
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: pathway.accent.primary, marginBottom: 8 }}>
          {text.displayName}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px" }}>{text.tagline}</h1>
        <p style={{ color: "#ccc", fontSize: 15, marginBottom: 36, maxWidth: 560 }}>{text.description}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          {APPS.map((app) => (
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
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{app.name}</div>
              <div style={{ fontSize: 13, color: "#999", lineHeight: 1.5 }}>{app.desc}</div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: pathway.accent.primary }}>Open →</div>
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* activeMember (2026-09-24 fix) — was hardcoded null, silently
          dropping whichever profile was actually active; same
          isVirtual-check pattern ActivityPlayer.jsx already uses for the
          "self" profile, which has no real familyMembers doc to pass. */}
      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} activeMember={currentProfile?.isVirtual ? null : currentProfile} />
    </div>
  );
}
