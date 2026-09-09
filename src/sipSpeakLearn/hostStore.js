// Sip Speak Learn — Host Mode data layer (Phase 6)
// Everything a host does to a real sslEvents doc + its tables/ subcollection.
// Table-level rotation only (per spec: "don't over-engineer the first version"
// — rotation is an instructional banner participants act on themselves, not
// automatic reseating of participant docs).
import { db } from "../lib/firebase";
import {
  doc, collection, setDoc, updateDoc, getDoc, getDocs, onSnapshot,
  serverTimestamp, Timestamp, increment, query, writeBatch, deleteField,
} from "firebase/firestore";
import { STAGES, ROLES, getStageContent, pickAnotherQuestion, rotationInstruction, shortEventCode } from "./tableData";

const DEFAULT_ROUND_SECONDS = 120;

function tableQuestion(seasonId, stage) {
  const c = getStageContent(seasonId, stage);
  return { text: c.q, phrases: c.phrases, level: "base" };
}

// ── Create ──────────────────────────────────────────────────────────────────
// config: { name, seasonId, tableCount, guestsPerTable, rolesEnabled, rotationMode }
export async function createEvent(hostUid, config) {
  const eventRef = doc(collection(db, "sslEvents"));
  let code = shortEventCode();
  // Extremely unlikely collision, but check once.
  const existing = await getDoc(doc(db, "sslEventCodes", code));
  if (existing.exists()) code = shortEventCode();

  const batch = writeBatch(db);
  batch.set(eventRef, {
    name: config.name || "Sip Speak Learn Event",
    hostUid,
    seasonId: config.seasonId,
    code,
    status: "lobby",
    stageIndex: 0,
    roundIndex: 0,
    tableCount: config.tableCount,
    guestsPerTable: config.guestsPerTable,
    rolesEnabled: config.rolesEnabled,
    rotationMode: config.rotationMode,
    roundDurationSec: DEFAULT_ROUND_SECONDS,
    nextAssignIndex: 0,
    promptRequests: 0,
    broadcastMessage: null,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "sslEventCodes", code), { eventId: eventRef.id, createdAt: serverTimestamp() });

  for (let i = 0; i < config.tableCount; i++) {
    batch.set(doc(db, "sslEvents", eventRef.id, "tables", `table-${i + 1}`), {
      tableNumber: i + 1,
      status: "offline",
      participantCount: 0,
      question: tableQuestion(config.seasonId, STAGES[0]),
      message: null,
    });
  }

  await batch.commit();
  return { eventId: eventRef.id, code };
}

// ── Live host controller ────────────────────────────────────────────────────
// IMPORTANT: construction must stay side-effect-free. React 18 StrictMode
// (dev only) double-invokes lazy useState initializers and double-runs
// effects (mount → cleanup → mount) to surface impure code. If the real
// onSnapshot listeners started here in the factory, that first StrictMode
// cleanup would tear them down permanently — the callers's later re-mount
// only re-subscribes a *local* listener to a controller whose Firestore
// listeners are already dead, and the UI hangs on "loading" forever. So the
// listeners only start when something explicitly calls `start()` — the
// caller's useEffect, which itself is safe to run/cleanup/rerun repeatedly.
export function createHostController(eventId) {
  let state = { loading: true, event: null, tables: [], participants: [] };
  const listeners = new Set();
  const notify = () => listeners.forEach((cb) => cb(state));
  const setState = (patch) => { state = { ...state, ...patch }; notify(); };

  const onError = () => setState({ loading: false, error: "offline" });

  let unsubs = [];
  function start() {
    if (unsubs.length) return; // already active
    unsubs = [
      onSnapshot(doc(db, "sslEvents", eventId), (snap) => {
        setState({ event: snap.exists() ? { id: snap.id, ...snap.data() } : null, loading: false });
      }, onError),
      onSnapshot(query(collection(db, "sslEvents", eventId, "tables")), (snap) => {
        setState({ tables: snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.tableNumber - b.tableNumber) });
      }, onError),
      onSnapshot(query(collection(db, "sslEvents", eventId, "participants")), (snap) => {
        setState({ participants: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
      }, onError),
    ];
  }
  function stop() {
    unsubs.forEach((u) => u());
    unsubs = [];
  }

  const eventRef = doc(db, "sslEvents", eventId);
  const tablesCol = () => collection(db, "sslEvents", eventId, "tables");

  async function setAllTables(patch) {
    const snap = await getDocs(tablesCol());
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, patch));
    await batch.commit();
  }

  return {
    getState: () => state,
    subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    start,
    actions: {
      async startEvent() {
        await updateDoc(eventRef, {
          status: "live", stageIndex: 0, roundIndex: 1,
          roundStartedAt: serverTimestamp(), roundDurationSec: DEFAULT_ROUND_SECONDS,
          startedAt: serverTimestamp(),
        });
        await setAllTables({ status: "speaking" });
      },
      async pauseAll() {
        await updateDoc(eventRef, { status: "paused", pausedAt: serverTimestamp() });
      },
      async resumeAll() {
        const snap = await getDoc(eventRef);
        const ev = snap.data();
        const pausedAt = ev.pausedAt?.toMillis?.() ?? Date.now();
        const startedAt = ev.roundStartedAt?.toMillis?.() ?? Date.now();
        const pausedForMs = Date.now() - pausedAt;
        await updateDoc(eventRef, {
          status: "live",
          roundStartedAt: Timestamp.fromMillis(startedAt + pausedForMs),
          pausedAt: deleteField(),
        });
      },
      async extendTwoMinutes() {
        const snap = await getDoc(eventRef);
        const cur = snap.data().roundDurationSec ?? DEFAULT_ROUND_SECONDS;
        await updateDoc(eventRef, { roundDurationSec: cur + 120 });
      },
      async sendNewQuestionToAll() {
        const snap = await getDoc(eventRef);
        const ev = snap.data();
        const stage = STAGES[ev.stageIndex];
        const tSnap = await getDocs(tablesCol());
        const batch = writeBatch(db);
        tSnap.docs.forEach((d) => {
          const cur = d.data().question?.text;
          batch.update(d.ref, { question: { text: pickAnotherQuestion(ev.seasonId, stage, cur), phrases: getStageContent(ev.seasonId, stage).phrases, level: "base" } });
        });
        await batch.commit();
        await updateDoc(eventRef, { promptRequests: increment(1) });
      },
      async moveToNextStage() {
        const snap = await getDoc(eventRef);
        const ev = snap.data();
        const nextIdx = ev.stageIndex + 1;
        if (nextIdx >= STAGES.length) {
          await endEventInternal();
          return;
        }
        await updateDoc(eventRef, {
          stageIndex: nextIdx, roundIndex: ev.roundIndex + 1,
          roundStartedAt: serverTimestamp(), roundDurationSec: DEFAULT_ROUND_SECONDS,
          rotationInstruction: rotationInstruction(ev.rotationMode),
          rotationAt: serverTimestamp(),
        });
        await setAllTables({ status: "speaking", question: tableQuestion(ev.seasonId, STAGES[nextIdx]) });
      },
      async messageTable(tableId, text) {
        await updateDoc(doc(db, "sslEvents", eventId, "tables", tableId), { message: text, messageAt: serverTimestamp() });
      },
      async messageAllTables(text) {
        await updateDoc(eventRef, { broadcastMessage: text, broadcastAt: serverTimestamp() });
      },
      async endEvent(hostNotes) {
        await endEventInternal(hostNotes);
      },
    },
    destroy: stop,
  };

  async function endEventInternal(hostNotes) {
    await updateDoc(eventRef, { status: "ended", endedAt: serverTimestamp(), hostNotes: hostNotes || "" });
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
export async function getEventReport(eventId) {
  const [eventSnap, tablesSnap, participantsSnap] = await Promise.all([
    getDoc(doc(db, "sslEvents", eventId)),
    getDocs(collection(db, "sslEvents", eventId, "tables")),
    getDocs(collection(db, "sslEvents", eventId, "participants")),
  ]);
  const event = eventSnap.data();
  const participants = participantsSnap.docs.map((d) => d.data());
  const tables = tablesSnap.docs.map((d) => d.data());

  const startedMs = event.startedAt?.toMillis?.() ?? null;
  const endedMs = event.endedAt?.toMillis?.() ?? Date.now();
  const durationMin = startedMs ? Math.round((endedMs - startedMs) / 60000) : null;

  const withBefore = participants.filter((p) => typeof p.confidenceBefore === "number" && typeof p.confidenceAfter === "number");
  const avgDelta = withBefore.length
    ? Math.round((withBefore.reduce((sum, p) => sum + (p.confidenceAfter - p.confidenceBefore), 0) / withBefore.length) * 10) / 10
    : null;

  return {
    name: event.name,
    durationMin,
    guestCount: participants.length,
    tableCount: tables.length,
    roundsCompleted: event.roundIndex || 0,
    promptRequests: event.promptRequests || 0,
    avgConfidenceDelta: avgDelta,
    respondedCount: withBefore.length,
    hostNotes: event.hostNotes || "",
  };
}

// ── Templates / duplication ─────────────────────────────────────────────────
export async function saveEventTemplate(hostUid, config) {
  const ref = doc(collection(db, "sslEventTemplates"));
  await setDoc(ref, { hostUid, ...config, createdAt: serverTimestamp() });
  return ref.id;
}

export async function listEventTemplates(hostUid) {
  const snap = await getDocs(query(collection(db, "sslEventTemplates")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.hostUid === hostUid);
}
