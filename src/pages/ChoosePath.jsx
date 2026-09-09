// Phase 2 — HSD OS AI pathway selector (/choose-path).
// The public-facing transition from the existing platform into the
// four-pathway architecture. Additive: existing users are never forced
// through this screen (see App.jsx route notes) — it's reachable directly
// by URL and via the "Switch Pathway" action for multi-pathway accounts.
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { PATHWAYS, PATHWAY_IDS } from "../constants/pathways";
import { PATHWAY_STATES } from "../lib/pathwayAccess";
import PathwayCard from "../components/PathwayCard";
import { logPathwayEvent, PATHWAY_EVENTS } from "../lib/pathwayAnalytics";

export default function ChoosePath() {
  const { user, loading, pathwayStates, setActivePathway } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.uid) logPathwayEvent(user.uid, PATHWAY_EVENTS.PATHWAY_SELECTOR_VIEWED, { isNewUser: !user.setupDone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  if (loading) return null;
  if (!user) { navigate("/", { replace: true }); return null; }

  async function handleSelect(pathwayId) {
    const ok = await setActivePathway(pathwayId);
    if (ok) navigate(PATHWAYS[pathwayId].route);
  }

  const blockedNotice = location.state?.blockedPathway
    ? t("path_locked_message")
    : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#fff",
      padding: "48px 20px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Accessibility (item 15) — visible keyboard focus + card hover/lift,
          and respects prefers-reduced-motion (item 16: subtle motion only). */}
      <style>{`
        .hsd-pathway-card:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,0.35); }
        .hsd-pathway-card:focus-visible { outline: 2px solid #C9A84C; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .hsd-pathway-card, .hsd-pathway-card:hover { transition: none !important; transform: none !important; }
        }
      `}</style>

      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden" }}>
        {["en", "jp"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            background: lang === l ? "#C9A84C" : "transparent",
            color: lang === l ? "#0a0700" : "rgba(255,255,255,0.45)",
            border: "none", cursor: "pointer", transition: "all 0.15s",
          }}>{l === "en" ? "EN" : "JP"}</button>
        ))}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#C9A84C", marginBottom: 12 }}>
            HSD OS AI
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, margin: "0 0 12px" }}>
            {t("path_selector_title")}
          </h1>
          <p style={{ fontSize: 18, color: "#ccc", margin: "0 0 6px" }}>{t("path_selector_subtitle")}</p>
          <p style={{ fontSize: 13, color: "#777", margin: 0 }}>{t("path_selector_tagline")}</p>
        </div>

        {blockedNotice && (
          <div style={{
            maxWidth: 480, margin: "0 auto 28px", padding: "12px 16px", borderRadius: 10,
            background: "rgba(224,16,16,0.08)", border: "1px solid rgba(224,16,16,0.25)",
            color: "#f5a3a3", fontSize: 13, textAlign: "center",
          }}>
            {blockedNotice}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 20,
        }}>
          {PATHWAY_IDS.map(id => (
            <PathwayCard key={id} pathway={PATHWAYS[id]} state={pathwayStates[id]} onSelect={handleSelect} />
          ))}
        </div>
      </div>
    </div>
  );
}
