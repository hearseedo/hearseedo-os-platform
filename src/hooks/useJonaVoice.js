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
// safetyToken (2026-09-24, safety TTS exemption) — optional, only ever
// non-null when chat.js's OWN server-side risk classification fired on
// this exact reply (see src/lib/claude.js's sendMessage onMeta). Lets
// tts.js bypass the normal per-account rate cap for this one verified
// safety reply, single-use — never a general voice-limit bypass.
export async function speakWithJona(text, uid, lang, safetyToken) {
  const clean = (text || "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/`(.+?)`/g, "$1")
    .slice(0, 800);

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean, uid, lang, ...(safetyToken ? { safetyToken } : {}) }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob  = await res.blob();
  const url   = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  try {
    await audio.play();
  } catch (err) {
    // Autoplay was blocked (typically NotAllowedError) — the audio itself
    // is valid and ready, it just needs a direct user tap to actually play
    // (see useJonaVoice's playBlockedAudio). Surface that distinction to
    // the caller instead of treating this the same as a real failure.
    const blockedError = new Error("Autoplay blocked");
    blockedError.blocked = true;
    blockedError.audio = audio;
    throw blockedError;
  }
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
  // Autoplay-block fallback (2026-09-24 fix) — speak() fires after an
  // async reply (and its own async /api/tts fetch), which is well outside
  // the synchronous "direct user gesture" window Chrome/Safari require to
  // guarantee autoplay. A first-time visitor (exactly what a demo visitor
  // always is) reliably gets audio.play() silently rejected — previously
  // swallowed with zero visible error, reading as "voice doesn't work" for
  // no discoverable reason. Rather than trying to defeat the browser's
  // autoplay heuristics, this exposes the blocked audio so the UI can offer
  // one real, direct tap to play it — which always works, in every browser,
  // by design (that tap IS the user gesture the browser was waiting for).
  const [blockedAudio, setBlockedAudio] = useState(null); // HTMLAudioElement | null
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
    setBlockedAudio(null);
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

  const speak = useCallback(async (text, safetyToken) => {
    if (!ttsEnabled || !text) return;
    stopSpeaking();
    setSpeaking(true);
    try {
      const audio = await speakWithJona(text, uid, lang, safetyToken);
      audioRef.current = audio;
      audio.onended = () => { setSpeaking(false); audioRef.current = null; };
    } catch (err) {
      setSpeaking(false);
      // NotAllowedError specifically = autoplay was blocked, not a real
      // failure — the audio is ready, it just needs a direct tap to play.
      // Any other error (network/TTS failure) has nothing to retry.
      if (err?.audio && err?.blocked) {
        audioRef.current = err.audio;
        setBlockedAudio(err.audio);
      }
    }
  }, [ttsEnabled, uid, lang, stopSpeaking]);

  // The one direct, synchronous user gesture that reliably satisfies every
  // browser's autoplay requirement — call this from an onClick handler.
  const playBlockedAudio = useCallback(() => {
    const audio = blockedAudio;
    if (!audio) return;
    setBlockedAudio(null);
    setSpeaking(true);
    audio.onended = () => { setSpeaking(false); audioRef.current = null; };
    audio.play().catch(() => setSpeaking(false));
  }, [blockedAudio]);

  return { listening, speaking, sttEnabled, sttSupported, ttsEnabled, startListening, speak, stopSpeaking, blockedAudio, playBlockedAudio };
}
