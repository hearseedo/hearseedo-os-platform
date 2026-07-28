import { useEffect, useRef, useState, lazy, Suspense, Component } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useSubscription } from "../hooks/useSubscription";
import { useLang } from "../hooks/useLang";
import { doc, setDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { processAppEvent } from "../lib/appEvents";

const EikenApp = lazy(() => import("../pages/EikenApp"));

class EikenBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <span style={{ fontSize: 40 }}>🐵</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Eiken AI Coach had a hiccup</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, maxWidth: 300, lineHeight: 1.6 }}>Please close this and try opening the app again. If the problem persists, try refreshing the page.</div>
          <button onClick={() => this.setState({ error: null })} style={{ padding: "12px 24px", background: "#e01010", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}


function buildIframeSrc(url, uid, idToken) {
  if (!url || !uid) return url;
  const u = new URL(url);
  u.searchParams.set("sso_token", uid);
  if (idToken) u.searchParams.set("id_token", idToken);
  return u.toString();
}

export default function AppModal({ app, onClose, user, activeMember }) {
  const { isUnlocked } = useSubscription();
  const { t } = useLang();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [idToken, setIdToken] = useState(null);
  const [ikbAcknowledged, setIkbAcknowledged] = useState(
    () => sessionStorage.getItem("ikb_disclaimer_ack") === "1"
  );


  // Fetch a fresh ID token when the modal opens — used by sub-apps for secure SSO
  useEffect(() => {
    if (!auth.currentUser) return;
    auth.currentUser.getIdToken().then(setIdToken).catch(() => {});
  }, [app?.id]);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Reset loader when app changes — all hooks must be before any early return
  useEffect(() => { setIframeLoaded(false); setIframeBlocked(false); }, [app?.id]);

  // Career Ready, Global Ready, and Speak Ready are native in-app pages, not iframe sub-apps — redirect instead of rendering the modal
  useEffect(() => {
    if (app?.id === "career-ready") {
      navigate("/career-ready");
      onClose();
    }
    if (app?.id === "global-ready") {
      navigate("/global-ready");
      onClose();
    }
    if (app?.id === "speak-ready") {
      navigate("/speak-ready");
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

  if (!app || app.id === "career-ready" || app.id === "global-ready" || app.id === "speak-ready") return null;

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
        {app.id === "innerkey" && !ikbAcknowledged ? (
          <IkbDisclaimer onAccept={() => {
            sessionStorage.setItem("ikb_disclaimer_ack", "1");
            setIkbAcknowledged(true);
          }} onClose={handleClose} />
        ) : app.comingSoon ? (
          <ComingSoon app={app} accent={accent} t={t} />
        ) : unlocked ? (
          app.id === "eiken" ? (
            <EikenBoundary>
              <Suspense fallback={<div style={{ height: "100%", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>{t("loading")} Eiken AI Coach…</div>}>
                <EikenApp key={activeMember?.id || "self"} user={user} activeMember={activeMember} />
              </Suspense>
            </EikenBoundary>
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
              ) : idToken ? (
                <iframe
                  ref={iframeRef}
                  src={buildIframeSrc(app.iframeUrl, user?.uid, idToken)}
                  title={app.name}
                  onLoad={() => setIframeLoaded(true)}
                  style={{ width: "100%", height: "100%", border: "none", background: "#0a0a0a", display: "block" }}
                  allow="microphone; camera; autoplay; fullscreen; storage-access"
                />
              ) : null}
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

function IkbDisclaimer({ onAccept, onClose }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: COLORS.bg, overflow: "auto",
    }}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "32px 24px 24px", maxWidth: 560, margin: "0 auto", width: "100%",
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔑</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 6, textAlign: "center" }}>
          The Inner Key Blueprint™
        </div>
        <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 24 }}>
          Please read before entering
        </div>

        <div style={{
          background: "rgba(224,16,16,0.06)", border: "1px solid rgba(224,16,16,0.2)",
          borderRadius: 12, padding: "20px 20px", marginBottom: 20, width: "100%",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e01010", marginBottom: 10, letterSpacing: 0.5 }}>
            NOT THERAPY OR MEDICAL ADVICE
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
            The Inner Key Blueprint™ is an educational self-reflection tool. It is not therapy, counselling, psychiatric treatment, or medical advice. The creator is not a licensed healthcare or mental-health professional.
          </div>
        </div>

        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
          <strong style={{ color: COLORS.text }}>Your responsibility:</strong> Decisions or actions you take based on your personal interpretation of content in this app are your own. They do not constitute instructions or endorsements from Hear See Do™.
        </div>

        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
          <strong style={{ color: COLORS.text }}>AI responses</strong> within this app may not fully understand your circumstances. Do not rely on them for safety-critical decisions.
        </div>

        <div style={{
          background: "rgba(224,16,16,0.10)", border: "1px solid rgba(224,16,16,0.35)",
          borderRadius: 10, padding: "14px 16px", marginBottom: 24, width: "100%",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e01010", lineHeight: 1.6 }}>
            If you are experiencing a mental-health crisis, thoughts of self-harm, or an immediate danger — close this app and contact local emergency services or a crisis-support line immediately.
          </div>
        </div>

        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 24, textAlign: "center", lineHeight: 1.6 }}>
          Full details in our{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#e01010" }}>Terms of Service</a>
          {" "}and{" "}
          <a href="/disclaimer" target="_blank" rel="noopener noreferrer" style={{ color: "#e01010" }}>Educational Disclaimer</a>.
        </div>

        <button
          onClick={onAccept}
          style={{
            width: "100%", padding: "15px", background: "#f59e0b",
            border: "none", borderRadius: 10, color: "#000",
            fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12,
          }}
        >
          I understand — Enter The Inner Key Blueprint™
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px", background: "transparent",
            border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.textMuted,
            fontSize: 13, cursor: "pointer",
          }}
        >
          Go back
        </button>
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
      {/* Greyed app icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 16,
        border: "2px solid #2a2a2a", overflow: "hidden",
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

      {/* Primary upgrade CTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 340 }}>
        <a
          href="/plans"
          style={{
            display: "block", padding: "14px",
            background: COLORS.red, borderRadius: 10,
            color: "#fff", fontSize: 14, fontWeight: 700,
            textAlign: "center", textDecoration: "none",
            boxShadow: "0 0 20px rgba(224,16,16,0.35)",
          }}
        >
          {t("upgrade")} — unlock {app.name}
        </a>

        {/* Founding member offer */}
        <div style={{
          background: "rgba(197,163,12,0.07)",
          border: "1px solid rgba(197,163,12,0.35)",
          borderRadius: 10, padding: "14px 16px", textAlign: "left",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            ⭐ Founding Member Offer
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
            The first 200 paying members lock in their plan price forever — no price increases, ever. Spots are limited and won't reopen.
          </div>
          <a
            href="/plans"
            style={{
              display: "block", padding: "10px",
              background: "#C9A84C", borderRadius: 8,
              color: "#000", fontSize: 13, fontWeight: 700,
              textAlign: "center", textDecoration: "none",
            }}
          >
            Become a Founding Member →
          </a>
        </div>

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
