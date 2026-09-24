// Shared browser-speechSynthesis narrator (2026-09-24) — extracted from
// src/familyDemo/JonaBubble.jsx's already-proven implementation (hardened
// this session against Chrome's async-voice-list and double-fallback
// issues) so the ecosystem demo's step-by-step narration ("voice needs to
// follow through, each step") reuses the same working code instead of a
// second, untested copy. Deliberately NOT the live ElevenLabs /api/tts
// pipeline: speechSynthesis.speak() is synchronous and client-side, so it
// isn't subject to the async-gap autoplay blocking that live TTS can hit
// (see useJonaVoice.js's blockedAudio fallback for that separate problem),
// and a public demo should not depend on a live paid API for something
// this repetitive anyway.

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

export async function speakWithBrowserTts(text, lang) {
  if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
  try {
    const synth = window.speechSynthesis;
    const voices = await getVoicesReady();
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.volume = 1;
    utterance.pitch = 1;
    const wantJp = lang === "jp";
    const preferred =
      voices.find((v) => (wantJp ? /^ja/i.test(v.lang) : /en[-_]?(US|GB)/i.test(v.lang))) ||
      voices.find((v) => (wantJp ? /^ja/i.test(v.lang) : /^en/i.test(v.lang))) ||
      voices[0];
    if (preferred) utterance.voice = preferred;
    if (wantJp) utterance.lang = "ja-JP";
    synth.speak(utterance);
  } catch {
    // Voice is best-effort only; the content reads fine without it.
  }
}

export function cancelBrowserTts() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
  }
}
