import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

const N = {
  navy:  "#07091a",
  navy2: "#0c0f27",
  gold:  "#C9A84C",
  gold2: "#F0C060",
  red:   "#e01010",
  white: "#ffffff",
  pale:  "rgba(255,255,255,0.72)",
  muted: "rgba(255,255,255,0.38)",
  dim:   "rgba(255,255,255,0.16)",
  glass: "rgba(255,255,255,0.04)",
  glassB:"1px solid rgba(255,255,255,0.09)",
  goldB: "1px solid rgba(201,168,76,0.35)",
};

const JOIN_TYPES = [
  {
    id: "solo",
    icon: "🙋",
    title: "Just Me",
    sub: "Personal learning journey for one",
    color: "#C9A84C",
  },
  {
    id: "family",
    icon: "👨‍👩‍👧‍👦",
    title: "My Family",
    sub: "Learning together as a household",
    color: "#7B5EA7",
  },
  {
    id: "school",
    icon: "🏫",
    title: "School / University",
    sub: "Classroom or institution licence",
    color: "#22c55e",
  },
  {
    id: "org",
    icon: "🏢",
    title: "Organisation",
    sub: "Corporate or community group",
    color: "#3b82f6",
  },
];

export default function JoinFlow() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (typeId) => {
    setSelected(typeId);
    setSaving(true);
    if (user?.uid) {
      await updateDoc(doc(db, "users", user.uid), {
        joinType: typeId,
        joinTypeSetAt: serverTimestamp(),
      }).catch(() => {});
    }
    setSaving(false);
    navigate("/blueprint", { replace: true });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${N.navy} 0%, ${N.navy2} 100%)`,
      color: N.white,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 24px 48px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle constellation background */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.4 }}>
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 73 + 11) % 100}%`,
            top: `${(i * 47 + 23) % 100}%`,
            width: i % 5 === 0 ? 2 : 1,
            height: i % 5 === 0 ? 2 : 1,
            borderRadius: "50%",
            background: "rgba(201,168,76,0.6)",
            animation: `twinkle ${2 + (i % 3)}s ${i * 0.2}s ease-in-out infinite alternate`,
          }} />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 520, textAlign: "center" }}>

        {/* Jona small avatar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-block", position: "relative" }}>
            <div style={{ position: "absolute", inset: -10, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.2) 0%, transparent 70%)", animation: "glowPulse 3s ease-in-out infinite" }} />
            <img src="/assets/jona.png" alt="Jona" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(201,168,76,0.5)", position: "relative" }} />
          </div>
        </div>

        <div style={{ fontSize: 11, color: N.gold, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 10, animation: "fadeUp 0.5s both" }}>
          Step 1 of 3
        </div>

        <h1 style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 800, lineHeight: 1.15, marginBottom: 10, animation: "fadeUp 0.5s 0.1s both" }}>
          Who is joining <span style={{ color: N.gold }}>HSDOS</span>?
        </h1>

        <p style={{ fontSize: 14, color: N.muted, marginBottom: 40, animation: "fadeUp 0.5s 0.2s both" }}>
          This helps Jona personalise your whole experience.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, animation: "fadeUp 0.5s 0.3s both" }}>
          {JOIN_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => !saving && handleSelect(t.id)}
              disabled={saving}
              style={{
                background: selected === t.id ? `rgba(${hexToRgb(t.color)}, 0.12)` : N.glass,
                border: selected === t.id ? `1px solid ${t.color}66` : N.glassB,
                borderRadius: 20, padding: "22px 16px",
                cursor: saving ? "wait" : "pointer", textAlign: "center",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                if (selected !== t.id) {
                  e.currentTarget.style.background = `rgba(${hexToRgb(t.color)}, 0.07)`;
                  e.currentTarget.style.borderColor = `${t.color}44`;
                }
              }}
              onMouseLeave={e => {
                if (selected !== t.id) {
                  e.currentTarget.style.background = N.glass;
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                }
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>{t.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: N.white, marginBottom: 5 }}>{t.title}</div>
              <div style={{ fontSize: 11, color: N.muted, lineHeight: 1.4 }}>{t.sub}</div>
            </button>
          ))}
        </div>

        <p style={{ fontSize: 11, color: N.dim, marginTop: 32, animation: "fadeUp 0.5s 0.5s both" }}>
          You can change this any time in your profile settings.
        </p>
      </div>

      <style>{`
        @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes twinkle   { from{opacity:0.2} to{opacity:1} }
      `}</style>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
