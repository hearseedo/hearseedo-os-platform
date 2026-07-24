// EIKEN Monkey — persistent Jonathan AI memory (mirrors src/careerReady/memory.js).
// Unlike local progress (localStorage, device-bound), this is Jonathan AI's
// running understanding of the student — stored in Firestore so it grows
// with them across sessions and devices. Scoped per-child on family plans,
// mirroring the same users/{uid}/familyMembers/{memberId} convention used
// elsewhere (learningPath, coachingCards) and by Phase 0's eiken-progress.js.
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

function memoryRef(uid, activeMember) {
  return activeMember?.id
    ? doc(db, "users", uid, "familyMembers", activeMember.id, "eikenMemory", "current")
    : doc(db, "users", uid, "eikenMemory", "current");
}

export async function getMemorySummary(uid, activeMember) {
  if (!uid) return { summary: "", sessionsCount: 0 };
  try {
    const snap = await getDoc(memoryRef(uid, activeMember));
    if (!snap.exists()) return { summary: "", sessionsCount: 0 };
    const data = snap.data();
    return { summary: data.summary ?? "", sessionsCount: data.sessionsCount ?? 0 };
  } catch {
    return { summary: "", sessionsCount: 0 };
  }
}

// Fire-and-forget — never blocks the conversation on a Firestore write.
export function updateMemorySummary(uid, activeMember, summary, prevSessionsCount = 0) {
  if (!uid || !summary) return;
  setDoc(
    memoryRef(uid, activeMember),
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
