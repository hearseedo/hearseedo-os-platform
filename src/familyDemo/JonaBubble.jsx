// Jona narrator for the Family demo. Voice is pre-rendered static audio
// (scripts/generate-family-demo-audio.mjs, one file per JONA_LINES key,
// voice nzFihrBIvB34imQBuxub — the same voice the live Jona AI Coach uses),
// played back from public/assets/hsd/family/audio/jona-demo/. The demo
// itself never calls ElevenLabs or /api/tts live. If a clip is missing or
// fails to load, this falls back to the browser's own speechSynthesis —
// and if that's unavailable or blocked too, it just stays silent. Either
// way the walkthrough keeps working.
import { useEffect, useRef } from "react";
import { FAMILY_COLORS } from "../family/theme";

function speakWithBrowserTts(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Voice is best-effort only; the demo reads fine without it.
  }
}

export default function JonaBubble({ text, audioKey, voiceOn }) {
  const spoken = useRef("");
  const audioRef = useRef(null);

  useEffect(() => {
    if (!voiceOn) return;
    if (spoken.current === text) return;
    spoken.current = text;

    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    audioRef.current?.pause();

    if (audioKey) {
      const audio = new Audio(`/assets/hsd/family/audio/jona-demo/${audioKey}.mp3`);
      audioRef.current = audio;
      audio.addEventListener("error", () => speakWithBrowserTts(text), { once: true });
      audio.play().catch(() => speakWithBrowserTts(text));
    } else {
      speakWithBrowserTts(text);
    }

    return () => {
      audioRef.current?.pause();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [text, audioKey, voiceOn]);

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
