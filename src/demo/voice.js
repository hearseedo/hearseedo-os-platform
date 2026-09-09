// Same /api/tts contract as JonaCoach.jsx and AIChat.jsx — real ElevenLabs
// voice when the function is configured, silent no-op otherwise. Demo mode
// uses a fixed uid since there's no logged-in user to attribute usage to.
const DEMO_UID = "demo-alex";

export async function speakAsJona(text, lang) {
  const clean = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .slice(0, 800);

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean, uid: DEMO_UID, lang }),
  });
  if (!res.ok) throw new Error("TTS failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.onended = () => URL.revokeObjectURL(url);
  await audio.play();
  return audio;
}
