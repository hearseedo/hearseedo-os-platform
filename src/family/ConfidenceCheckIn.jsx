// Confidence signal (Phase 4, item 14) — simple child-friendly "how do you
// feel?" before/after speaking-flavoured activities. Not shown on every
// activity (only talk/create, wired in ActivityPlayer.jsx), dismissible,
// never blocking. Behavioural indicator only, not a clinical measurement.
import { useState } from "react";
import { recordConfidenceSignal } from "./familyProgress";
import { FAMILY_COLORS } from "./theme";

const MOODS = [
  { id: "shy",     emoji: "😊", en: "A little shy", jp: "少し恥ずかしい" },
  { id: "ok",      emoji: "🙂", en: "OK",            jp: "普通" },
  { id: "excited", emoji: "😄", en: "Excited!",      jp: "わくわく！" },
];

export default function ConfidenceCheckIn({ uid, profileId, activityId, phase, onDone }) {
  const [picked, setPicked] = useState(null);

  function pick(moodId) {
    setPicked(moodId);
    if (uid) recordConfidenceSignal(uid, profileId, activityId, phase, moodId);
    setTimeout(() => onDone?.(), 400);
  }

  if (picked) return null;

  return (
    <div style={{ background: FAMILY_COLORS.pinkSoft, border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 14, marginBottom: 16, textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: FAMILY_COLORS.text, marginBottom: 10 }}>
        {phase === "before" ? "How do you feel?" : "How do you feel now?"}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {MOODS.map(m => (
          <button key={m.id} onClick={() => pick(m.id)} style={{
            fontSize: 28, background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 14,
            padding: "8px 14px", cursor: "pointer",
          }}>{m.emoji}</button>
        ))}
      </div>
    </div>
  );
}
