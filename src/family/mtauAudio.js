// Monkeys Talk & Unlock — static ElevenLabs character-voice playback, with
// automatic fallback to the existing browser speechSynthesis adapter.
//
// PROOF OF CONCEPT (2026-09-19): only Book 1 Lesson 1's "hear" dialogue has
// real static assets right now (see scripts/generate-mtau-lesson1-audio.mjs
// and public/assets/hsd/mtau/audio/book-1/lesson-01/). Every other lesson/
// step has no static asset, so playMTAULine() correctly and automatically
// falls back to the unchanged browser voice for all of them — this module
// changes nothing about their existing behavior.
//
// Zero ElevenLabs API calls happen from this module, or from staging, at
// runtime. The static files were generated once, locally, by a one-off
// script using a local-only API key that is never committed and never
// deployed. Ordinary lesson playback only ever requests a static .mp3 file
// (or, on a cache miss, gets a 404 and falls back) — there is no
// server-side ElevenLabs proxy call anywhere in this path.
function staticAudioUrl(bookId, lessonId, order, speaker) {
  const lessonPadded = String(lessonId).padStart(2, "0");
  const orderPadded = String(order + 1).padStart(2, "0");
  const speakerSlug = speaker.toLowerCase();
  return `/assets/hsd/mtau/audio/book-${bookId}/lesson-${lessonPadded}/${orderPadded}-${speakerSlug}.mp3`;
}

// Module-level pointer to "however the currently-live call stops and
// resolves itself as interrupted." Each playMTAULine call owns its own
// closure (audio element, settled flag, fallback state) and simply
// republishes this pointer as its own state changes — there's no shared
// mutable state between calls beyond this one pointer, so starting a new
// line can never corrupt a previous call's in-flight promise.
let stopCurrent = () => {};

function stopCurrentPlayback() {
  const stop = stopCurrent;
  stopCurrent = () => {};
  stop();
}

/**
 * Plays one MTAU dialogue line: tries the pre-generated static ElevenLabs
 * asset first (real character voice, zero runtime API calls); if the asset
 * is missing (404) or fails to play for any reason, falls back to the
 * existing browser speechSynthesis adapter — a failed/missing AI voice
 * asset must never make the Listen button dead. Always stops/cancels
 * whatever was playing before it, on either path, so voices never overlap.
 *
 * speakFallback: () => Promise<{ok, reason?}> — the existing MTAULesson.jsx
 * speak(text, speaker) call, pre-bound by the caller. This module knows
 * nothing about CHARACTER_VOICES or SpeechSynthesisUtterance — that stays
 * exactly as it already was.
 */
export function playMTAULine({ bookId, lessonId, order, speaker }, speakFallback) {
  stopCurrentPlayback();
  return new Promise(resolve => {
    const url = staticAudioUrl(bookId, lessonId, order, speaker);
    const audio = new Audio(url);
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      stopCurrent = () => {};
      resolve(result);
    };

    // Default stop path: this call is currently playing the static asset.
    stopCurrent = () => {
      audio.pause();
      audio.currentTime = 0;
      finish({ ok: false, reason: "interrupted", source: "elevenlabs-static" });
    };

    const toFallback = () => {
      if (settled) return;
      // Re-point stop at the browser voice once we've actually switched to it.
      stopCurrent = () => {
        window.speechSynthesis?.cancel();
        finish({ ok: false, reason: "interrupted", source: "browser-fallback" });
      };
      speakFallback().then(result => finish({ ...result, source: "browser-fallback" }));
    };

    audio.onended = () => finish({ ok: true, source: "elevenlabs-static" });
    audio.onerror = toFallback; // covers 404 / missing asset / decode failure
    audio.play().catch(toFallback); // covers autoplay-policy / other play() rejections
  });
}

/** Stops whatever MTAU audio is currently playing (static or browser voice). */
export function stopMTAUAudio() {
  stopCurrentPlayback();
}
