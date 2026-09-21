// Jona narrator for the Family demo. Deliberately uses the browser's own
// speechSynthesis for optional voice — never /api/tts (ElevenLabs) — so the
// demo has zero dependency on a live backend service.
import { useEffect, useRef } from "react";
import { FAMILY_COLORS } from "../family/theme";

export default function JonaBubble({ text, voiceOn }) {
  const spoken = useRef("");

  useEffect(() => {
    if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
    if (spoken.current === text) return;
    spoken.current = text;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [text, voiceOn]);

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 24 }}>
      <img
        src="/assets/hsd/family/characters/family-jona.webp"
        alt="Jona"
        width={64}
        height={64}
        style={{ width: 64, height: 64, objectFit: "contain", flexShrink: 0 }}
      />
      <div
        style={{
          background: "#fff",
          border: `2px solid ${FAMILY_COLORS.border}`,
          borderRadius: "4px 18px 18px 18px",
          padding: "14px 18px",
          maxWidth: 520,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 4 }}>
          Jona
        </div>
        <div style={{ fontSize: 14, color: FAMILY_COLORS.text, lineHeight: 1.6 }}>{text}</div>
      </div>
    </div>
  );
}
