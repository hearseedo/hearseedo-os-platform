// Speak Ready — persistent Gemini memory
// Unlike progress/badges (localStorage, device-bound), this is the AI's running
// understanding of the student — stored in Firestore so it grows with them
// across sessions and devices, the same account-bound way the rest of HSDOS.AI works.
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

const memoryRef = (uid) => doc(db, "users", uid, "speakReady", "memory");

export async function getMemorySummary(uid) {
  if (!uid) return { summary: "", sessionsCount: 0 };
  try {
    const snap = await getDoc(memoryRef(uid));
    if (!snap.exists()) return { summary: "", sessionsCount: 0 };
    const data = snap.data();
    return { summary: data.summary ?? "", sessionsCount: data.sessionsCount ?? 0 };
  } catch {
    return { summary: "", sessionsCount: 0 };
  }
}

// Fire-and-forget — never blocks the conversation on a Firestore write.
export function updateMemorySummary(uid, summary, prevSessionsCount = 0) {
  if (!uid || !summary) return;
  setDoc(
    memoryRef(uid),
    { summary, sessionsCount: prevSessionsCount + 1, updatedAt: serverTimestamp() },
    { merge: true }
  ).catch(() => {});
}

const MAX_MEMORY_LINES = 16;

// Appends one new fact to the running memory summary, keeping only the most
// recent lines so the summary (and the tokens it costs every prompt) stay bounded.
export function mergeMemoryNote(existingSummary, note) {
  if (!note?.trim()) return existingSummary ?? "";
  const lines = (existingSummary ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  lines.push(`- ${note.trim()}`);
  return lines.slice(-MAX_MEMORY_LINES).join("\n");
}
