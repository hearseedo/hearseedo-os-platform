import { COLORS } from "../constants/colors";
import { APP_MAP } from "../constants/apps";
import { useSubscription } from "../hooks/useSubscription";
import PulsingOrb from "./PulsingOrb";

const PATHS = [
  {
    id:    "kids",
    label: "Kids",
    color: "#f97316",
    apps:  ["phonics", "eiken", "wondercamp"],
  },
  {
    id:    "family",
    label: "Family",
    color: "#3b82f6",
    apps:  ["family", "monkeys-unlock"],
  },
  {
    id:    "university",
    label: "University",
    color: "#2ec4b6",
    apps:  ["career-ready", "global-ready", "speak-ready"],
  },
  {
    id:    "adult",
    label: "Adult",
    color: "#e01010",
    apps:  ["speak", "sipswitch", "innerkey"],
  },
];

// Column centres in a 800-unit viewBox (12.5%, 37.5%, 62.5%, 87.5%)
const COL_CX = [100, 300, 500, 700];

export default function AppOrbit({ onAppClick, activeMember, onJonaClick }) {
  const { isUnlocked } = useSubscription();

  return (
    <div style={{ width: "100%" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          HSD AI CORE
        </div>
        <div style={{ fontSize: 10, color: "#4488ff", marginTop: 2 }}>✦ Gemini Powered</div>
      </div>

      {/* Jona orb */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <PulsingOrb onClick={onJonaClick} />
      </div>

      {/* Connector lines — overlap bottom of orb slightly */}
      <svg
        width="100%"
        height="70"
        viewBox="0 0 800 70"
        preserveAspectRatio="none"
        style={{ display: "block", marginTop: -24 }}
      >
        {PATHS.map((path, i) => (
          <g key={path.id}>
            <line
              x1={400} y1={0}
              x2={COL_CX[i]} y2={62}
              stroke={path.color}
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeOpacity="0.65"
            />
            <circle cx={COL_CX[i]} cy={65} r="4" fill={path.color} opacity="0.85" />
          </g>
        ))}
      </svg>

      {/* Path columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 4 }}>
        {PATHS.map((path) => (
          <PathColumn
            key={path.id}
            path={path}
            isUnlocked={isUnlocked}
            onAppClick={onAppClick}
            activeMember={activeMember}
          />
        ))}
      </div>
    </div>
  );
}

function PathColumn({ path, isUnlocked, onAppClick, activeMember }) {
  const apps = path.apps
    .map((id) => APP_MAP[id])
    .filter(Boolean);

  return (
    <div
      style={{
        border:       `1px solid ${path.color}44`,
        borderRadius: 12,
        overflow:     "hidden",
        background:   COLORS.card,
      }}
    >
      {/* Coloured header */}
      <div
        style={{
          background:   `${path.color}18`,
          borderBottom: `1px solid ${path.color}44`,
          padding:      "10px 12px",
          textAlign:    "center",
        }}
      >
        <div
          style={{
            fontSize:      11,
            fontWeight:    700,
            color:         path.color,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          }}
        >
          {path.label}
        </div>
      </div>

      {/* App list */}
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        {path.comingSoon ? (
          <div
            style={{
              padding:    "28px 8px",
              textAlign:  "center",
              fontSize:   10,
              color:      path.color,
              opacity:    0.5,
              fontStyle:  "italic",
            }}
          >
            Coming soon
          </div>
        ) : (
          apps.map((app) => (
            <PathAppCard
              key={app.id}
              app={app}
              unlocked={isUnlocked(app.id)}
              pathColor={path.color}
              onClick={() => onAppClick(app)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PathAppCard({ app, unlocked, pathColor, onClick }) {
  const isComingSoon = app.comingSoon;
  return (
    <div
      onClick={isComingSoon ? undefined : onClick}
      style={{
        background:   unlocked
          ? `linear-gradient(135deg, ${pathColor}0d 0%, ${COLORS.surface} 100%)`
          : COLORS.surface,
        border:       `1px solid ${isComingSoon ? COLORS.border : unlocked ? `${pathColor}55` : COLORS.border}`,
        borderRadius: 10,
        padding:      "12px 14px",
        cursor:       isComingSoon ? "default" : "pointer",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        opacity:      isComingSoon ? 0.5 : unlocked ? 1 : 0.65,
        transition:   "all 0.2s",
        position:     "relative",
        overflow:     "hidden",
      }}
      onMouseEnter={(e) => {
        if (isComingSoon) return;
        e.currentTarget.style.borderColor = pathColor;
        e.currentTarget.style.boxShadow   = `0 0 16px ${pathColor}33`;
        e.currentTarget.style.opacity     = "1";
      }}
      onMouseLeave={(e) => {
        if (isComingSoon) return;
        e.currentTarget.style.borderColor = unlocked ? `${pathColor}55` : COLORS.border;
        e.currentTarget.style.boxShadow   = "none";
        e.currentTarget.style.opacity     = unlocked ? "1" : "0.65";
      }}
    >
      {/* Left accent bar for unlocked apps */}
      {unlocked && !isComingSoon && (
        <div style={{
          position: "absolute", left: 0, top: 8, bottom: 8,
          width: 3, borderRadius: "0 2px 2px 0", background: pathColor,
        }} />
      )}

      {/* Icon */}
      <div
        style={{
          width:          48,
          height:         48,
          borderRadius:   10,
          flexShrink:     0,
          overflow:       "hidden",
          position:       "relative",
          background:     unlocked ? `${pathColor}1a` : "#1a1a1a",
          border:         `1px solid ${unlocked ? `${pathColor}44` : COLORS.border}`,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
        }}
      >
        {app.image ? (
          <img
            src={app.image}
            alt={app.name}
            style={{
              width:     "100%",
              height:    "100%",
              objectFit: "cover",
              filter:    unlocked ? "none" : "grayscale(80%) brightness(0.5)",
            }}
          />
        ) : (
          <span style={{ fontSize: 22 }}>{app.icon}</span>
        )}
        {!unlocked && !isComingSoon && (
          <div
            style={{
              position:       "absolute",
              inset:          0,
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              background:     "rgba(0,0,0,0.55)",
              borderRadius:   10,
              fontSize:       14,
            }}
          >
            🔒
          </div>
        )}
      </div>

      {/* Text */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize:     13,
            fontWeight:   700,
            color:        unlocked ? COLORS.text : COLORS.textDim,
            lineHeight:   1.2,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
            marginBottom: 3,
          }}
        >
          {app.name.replace("™", "").trim()}
        </div>
        <div
          style={{
            fontSize:     11,
            color:        COLORS.textMuted,
            lineHeight:   1.4,
            whiteSpace:   "nowrap",
            overflow:     "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {app.desc}
        </div>
        {isComingSoon ? (
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4, fontStyle: "italic" }}>
            Coming Soon
          </div>
        ) : unlocked ? (
          <div style={{ fontSize: 11, color: pathColor, fontWeight: 700, marginTop: 4 }}>
            Open →
          </div>
        ) : (
          <div style={{ fontSize: 10, color: pathColor, marginTop: 4 }}>
            ¥{app.price?.toLocaleString()}/mo
          </div>
        )}
      </div>
    </div>
  );
}
