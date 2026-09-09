import { useEffect, useState } from "react";
import { TOKENS, prefersReducedMotion } from "../../../constants/tokens";
import { useLang } from "../../../hooks/useLang";

// Rebuild prompt section 5, Step 5 — Building your Blueprint (brief
// transition). Status lines are sequenced to reflect real stages: reading
// the collected answers, then handing off to Step 6 once done. No fake long
// loader — capped at a few seconds.

const STAGE_KEYS = ["lb_stage_1", "lb_stage_2", "lb_stage_3", "lb_stage_4", "lb_stage_5"];

export default function Step5BuildingBlueprint({ onDone }) {
  const { t } = useLang();
  const STAGES = STAGE_KEYS.map(t);
  const [stageIndex, setStageIndex] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (stageIndex >= STAGES.length - 1) {
      const doneTimer = setTimeout(onDone, 900);
      return () => clearTimeout(doneTimer);
    }
    const t = setTimeout(() => setStageIndex(i => i + 1), 650);
    return () => clearTimeout(t);
  }, [stageIndex, onDone]);

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      background: TOKENS.color.bg, color: TOKENS.color.starlight, padding: 24, textAlign: "center", boxSizing: "border-box",
    }}>
      <img
        src="/assets/innerkey/anim-loading.gif"
        alt=""
        style={{ width: 140, height: 140, marginBottom: 28, animation: reduced ? "none" : undefined }}
      />
      <div style={{ minHeight: 24, fontSize: TOKENS.font.size.base, color: TOKENS.color.gold, fontWeight: 600 }}>
        {STAGES[stageIndex]}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
        {STAGES.map((_, i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: "50%",
            background: i <= stageIndex ? TOKENS.color.gold : "rgba(255,255,255,0.15)",
          }} />
        ))}
      </div>
    </div>
  );
}
