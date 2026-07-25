import { TOKENS } from "../../constants/tokens";
import { JONA_STATES } from "./jonaStates";

export default function JonaVisualState({ state = "welcome", size = 170 }) {
  const config = JONA_STATES[state] ?? JONA_STATES.welcome;
  const zoom = size / 170; // scale the crop proportionally to the frame size

  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", overflow: "hidden", position: "relative",
      border: `2px solid ${TOKENS.color.goldDim}`, boxShadow: TOKENS.shadow.glow,
      background: `radial-gradient(circle, ${TOKENS.color.goldGlow} 0%, rgba(0,0,0,0.5) 100%)`,
      flexShrink: 0,
    }}>
      <img
        src={`/assets/jona/${config.pose}`}
        alt={config.label}
        style={{ position: "absolute", top: 0, left: "50%", transform: `translateX(-50%) scale(${zoom})`, transformOrigin: "top center", width: 230, height: "auto", display: "block" }}
      />
    </div>
  );
}
