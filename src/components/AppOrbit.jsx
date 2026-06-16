import { COLORS } from "../constants/colors";
import { APP_MAP, ORBIT_LAYOUTS } from "../constants/apps";
import { useSubscription } from "../hooks/useSubscription";
import PulsingOrb from "./PulsingOrb";

const POSITION_STYLES = {
  "top-left":    { top: "4%",    left: "1%"                                    },
  "top-right":   { top: "4%",    right: "1%"                                   },
  "mid-left":    { top: "42%",   left: "-2%"                                   },
  "mid-right":   { top: "42%",   right: "-2%"                                  },
  "bottom-left": { bottom: "2%", left: "8%"                                    },
  "bottom-right":{ bottom: "2%", right: "8%"                                   },
  "bottom":      { bottom: "2%", left: "50%", transform: "translateX(-50%)"    },
};

export default function AppOrbit({ view, onViewChange, onAppClick }) {
  const { isUnlocked } = useSubscription();
  const layout = ORBIT_LAYOUTS[view] ?? ORBIT_LAYOUTS.all;

  return (
    <div>
      {/* Kids / Adult / All toggle */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
        {[
          { id: "kids",  label: "Kids 👶"  },
          { id: "adult", label: "Adult 🧠" },
          { id: "all",   label: "All"      },
        ].map((v) => (
          <button
            key={v.id}
            onClick={() => onViewChange(v.id)}
            style={{
              padding: "6px 16px", borderRadius: 20,
              background: view === v.id ? COLORS.red : "transparent",
              border: `1px solid ${view === v.id ? COLORS.red : COLORS.border}`,
              color: view === v.id ? "#fff" : COLORS.textMuted,
              fontSize: 12, fontWeight: view === v.id ? 600 : 400,
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Orbit */}
      <div style={{ position: "relative", width: "100%", height: 440 }}>
        {/* Orb centre */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -54%)", zIndex: 1 }}>
          <PulsingOrb />
        </div>

        {/* Label above orb */}
        <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 10 }}>
          <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>HSD AI CORE</div>
          <div style={{ fontSize: 10, color: "#4488ff", marginTop: 2 }}>✦ Gemini Powered</div>
        </div>

        {/* App cards */}
        {layout.map(({ id, position }) => {
          const app      = APP_MAP[id];
          const unlocked = isUnlocked(id);
          if (!app) return null;
          return (
            <AppCard
              key={id}
              app={app}
              unlocked={unlocked}
              posStyle={POSITION_STYLES[position]}
              onClick={() => onAppClick(app)}
            />
          );
        })}

        {/* Dashed connectors */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }} viewBox="0 0 700 440" preserveAspectRatio="none">
          {[
            [165, 85, 290, 175], [535, 85, 410, 175],
            [155, 230, 285, 210], [545, 230, 415, 210],
            [350, 390, 350, 295],
          ].map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(224,16,16,0.25)" strokeWidth="1" strokeDasharray="4 4" />
          ))}
        </svg>
      </div>
    </div>
  );
}

function AppCard({ app, unlocked, posStyle, onClick }) {
  const accent = unlocked ? app.accent : COLORS.border;
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute", ...posStyle,
        width: 162, zIndex: 10,
        background: COLORS.card,
        border: `1px solid ${unlocked ? `${app.accent}66` : COLORS.border}`,
        borderRadius: 12, padding: "10px 12px",
        cursor: "pointer", transition: "all 0.2s",
        opacity: unlocked ? 1 : 0.55,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = app.accent;
        e.currentTarget.style.boxShadow  = `0 0 16px ${app.accent}44`;
        e.currentTarget.style.opacity    = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = unlocked ? `${app.accent}66` : COLORS.border;
        e.currentTarget.style.boxShadow  = "none";
        e.currentTarget.style.opacity    = unlocked ? "1" : "0.55";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: unlocked ? `${app.accent}22` : "#1a1a1a",
          border: `1px solid ${unlocked ? `${app.accent}44` : COLORS.border}`,
          position: "relative", flexShrink: 0, overflow: "hidden",
        }}>
          {app.image
            ? <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 10, filter: unlocked ? "none" : "grayscale(80%) brightness(0.5)" }} />
            : app.icon
          }
          {!unlocked && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", borderRadius: 10, fontSize: 14 }}>🔒</div>
          )}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: unlocked ? COLORS.text : COLORS.textDim, lineHeight: 1.2 }}>
            {app.name.replace("™", "").trim()}
          </div>
          <div style={{ fontSize: 9, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.3 }}>{app.desc}</div>
        </div>
      </div>
      {!unlocked && (
        <div style={{ marginTop: 6, fontSize: 9, color: accent }}>¥{app.price.toLocaleString()}/mo</div>
      )}
    </div>
  );
}
