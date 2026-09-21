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

// Chrome (and others) silently drop the first speak() call of a session if
// it fires before the voice list has finished loading — getVoices() often
// returns [] synchronously right after page load, and only populates once
// the async "voiceschanged" event fires. Wait for it (briefly) so the very
// first utterance is actually audible, not just queued-and-dropped.
function getVoicesReady() {
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(synth.getVoices()), 500);
    synth.addEventListener(
      "voiceschanged",
      () => {
        clearTimeout(timer);
        resolve(synth.getVoices());
      },
      { once: true }
    );
  });
}

async function speakWithBrowserTts(text) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const synth = window.speechSynthesis;
    const voices = await getVoicesReady();
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.volume = 1;
    utterance.pitch = 1;
    const preferred = voices.find((v) => /en[-_]?(US|GB)/i.test(v.lang)) || voices[0];
    if (preferred) utterance.voice = preferred;
    synth.speak(utterance);
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
      // A missing/failed clip can trigger both the element's "error" event
      // and a rejected play() promise for the same failure — guard so the
      // browser-TTS fallback only ever fires once. Firing speak() twice in
      // quick succession is enough to make some browsers' speech engines
      // cancel themselves into silence.
      let fellBack = false;
      const fallback = () => {
        if (fellBack) return;
        fellBack = true;
        speakWithBrowserTts(text);
      };
      const audio = new Audio(`/assets/hsd/family/audio/jona-demo/${audioKey}.mp3`);
      audioRef.current = audio;
      audio.addEventListener("error", fallback, { once: true });
      audio.play().catch(fallback);
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
