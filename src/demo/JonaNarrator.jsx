import { useEffect, useRef, useState } from "react";
import { COLORS } from "../constants/colors";
import { speakAsJona } from "./voice";
import { useVoice } from "./VoiceContext";
import { useLang } from "../hooks/useLang";

const POSES = {
  sitting: "/demo/jona/jona-sitting.png",
  listening: "/demo/jona/jona-listening.png",
  thinking: "/demo/jona/jona-thinking.png",
  talking: "/demo/jona/jona-talking.png",
  encouraging: "/demo/jona/jona-encouraging.png",
  celebrating: "/demo/jona/jona-celebrating.png",
  waving: "/demo/jona/jona-waving.png",
};

// Jona's on-screen presence for Demo Mode: shows the script line as a speech
// bubble and, when voice is on, speaks it via the real ElevenLabs /api/tts
// endpoint (same one used by JonaCoach.jsx). If TTS isn't configured or the
// request fails (e.g. running local vite dev with no Netlify functions), it
// fails silently — the text is always there regardless of audio.
// autoPlay=false skips the mount-triggered speakAsJona call entirely — for
// pages (like DemoStart) where something else is already the sole trigger
// for this exact line, so there's only ever one Audio object for it instead
// of this component's own attempt racing/overlapping with that other one.
// externalSpeaking lets that other trigger still drive the speaking-glow
// visual, since this component owns no audio to derive it from in that case.
export default function JonaNarrator({ text, pose = "talking", autoPlay = true, externalSpeaking = false }) {
  const { voiceOn } = useVoice();
  const { lang } = useLang();
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!autoPlay) return undefined;
    let cancelled = false;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (voiceOn && text) {
      setSpeaking(true);
      speakAsJona(text, lang)
        .then((audio) => {
          if (cancelled) { audio.pause(); return; }
          audioRef.current = audio;
          audio.onended = () => setSpeaking(false);
        })
        .catch(() => setSpeaking(false));
    }
    return () => {
      cancelled = true;
      if (audioRef.current) audioRef.current.pause();
      setSpeaking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, voiceOn, autoPlay]);

  const isSpeaking = autoPlay ? speaking : externalSpeaking;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          border: `2px solid ${isSpeaking ? COLORS.red : COLORS.border}`,
          boxShadow: isSpeaking ? `0 0 16px ${COLORS.redGlow}` : "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        <img src={POSES[pose] || POSES.talking} alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div
        style={{
          flex: 1,
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: "4px 14px 14px 14px",
          padding: "12px 16px",
          fontSize: 13,
          lineHeight: 1.7,
          color: COLORS.textMuted,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: COLORS.red, marginBottom: 6 }}>
          Jona {isSpeaking ? "· speaking…" : ""}
        </div>
        {text}
      </div>
    </div>
  );
}
