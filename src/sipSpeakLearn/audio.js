// Sip Speak Learn — HEAR/SEE audio via the browser Web Speech API.
// Free, offline, and gives two distinct voices for the two-person dialogue
// without spending AI/TTS credits. Degrades gracefully where unsupported.

export const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window;

let cachedVoices = [];

function loadVoices() {
  if (!speechSupported) return [];
  cachedVoices = window.speechSynthesis.getVoices() || [];
  return cachedVoices;
}

if (speechSupported) {
  loadVoices();
  // Voices often populate asynchronously.
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Pick two clearly different English voices (prefer en-*). Returns [voiceA, voiceB].
export function pickVoices() {
  const voices = cachedVoices.length ? cachedVoices : loadVoices();
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length >= 2 ? en : voices;
  if (pool.length === 0) return [null, null];

  // Try to pick a male-ish and female-ish pair by common name hints, else just
  // two different entries.
  const femaleHint = /(female|samantha|victoria|karen|moira|tessa|fiona|serena|zira|susan|allison|ava|joanna)/i;
  const maleHint = /(male|daniel|alex|fred|thomas|oliver|george|arthur|david|mark|aaron|gordon)/i;
  const a = pool.find((v) => femaleHint.test(v.name)) || pool[0];
  const b = pool.find((v) => maleHint.test(v.name) && v !== a) || pool.find((v) => v !== a) || a;
  return [a, b];
}

// Map an ordered list of speaker names to alternating voices, so a given
// speaker always sounds the same within a dialogue.
export function voiceMapForSpeakers(speakers) {
  const [a, b] = pickVoices();
  const unique = [...new Set(speakers)];
  const map = {};
  unique.forEach((sp, i) => { map[sp] = i % 2 === 0 ? a : b; });
  return map;
}

export function cancelSpeech() {
  if (speechSupported) window.speechSynthesis.cancel();
}

// Speak a single utterance. Returns the utterance so callers can await onend.
export function speakLine(text, { voice, rate = 1, onend } = {}) {
  if (!speechSupported || !text) { onend?.(); return null; }
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.rate = rate;
  u.pitch = 1;
  if (onend) u.onend = onend;
  window.speechSynthesis.speak(u);
  return u;
}

// Speak a sequence of { speaker, line } items, highlighting each as it plays.
// Returns a controller with cancel(). onLine(index) fires before each line;
// onDone() fires when finished or cancelled-to-end.
export function playDialogue(items, { rate = 1, onLine, onDone } = {}) {
  cancelSpeech();
  const voiceMap = voiceMapForSpeakers(items.map((i) => i.speaker));
  let cancelled = false;
  let i = 0;

  const next = () => {
    if (cancelled) return;
    if (i >= items.length) { onDone?.(); return; }
    const item = items[i];
    onLine?.(i);
    const advance = () => { i += 1; next(); };
    if (!speechSupported) { setTimeout(advance, 1200); return; }
    speakLine(item.line, { voice: voiceMap[item.speaker], rate, onend: advance });
  };

  next();
  return { cancel: () => { cancelled = true; cancelSpeech(); } };
}
