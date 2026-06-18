import { useEffect, useRef } from "react";
import { COLORS } from "../constants/colors";
import { useSubscription } from "../hooks/useSubscription";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const LANDING = import.meta.env.VITE_LANDING_PAGE_URL || "https://hearseedo.jp";

function buildIframeSrc(url, uid) {
  if (!url || !uid) return url;
  const u = new URL(url);
  u.searchParams.set("sso_token", uid);
  return u.toString();
}

export default function AppModal({ app, onClose, user }) {
  const { isUnlocked } = useSubscription();
  const iframeRef = useRef(null);
  if (!app) return null;

  const unlocked = isUnlocked(app.id);
  const accent   = app.accent ?? COLORS.red;

  // postMessage bridge — receive messages from iframe apps
  useEffect(() => {
    if (!unlocked || !app.iframeUrl) return;

    const handleMessage = async (e) => {
      const data = e.data;
      if (!data?.type) return;

      // App is ready — send auth token back
      if (data.type === "HSD_OS_READY") {
        iframeRef.current?.contentWindow?.postMessage({
          type:      "HSD_OS_AUTH",
          token:     user?.uid ?? "",
          studentId: user?.uid ?? "",
        }, "*");
      }

      // App sending progress update — save to Firestore
      if (data.type === "HSD_OS_PROGRESS" && user?.uid) {
        try {
          await setDoc(
            doc(db, "users", user.uid, "appProgress", data.module ?? app.id),
            {
              module:       data.module ?? app.id,
              lessonsToday: data.lessonsToday ?? 0,
              updatedAt:    new Date().toISOString(),
            },
            { merge: true }
          );
        } catch {}
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [unlocked, app.iframeUrl, user?.uid]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.92)",
        display: "flex", flexDirection: "column",
      }}
      onClick={onClose}
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
          onClick={onClose}
          style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        {unlocked ? (
          app.iframeUrl ? (
            <iframe
              ref={iframeRef}
              src={buildIframeSrc(app.iframeUrl, user?.uid)}
              title={app.name}
              style={{ width: "100%", height: "100%", border: "none", background: "#0a0a0a", display: "block" }}
              allow="microphone; camera; autoplay; fullscreen"
            />
          ) : (
            <ComingSoon app={app} accent={accent} />
          )
        ) : (
          <LockedView app={app} accent={accent} />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ app, accent }) {
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
      <div style={{ fontSize: 15, color: accent, fontWeight: 600 }}>is launching soon.</div>
      <div style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 340, lineHeight: 1.6 }}>
        You're on the early access list.<br />
        We'll notify you the moment it's live.
      </div>
      <div style={{
        marginTop: 8, padding: "10px 20px",
        background: `${accent}11`, border: `1px solid ${accent}44`,
        borderRadius: 8, fontSize: 12, color: accent, letterSpacing: 1,
      }}>
        ✓ ACCESS CONFIRMED
      </div>
    </div>
  );
}

function LockedView({ app, accent }) {
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
        This app is not included in your current plan.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 320 }}>
        <a
          href={`${LANDING}/pricing`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block", padding: "13px",
            background: COLORS.red, borderRadius: 8,
            color: "#fff", fontSize: 14, fontWeight: 600,
            textAlign: "center", textDecoration: "none",
            boxShadow: "0 0 16px rgba(224,16,16,0.3)",
          }}
        >
          Get {app.name} — ¥{app.price.toLocaleString()}/mo
        </a>
        <a
          href={`${LANDING}/#pricing`}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block", padding: "11px",
            background: "transparent", border: "1px solid #2a2a2a",
            borderRadius: 8, color: COLORS.textMuted,
            fontSize: 13, textAlign: "center", textDecoration: "none",
          }}
        >
          View all plans
        </a>
      </div>
    </div>
  );
}
