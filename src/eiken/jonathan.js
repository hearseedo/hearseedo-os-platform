// EIKEN Monkey — Jonathan AI voice + intelligence layer.
// Voice: ElevenLabs "Daniel" voice via the platform's shared /api/tts proxy
// (extracted verbatim from the original monolithic EikenApp.jsx — Phase 1,
// no behavior change). Phase 3 builds out the full single-teacher-persona
// system-prompt layer on top of this.
// Intelligence: askJonathan() calls /api/eiken-evaluate (Gemini), replacing
// the old unauthenticated/unmetered /api/eiken-chat (Anthropic Claude) —
// mirrors the askCoach() pattern in src/careerReady/ai.js.
import { auth } from "../lib/firebase";

let _ttsAudio = null;

// Common-phrase cache: identical text (e.g. "Great job!", "Ready?") reuses
// the same blob URL instead of re-fetching /api/tts every time — cuts
// ElevenLabs usage for Monkey Party's short, frequently-repeated lines.
// Bounded size (not a hardcoded phrase list) so it stays useful for whatever
// actually repeats, without needing to keep a fixed list in sync.
const _ttsCache = new Map(); // text -> blob URL
const TTS_CACHE_MAX = 40;

function cacheAudioUrl(text, url) {
  if (_ttsCache.size >= TTS_CACHE_MAX) {
    const oldestKey = _ttsCache.keys().next().value;
    URL.revokeObjectURL(_ttsCache.get(oldestKey));
    _ttsCache.delete(oldestKey);
  }
  _ttsCache.set(text, url);
}

// voiceId param removed (Phase 3) — /api/tts always uses the Daniel voice for
// Jonathan AI; there is no longer a per-companion voice to select.
// onAudioReady(audioEl) — optional; exposes the underlying <audio> element so
// callers (e.g. TalkingMonkey's mouth animation) can attach a Web Audio
// AnalyserNode to it for real-time volume-driven animation.
export function speakElevenLabs(text, { onStart, onEnd, onAudioReady, muted = false } = {}, uid = "", lang) {
  // Stop any playing audio
  if (_ttsAudio) { try { _ttsAudio.pause(); } catch {} _ttsAudio = null; }

  const play = (url) => {
    const audio = new Audio(url);
    audio.muted = muted;
    _ttsAudio = audio;
    if (onAudioReady) onAudioReady(audio);
    audio.onended = () => { _ttsAudio = null; if (onEnd) onEnd(); };
    audio.onerror = () => { _ttsAudio = null; if (onEnd) onEnd(); };
    audio.play().catch(() => { if (onEnd) onEnd(); });
  };

  if (onStart) onStart();

  const cached = _ttsCache.get(text);
  if (cached) { play(cached); return; }

  fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, uid, lang }),
  })
    .then(r => r.ok ? r.blob() : null)
    .then(blob => {
      if (!blob) { if (onEnd) onEnd(); return; }
      const url = URL.createObjectURL(blob);
      cacheAudioUrl(text, url);
      play(url);
    })
    .catch(() => { if (onEnd) onEnd(); });
}

export function stopSpeaking() {
  if (_ttsAudio) { try { _ttsAudio.pause(); } catch {} _ttsAudio = null; }
}

// ── Intelligence: Gemini via /api/eiken-evaluate ────────────────────────────
async function getIdToken() {
  try { return await auth.currentUser?.getIdToken(); } catch { return null; }
}

// Sends a system prompt + message history to Jonathan AI's Gemini backend.
// Returns { content, error, status } — content is the raw text reply (parse
// as JSON yourself if the system prompt asked for a JSON shape). taskType is
// a label for logging/analytics only (e.g. "evaluate_answer", "conversation").
export async function askJonathan({ taskType = "unspecified", system, messages, user } = {}) {
  const idToken = await getIdToken();
  if (!idToken) return { content: null, error: "not_signed_in" };

  try {
    const res = await fetch("/api/eiken-evaluate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, taskType, system, messages, plan: user?.plan ?? "individual" }),
    });
    const data = await res.json();
    if (!res.ok) return { content: null, error: data.error || "request_failed", status: res.status, limit: data.limit, count: data.count };
    return { content: data.content ?? null };
  } catch {
    return { content: null, error: "network_error" };
  }
}

