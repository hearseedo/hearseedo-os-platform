// Gate B Stage 4 (2026-09-29) — browser-native speech-to-text for the
// IMMEDIATE_DANGER restricted, non-Live safety pathway (approved Option C —
// see docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md §1).
//
// Deliberately NOT Gemini Live: the whole point of this pathway is that no
// further raw audio is sent to Gemini during the highest-risk window. This
// uses the browser/OS's own speech recognition (Web Speech API,
// SpeechRecognition/webkitSpeechRecognition) — the same class of
// browser-native capability browserNarration.js already relies on for
// output — so recognized TEXT is all that ever leaves the device, going to
// HSD's own server (live-restricted-safety-reply.js), never to Gemini as
// audio.
//
// This is intentionally a thin, single-purpose wrapper: start listening,
// get one final recognized utterance back via a callback, stop. It does
// not attempt continuous/streaming recognition — each restricted-pathway
// turn is one deliberate listen-then-respond exchange, matching that
// pathway's own turn-based (not full-duplex) nature.

function getSpeechRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isBrowserSpeechInputSupported() {
  return getSpeechRecognitionCtor() != null;
}

/**
 * Starts one listen-for-a-single-utterance session. Resolves with the
 * recognized text (possibly empty string if nothing was understood), or
 * rejects if speech recognition isn't available/permitted/fails.
 *
 * @param {{ lang?: "en"|"jp", timeoutMs?: number }} [opts]
 * @returns {Promise<string>}
 */
export function listenOnce({ lang = "en", timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      reject(new Error("browser_speech_input_unsupported"));
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang === "jp" ? "ja-JP" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { recognition.stop(); } catch { /* already stopped */ }
      resolve(""); // timed out with no speech — caller treats as "nothing said"
    }, timeoutMs);

    recognition.onresult = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = event.results?.[0]?.[0]?.transcript ?? "";
      resolve(text);
    };
    recognition.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // "no-speech" is not a real error for this caller's purposes — it
      // just means the child didn't say anything before the browser's own
      // silence threshold; treat it the same as "nothing said" rather than
      // failing the whole restricted-pathway turn.
      if (event.error === "no-speech") { resolve(""); return; }
      reject(new Error(`browser_speech_input_error: ${event.error}`));
    };
    recognition.onend = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve("");
    };

    try {
      recognition.start();
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}
