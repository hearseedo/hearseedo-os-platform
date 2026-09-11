// Phase 2 — HSD OS AI pathway selector (/choose-path).
// The public-facing transition from the existing platform into the
// four-pathway architecture. Additive: existing users are never forced
// through this screen (see App.jsx route notes) — it's reachable directly
// by URL and via the "Switch Pathway" action for multi-pathway accounts.
//
// Visual update (2026-09-11): Nagoya street-art background — four painted
// routes (pink/blue/gold/yellow/green) fanning out from one plaza toward
// Nagoya Castle, matching PATHWAY_IDS' own left-to-right order
// (family/student/adult/educator) and each pathway's existing accent
// color. All logic below (auth gate, handleSelect, blockedNotice, EN/JP,
// beta-invite link, analytics) is unchanged from the previous version —
// only the background/layout/card styling changed.
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { PATHWAYS, PATHWAY_IDS } from "../constants/pathways";
import { PATHWAY_STATES } from "../lib/pathwayAccess";
import PathwayCard from "../components/PathwayCard";
import { logPathwayEvent, PATHWAY_EVENTS } from "../lib/pathwayAnalytics";

// Approved artwork only — not generated or edited here. Desktop/tablet and
// mobile share the same 1024x1536-family aspect ratio as the welcome
// page's assets, so `background-size: cover` frames them consistently.
const CHOOSE_PATH_ASSETS = {
  bgDesktop: "/assets/choose-path/choose-your-path-bg.webp",
  bgMobile:  "/assets/choose-path/choose-your-path-bg-mobile.webp",
};

// Chosen in JS (not a CSS @media background-image swap) for the same reason
// as the welcome page: a browser's preload scanner can still speculatively
// fetch a url() inside a non-matching @media rule when it lives in a
// dynamically-injected <style> tag, which would silently download both the
// desktop and mobile artwork on every visit.
const CHOOSE_PATH_MOBILE_QUERY = "(max-width: 768px)";
function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(CHOOSE_PATH_MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(CHOOSE_PATH_MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener ? mql.addEventListener("change", onChange) : mql.addListener(onChange);
    return () => (mql.removeEventListener ? mql.removeEventListener("change", onChange) : mql.removeListener(onChange));
  }, []);
  return isMobile;
}

export default function ChoosePath() {
  const { user, loading, pathwayStates, setActivePathway } = useAuth();
  const { t, lang, setLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileViewport();

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

  const bgUrl = isMobile ? CHOOSE_PATH_ASSETS.bgMobile : CHOOSE_PATH_ASSETS.bgDesktop;

  return (
    <div className="hsd-choosepath">
      {/* Nagoya street-art background — decorative, never read by screen readers */}
      <div className="hsd-choosepath__bg" aria-hidden="true" style={{ backgroundImage: `url('${bgUrl}')` }} />
      {/* Restrained navy scrim for heading/footer contrast — lighter in the
          middle so the four painted routes and the cityscape stay visible */}
      <div className="hsd-choosepath__scrim" aria-hidden="true" />

      <style>{`
        .hsd-choosepath {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          overflow-x: hidden;
          color: #f3ecd9;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding-bottom: 56px;
        }
        .hsd-choosepath__bg {
          position: fixed; inset: 0; z-index: 0;
          background-repeat: no-repeat; background-position: center; background-size: cover;
          pointer-events: none;
        }
        .hsd-choosepath__scrim {
          position: fixed; inset: 0; z-index: 1; pointer-events: none;
          background: linear-gradient(180deg,
            rgba(6,7,16,0.86) 0%, rgba(6,7,16,0.58) 20%,
            rgba(6,7,16,0.22) 38%, rgba(6,7,16,0.16) 62%,
            rgba(6,7,16,0.5) 100%);
        }

        .hsd-choosepath__topbar {
          position: fixed; top: 0; left: 0; right: 0; z-index: 20;
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px;
        }
        .hsd-choosepath__brand {
          font-size: 14px; font-weight: 800; letter-spacing: 0.12em; color: #F0C060;
          text-shadow: 0 2px 8px rgba(0,0,0,0.85);
        }
        .hsd-choosepath__langtoggle {
          display: flex; background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.16); border-radius: 20px; overflow: hidden;
        }
        .hsd-choosepath__langbtn {
          padding: 6px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
          background: transparent; color: rgba(255,255,255,0.55);
          border: none; cursor: pointer; transition: background 0.15s, color 0.15s;
        }
        .hsd-choosepath__langbtn.is-active { background: #C9A84C; color: #0a0700; }
        .hsd-choosepath__langbtn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

        .hsd-choosepath__content {
          position: relative; z-index: 2;
          max-width: 1200px; margin: 0 auto;
          padding: 108px 24px 0;
        }
        .hsd-choosepath__eyebrow {
          text-align: center; font-size: 11px; font-weight: 800; letter-spacing: 0.2em;
          text-transform: uppercase; color: #C9A84C; margin-bottom: 12px;
          text-shadow: 0 2px 8px rgba(0,0,0,0.85);
        }
        .hsd-choosepath__title {
          text-align: center; font-size: clamp(28px, 4vw, 42px); font-weight: 900;
          margin: 0 0 12px; color: #fff; text-shadow: 0 3px 14px rgba(0,0,0,0.9);
        }
        .hsd-choosepath__subtitle {
          text-align: center; font-size: 18px; color: rgba(255,255,255,0.88);
          margin: 0 0 6px; text-shadow: 0 2px 10px rgba(0,0,0,0.85);
        }
        .hsd-choosepath__tagline {
          text-align: center; font-size: 13px; color: rgba(255,255,255,0.58);
          margin: 0 0 40px; text-shadow: 0 2px 8px rgba(0,0,0,0.85);
        }

        .hsd-choosepath__notice {
          max-width: 480px; margin: 0 auto 28px; padding: 12px 16px; border-radius: 10px;
          background: rgba(224,16,16,0.14); border: 1px solid rgba(224,16,16,0.35);
          color: #ffb3b3; font-size: 13px; text-align: center;
          text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        }

        .hsd-choosepath__grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(12px, 2vw, 22px);
          margin-bottom: 8px;
        }
        @media (max-width: 768px) {
          .hsd-choosepath__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 340px) {
          .hsd-choosepath__grid { grid-template-columns: 1fr; }
        }

        .hsd-choosepath__invite { text-align: center; margin-top: 28px; }
        .hsd-choosepath__invite button {
          background: none; border: none; color: rgba(255,255,255,0.7); font-size: 12px;
          cursor: pointer; text-decoration: underline; text-shadow: 0 1px 6px rgba(0,0,0,0.8);
        }
        .hsd-choosepath__invite button:focus-visible { outline: 2px solid #C9A84C; outline-offset: 3px; border-radius: 4px; }

        /* Card interaction states (item: strong hover/active/keyboard-focus) */
        .hsd-pathway-card:hover:not(:disabled) { transform: translateY(-4px); }
        .hsd-pathway-card:active:not(:disabled) { transform: translateY(-1px); }
        .hsd-pathway-card:focus-visible { outline: 2px solid #C9A84C; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .hsd-pathway-card, .hsd-pathway-card:hover, .hsd-pathway-card:active { transition: none !important; transform: none !important; }
        }
      `}</style>

      <div className="hsd-choosepath__topbar">
        <div className="hsd-choosepath__brand">HSDOS</div>
        <div className="hsd-choosepath__langtoggle">
          {["en", "jp"].map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`hsd-choosepath__langbtn${lang === l ? " is-active" : ""}`}
            >
              {l === "en" ? "EN" : "JP"}
            </button>
          ))}
        </div>
      </div>

      <div className="hsd-choosepath__content">
        <div className="hsd-choosepath__eyebrow">HSD OS AI</div>
        <h1 className="hsd-choosepath__title">{t("path_selector_title")}</h1>
        <p className="hsd-choosepath__subtitle">{t("path_selector_subtitle")}</p>
        <p className="hsd-choosepath__tagline">{t("path_selector_tagline")}</p>

        {blockedNotice && (
          <div className="hsd-choosepath__notice">{blockedNotice}</div>
        )}

        <div className="hsd-choosepath__grid">
          {PATHWAY_IDS.map(id => (
            <PathwayCard key={id} pathway={PATHWAYS[id]} state={pathwayStates[id]} onSelect={handleSelect} />
          ))}
        </div>

        {/* Phase 4 — HSD Family private beta invite redemption */}
        <div className="hsd-choosepath__invite">
          <button onClick={() => navigate("/family/invite")}>
            Have an HSD Family beta invite code?
          </button>
        </div>
      </div>
    </div>
  );
}
