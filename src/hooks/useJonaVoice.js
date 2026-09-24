// Shared Jona voice engine (P0-A, 2026-09-24). Extracted from
// src/components/AIChat.jsx's original inline STT/TTS implementation — same
// underlying browser SpeechRecognition + /api/tts (ElevenLabs) call, now
// reusable so every Jona surface talks to the same proven pipeline instead
// of a second, parallel one. Two layers are exported:
//
//   speakWithJona() / startJonaListening()  — plain functions, no React
//     state. AIChat.jsx uses these directly so its existing, already-tuned
//     state machine (mute toggle, greeting playback, audioRef handling)
//     keeps working exactly as before — this is a behavior-preserving
//     extraction, not a rewrite of a live component.
//
//   useJonaVoice()  — a small hook for NEW call sites (GlobalJonaAssistant)
//     that manages listening/speaking state itself. Its `mode` prop is what
//     lets the same hook back a full talk+listen experience or an
//     output-only one without another rewrite later:
//       "full"       — startListening() (STT) and speak() (TTS) both work.
//         Intended for surfaces where free-text already exists (dashboard,
//         EIKEN, adult/educator pathways).
//       "outputOnly" — startListening() is a no-op; speak() still works.
//         Intended for young-child, prompts-only apps (Phonics V2, Monkeys
//         Unlock) per the 2026-09-24 decision: "Tap/prompt -> Jona -> spoken
//         response", not open-ended conversational voice input.
//       "off"        — both are no-ops (voice fully disabled for a surface).
//     None of this restricts microphone use inside a controlled learning
//     activity elsewhere in the app (e.g. pronunciation practice) — that is
//     a separate, existing concern from this general Jona-conversation
//     voice layer and is untouched by it.
import { useCallback, useRef, useState } from "react";

export function isSpeechRecognitionSupported() {
  return typeof window !== "undefined" && !!(window.webkitSpeechRecognition || window.SpeechRecognition);
}

// Plays a Jona reply through the existing /api/tts (ElevenLabs) proxy.
// Returns the playing Audio instance so the caller can manage its own
// speaking/stop state — same contract AIChat.jsx's original speakText() had.
export async function speakWithJona(text, uid, lang) {
  const clean = (text || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/`(.+?)`/g, "$1")
    .slice(0, 800);

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean, uid, lang }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob  = await res.blob();
  const url   = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
  return audio;
}

// One-shot browser speech recognition — starts listening, calls onResult
// with the transcript once, then stops itself (same shape as AIChat.jsx's
// original startListening). Returns false if unsupported so the caller can
// show its own fallback message.
export function startJonaListening({ lang, onResult, onStart, onEnd, onError } = {}) {
  const SR = typeof window !== "undefined" && (window.webkitSpeechRecognition || window.SpeechRecognition);
  if (!SR) return false;
  const r = new SR();
  r.lang     = lang === "jp" ? "ja-JP" : "en-US";
  r.onstart  = () => onStart?.();
  r.onend    = () => onEnd?.();
  r.onerror  = () => onError?.();
  r.onresult = (e) => onResult?.(e.results[0][0].transcript);
  r.start();
  return true;
}

/**
 * New-call-site hook. See module doc above for `mode`'s meaning.
 * @param {{ uid?: string, lang?: string, mode?: "full"|"outputOnly"|"off" }} opts
 */
export function useJonaVoice({ uid, lang, mode = "full" } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const audioRef = useRef(null);

  const sttEnabled = mode === "full";
  const ttsEnabled = mode !== "off";
  const sttSupported = sttEnabled && isSpeechRecognitionSupported();

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  const startListening = useCallback((onResult) => {
    if (!sttEnabled) return false;
    return startJonaListening({
      lang,
      onStart: () => setListening(true),
      onEnd:   () => setListening(false),
      onError: () => setListening(false),
      onResult,
    });
  }, [sttEnabled, lang]);

  const speak = useCallback(async (text) => {
    if (!ttsEnabled || !text) return;
    stopSpeaking();
    setSpeaking(true);
    try {
      const audio = await speakWithJona(text, uid, lang);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); audioRef.current = null; };
    } catch {
      setSpeaking(false);
    }
  }, [ttsEnabled, uid, lang, stopSpeaking]);

  return { listening, speaking, sttEnabled, sttSupported, ttsEnabled, startListening, speak, stopSpeaking };
}
