// Profile switcher (P0, 2026-09-24 — approved design in
// docs/PROFILE_SWITCHER_UX_AND_SSL_AUDIT_2026-09-24.md). "{name} 👤 ▾" in
// the shared pathway header — desktop: anchored dropdown; mobile: bottom
// sheet. Read/select only — no account administration, deletion, or
// profile editing lives here (that stays wherever it already does, e.g.
// Family's existing child-profile management). Renders nothing for a
// single-profile account (no point showing a switcher with only one
// choice) and nothing on Educator (not rendered there at all, per
// instruction — this component simply isn't mounted on that pathway).
//
// Deliberately requires a tap to open, then a tap to choose — never a
// single accidental tap that switches identity (per the "keep switching
// deliberate" instruction). No PIN/reauthentication for beta — flagged in
// the proposal doc as a later decision if HSD ever exposes sensitive
// parent-only information through this same surface.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useMobile } from "../hooks/useMobile";

export default function ProfileSwitcher({ accent = "#fff" }) {
  const { profiles, currentProfile, setActiveProfile } = useAuth();
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef(null);

  // Close on outside click / Escape (desktop dropdown only — the mobile
  // sheet has its own backdrop that already handles this).
  useEffect(() => {
    if (!open || isMobile) return;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobile]);

  if (!profiles || profiles.length <= 1 || !currentProfile) return null;

  async function choose(profileId) {
    if (profileId === currentProfile.id || switching) { setOpen(false); return; }
    setSwitching(true);
    await setActiveProfile(profileId);
    setSwitching(false);
    setOpen(false);
  }

  // No per-profile pathway field exists yet (defaultPathway is explicitly
  // on hold, per the migration proposal) — the dot is just a lightweight
  // visual marker (self vs. family member) today, not a pathway indicator.
  const rows = profiles.map((p) => (
    <button
      key={p.id}
      onClick={() => choose(p.id)}
      disabled={switching}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "12px 14px", background: p.id === currentProfile.id ? "rgba(255,255,255,0.08)" : "transparent",
        border: "none", borderRadius: 10, cursor: switching ? "default" : "pointer",
        textAlign: "left", fontSize: 14, color: "#fff", minHeight: 44,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.isVirtual ? accent : "#e0559c", flexShrink: 0 }} />
      <span style={{ flex: 1, fontWeight: p.id === currentProfile.id ? 800 : 600 }}>{p.name}</span>
      {p.id === currentProfile.id && <span style={{ fontSize: 12, opacity: 0.7 }}>✓</span>}
    </button>
  ));

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch profile"
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "center", gap: 6, background: "none",
          border: "none", color: accent, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "4px 2px",
        }}
      >
        {currentProfile.name} <span aria-hidden="true">👤</span> <span aria-hidden="true" style={{ fontSize: 11, opacity: 0.8 }}>▾</span>
      </button>

      {open && !isMobile && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 300,
            width: 220, background: "rgba(20,20,20,0.97)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 6,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
          }}
        >
          {rows}
        </div>
      )}

      {open && isMobile && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300 }}
          />
          <div
            style={{
              position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 301,
              background: "#141414", borderTopLeftRadius: 20, borderTopRightRadius: 20,
              padding: "10px 12px calc(env(safe-area-inset-bottom, 0px) + 16px)",
              boxShadow: "0 -12px 32px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.25)", margin: "4px auto 12px" }} />
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#999", padding: "0 10px 8px" }}>
              Switch profile
            </div>
            {rows}
          </div>
        </>
      )}
    </div>
  );
}
