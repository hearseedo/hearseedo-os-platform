import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useSubscription } from "../hooks/useSubscription";
import { useLang } from "../hooks/useLang";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { processAppEvent } from "../lib/appEvents";

const EikenApp = lazy(() => import("../pages/EikenApp"));


function buildIframeSrc(url, uid, idToken) {
  if (!url || !uid) return url;
  const u = new URL(url);
  u.searchParams.set("sso_token", uid);
  if (idToken) u.searchParams.set("id_token", idToken);
  return u.toString();
}

export default function AppModal({ app, onClose, user }) {
  const { isUnlocked } = useSubscription();
  const { t } = useLang();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [idToken, setIdToken] = useState(null);


  // Fetch a fresh ID token when the modal opens — used by sub-apps for secure SSO
  useEffect(() => {
    if (!auth.currentUser) return;
    auth.currentUser.getIdToken().then(setIdToken).catch(() => {});
  }, [app?.id]);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Reset loader when app changes — all hooks must be before any early return
  useEffect(() => { setIframeLoaded(false); setIframeBlocked(false); }, [app?.id]);

  // Career Ready and Global Ready are native in-app pages, not iframe sub-apps — redirect instead of rendering the modal
  useEffect(() => {
    if (app?.id === "career-ready") {
      navigate("/career-ready");
      onClose();
    }
    if (app?.id === "global-ready") {
      navigate("/global-ready");
      onClose();
    }
  }, [app?.id]);

  // Blank the iframe before closing — ends iOS scroll session so page scrolls again after
  function handleClose() {
    if (iframeRef.current) {
      try { iframeRef.current.src = "about:blank"; } catch {}
    }
    onClose();
  }

  // Detect iframe blocked — if no load after 20s, show fallback
  useEffect(() => {
    if (!app?.iframeUrl || iframeLoaded) return;
    const timer = setTimeout(() => setIframeBlocked(true), 20000);
    return () => clearTimeout(timer);
  }, [app?.id, app?.iframeUrl, iframeLoaded]);

  // postMessage bridge
  useEffect(() => {
    if (!app || !app.iframeUrl) return;
    const unlocked = isUnlocked(app.id);
    if (!unlocked) return;

    const handleMessage = async (e) => {
      const data = e.data;
      if (!data?.type) return;

      if (data.type === "HSD_OS_READY") {
        iframeRef.current?.contentWindow?.postMessage({
          type:      "HSD_OS_AUTH",
          token:     user?.uid ?? "",
          studentId: user?.uid ?? "",
        }, "*");
      }

      if (data.type === "HSD_OS_PROGRESS" && user?.uid) {
        try {
          // Write basic progress record
          await setDoc(
            doc(db, "users", user.uid, "appProgress", data.module ?? app.id),
            {
              module:       data.module ?? app.id,
              lessonsToday: data.lessonsToday ?? 0,
              updatedAt:    new Date().toISOString(),
            },
            { merge: true }
          );
          // Write enriched learning data to learner profile
          await processAppEvent(user.uid, { ...data, module: data.module ?? app.id });
        } catch {}
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [app?.id, app?.iframeUrl, user?.uid]);

  if (!app || app.id === "career-ready" || app.id === "global-ready") return null;

  const unlocked = isUnlocked(app.id);
  const accent   = app.accent ?? COLORS.red;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.92)",
        display: "flex", flexDirection: "column",
      }}
      onClick={handleClose}
    >
      {/* Header bar */}
      <div
        style={{
          height: 52, background: COLORS.surface,
          borderBottom: `1px solid ${accent}33`,
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12, flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {app.image
          ? <img src={app.image} alt={app.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          : <span style={{ fontSize: 22 }}>{app.icon}</span>
        }
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 8 }}>
            {app.name}
            {app.free && <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "1px 6px", letterSpacing: 1 }}>FREE</span>}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>{app.desc}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClose}
          style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        {unlocked ? (
          app.id === "eiken" ? (
            <Suspense fallback={<div style={{ height: "100%", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>{t("loading")} Eiken AI Coach…</div>}>
              <EikenApp user={user} />
            </Suspense>
          ) : app.iframeUrl ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              {!iframeLoaded && (
                <div style={{
                  position: "absolute", inset: 0, background: "#0a0a0a",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 16, zIndex: 1,
                }}>
                  <div style={{
                    width: 40, height: 40, border: `3px solid ${accent}33`,
                    borderTop: `3px solid ${accent}`,
                    borderRadius: "50%", animation: "spin 0.8s linear infinite",
                  }} />
                  <div style={{ fontSize: 13, color: COLORS.textMuted }}>{t("loading")} {app.name}…</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              {iframeBlocked ? (
                <div style={{
                  height: "100%", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 20,
                  background: COLORS.bg, padding: 40, textAlign: "center",
                }}>
                  <div style={{ fontSize: 40 }}>{app.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{app.name}</div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted, maxWidth: 300, lineHeight: 1.6 }}>
                    {t("app_best_in_window")}
                  </div>
                  <a
                    href={buildIframeSrc(app.iframeUrl, user?.uid, idToken)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "14px 32px", borderRadius: 10, background: accent,
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      textDecoration: "none", display: "inline-block",
                    }}
                  >
                    {app.name} →
                  </a>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={buildIframeSrc(app.iframeUrl, user?.uid, idToken)}
                  title={app.name}
                  onLoad={() => setIframeLoaded(true)}
                  style={{ width: "100%", height: "100%", border: "none", background: "#0a0a0a", display: "block" }}
                  allow="microphone; camera; autoplay; fullscreen; storage-access"
                />
              )}
            </div>
          ) : (
            <ComingSoon app={app} accent={accent} t={t} />
          )
        ) : (
          <LockedView app={app} accent={accent} t={t} />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ app, accent, t }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
      background: COLORS.bg, padding: 40, textAlign: "center",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 16,
        border: `2px solid ${accent}`,
        overflow: "hidden",
        animation: "glowPulse 3s ease-in-out infinite",
        boxShadow: `0 0 20px ${accent}44`,
      }}>
        {app.image
          ? <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: `${accent}11` }}>{app.icon}</span>
        }
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{app.name}</div>
      <div style={{ fontSize: 15, color: accent, fontWeight: 600 }}>{t("launching_soon")}</div>
      <div style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 340, lineHeight: 1.6 }}>
        {t("early_access_list")}<br />
        {t("notify_when_live")}
      </div>
      <div style={{
        marginTop: 8, padding: "10px 20px",
        background: `${accent}11`, border: `1px solid ${accent}44`,
        borderRadius: 8, fontSize: 12, color: accent, letterSpacing: 1,
      }}>
        {t("access_confirmed")}
      </div>
    </div>
  );
}

function LockedView({ app, accent, t }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
      background: COLORS.bg, padding: 40, textAlign: "center",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 16,
        border: "2px solid #2a2a2a",
        overflow: "hidden",
        filter: "grayscale(1) opacity(0.4)",
      }}>
        {app.image
          ? <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#1a1a1a" }}>{app.icon}</span>
        }
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{app.name}</div>
      <div style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 360, lineHeight: 1.6 }}>
        {t("not_in_plan")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        <a
          href="/plans"
          style={{
            display: "block", padding: "13px",
            background: COLORS.red, borderRadius: 8,
            color: "#fff", fontSize: 14, fontWeight: 600,
            textAlign: "center", textDecoration: "none",
            boxShadow: "0 0 16px rgba(224,16,16,0.3)",
          }}
        >
          {t("upgrade")} — {app.name}
        </a>
        <a
          href="/plans"
          style={{
            display: "block", padding: "11px",
            background: "transparent", border: "1px solid #2a2a2a",
            borderRadius: 8, color: COLORS.textMuted,
            fontSize: 13, textAlign: "center", textDecoration: "none",
          }}
        >
          {t("view_all_plans")}
        </a>
      </div>
    </div>
  );
}
