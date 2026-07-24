// Sip Speak Learn — Table Mode data layer (Phase 5, extended in Phase 6)
// Two controllers behind one identical interface: { getState(), subscribe(cb), actions, destroy() }.
//   • createLiveController — real Firestore: joins a real host-created event
//     (Phase 6), transactionally assigns a table + role + rotation color,
//     then listens to the event + own table + own participant docs. Round
//     timers are derived from the host's server-written roundStartedAt +
//     roundDurationSec, so every device counts down from the same basis
//     (not independent client clocks).
//   • createDemoController — fully local, no network. Lets Table Mode be
//     built, used and verified without a live host.
//
// Firestore data model — see hostStore.js for the write side and
// firestore.rules for access rules.
import { db } from "../lib/firebase";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, runTransaction, increment,
} from "firebase/firestore";
import {
  STAGES, ROLES, ROTATION_COLORS, getStageContent, pickAnotherQuestion, rotationInstruction,
} from "./tableData";

const ROUND_SECONDS = 120;

function makeQuestionState(seasonId, stage) {
  const content = getStageContent(seasonId, stage);
  return { text: content.q, phrases: content.phrases, level: "base" };
}

// ── Live (Firestore-backed) ────────────────────────────────────────────────
export async function joinEventByCode(code) {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { ok: false, reason: "invalid" };
  try {
    const codeSnap = await getDoc(doc(db, "sslEventCodes", clean));
    if (!codeSnap.exists()) return { ok: false, reason: "not_found" };
    const { eventId } = codeSnap.data();
    const eventSnap = await getDoc(doc(db, "sslEvents", eventId));
    if (!eventSnap.exists()) return { ok: false, reason: "not_found" };
    const event = eventSnap.data();
    if (event.status === "ended") return { ok: false, reason: "ended" };
    return { ok: true, eventId };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

// Transactionally claim the next table in round-robin order, or return the
// participant's existing assignment if they've already joined.
async function assignSeat(eventId, user) {
  const eventRef = doc(db, "sslEvents", eventId);
  const participantRef = doc(db, "sslEvents", eventId, "participants", user.uid);

  return runTransaction(db, async (tx) => {
    const existing = await tx.get(participantRef);
    if (existing.exists() && existing.data().tableId) return existing.data();

    const eventSnap = await tx.get(eventRef);
    const ev = eventSnap.data();
    const idx = ev.nextAssignIndex || 0;
    const tableIndex = idx % ev.tableCount;
    const tableId = `table-${tableIndex + 1}`;
    const tableRef = doc(db, "sslEvents", eventId, "tables", tableId);
    const tableSnap = await tx.get(tableRef);
    const participantCount = (tableSnap.data()?.participantCount || 0) + 1;
    const role = ev.rolesEnabled ? ROLES[idx % ROLES.length].id : null;
    const color = ROTATION_COLORS[tableIndex % ROTATION_COLORS.length];

    const participant = {
      displayName: user.name || user.email?.split("@")[0] || "Guest",
      tableId, tableNumber: tableIndex + 1, role, color,
      joinedAt: serverTimestamp(),
    };
    tx.set(participantRef, participant, { merge: true });
    tx.update(tableRef, { participantCount });
    tx.update(eventRef, { nextAssignIndex: idx + 1 });
    return participant;
  });
}

export function createLiveController(eventId, user) {
  let state = { phase: "connecting", isDemo: false };
  const listeners = new Set();
  const notify = () => listeners.forEach((cb) => cb(state));
  const setState = (patch) => { state = { ...state, ...patch }; notify(); };

  let unsubEvent = null, unsubTable = null;
  let event = null, table = null, seat = null;

  function computeAndPublish() {
    if (!event || !seat) return;
    if (event.status === "ended") { setState({ phase: "ended", error: "ended" }); return; }
    const stage = STAGES[event.stageIndex] || "warmup";
    const roundStartedMs = event.roundStartedAt?.toMillis?.();
    const roundEndsAt = roundStartedMs ? roundStartedMs + (event.roundDurationSec || ROUND_SECONDS) * 1000 : null;
    setState({
      phase: event.status === "lobby" ? "lobby" : "table",
      isDemo: false,
      eventName: event.name,
      tableNumber: seat.tableNumber,
      color: seat.color,
      role: seat.role,
      rolesEnabled: event.rolesEnabled,
      rotationMode: event.rotationMode,
      stageIndex: event.stageIndex || 0,
      roundIndex: event.roundIndex || 0,
      question: table?.question || makeQuestionState(event.seasonId, stage),
      roundEndsAt,
      finished: table?.status === "finished-early",
      showRotation: !!event.rotationAt && event.rotationAt.toMillis?.() > (Date.now() - 8000),
      broadcastMessage: event.broadcastMessage || table?.message || null,
    });
  }

  async function start() {
    try {
      seat = await assignSeat(eventId, user);
    } catch {
      setState({ phase: "error", error: "offline" });
      return;
    }
    unsubEvent = onSnapshot(doc(db, "sslEvents", eventId), (snap) => {
      if (!snap.exists()) { setState({ phase: "error", error: "not_found" }); return; }
      event = snap.data();
      if (unsubTable === null) {
        unsubTable = onSnapshot(doc(db, "sslEvents", eventId, "tables", seat.tableId), (tSnap) => {
          table = tSnap.data();
          computeAndPublish();
        });
      }
      computeAndPublish();
    }, () => setState({ phase: "error", error: "offline" }));
  }
  start();

  const tableRef = () => doc(db, "sslEvents", eventId, "tables", seat.tableId);
  const participantRef = () => doc(db, "sslEvents", eventId, "participants", user.uid);
  const eventRef = () => doc(db, "sslEvents", eventId);

  return {
    getState: () => state,
    subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    actions: {
      anotherQuestion: async () => {
        const stage = STAGES[event.stageIndex] || "warmup";
        await updateDoc(tableRef(), { question: { ...makeQuestionState(event.seasonId, stage), text: pickAnotherQuestion(event.seasonId, stage, table?.question?.text) } });
        await updateDoc(eventRef(), { promptRequests: increment(1) });
      },
      makeEasier: async () => {
        const c = getStageContent(event.seasonId, STAGES[event.stageIndex] || "warmup");
        await updateDoc(tableRef(), { question: { text: c.easier, phrases: c.phrases, level: "easier" } });
      },
      makeDeeper: async () => {
        const c = getStageContent(event.seasonId, STAGES[event.stageIndex] || "warmup");
        await updateDoc(tableRef(), { question: { text: c.deeper, phrases: c.phrases, level: "deeper" } });
      },
      weAreFinished: async () => { await updateDoc(tableRef(), { status: "finished-early" }); },
      submitConfidenceBefore: async (v) => { await setDoc(participantRef(), { confidenceBefore: v }, { merge: true }); },
      submitConfidenceAfter: async (v) => { await setDoc(participantRef(), { confidenceAfter: v }, { merge: true }); },
      enterTable: () => {}, // live events enter automatically once the host starts
      leave: () => {},
    },
    destroy: () => { unsubEvent?.(); unsubTable?.(); },
  };
}

// ── Demo (local, no network) ────────────────────────────────────────────────
// Simulates enough host behaviour (round timer, stage advance once every
// table is "finished") for one participant to experience the full Table Mode
// flow solo. Nothing here is written to Firestore.
export function createDemoController(seasonId, { rolesEnabled = true, rotationMode = "full" } = {}) {
  const listeners = new Set();
  const roleOrder = shuffle(ROLES.map((r) => r.id));
  let state = {
    isDemo: true,
    phase: "lobby",
    eventName: "Practice Table",
    code: "DEMO1",
    seasonId,
    tableNumber: 3,
    guestCount: 4,
    rolesEnabled,
    rotationMode,
    color: ROTATION_COLORS[Math.floor(Math.random() * ROTATION_COLORS.length)],
    stageIndex: 0,
    roundIndex: 1,
    role: rolesEnabled ? roleOrder[0] : null,
    question: makeQuestionState(seasonId, STAGES[0]),
    roundEndsAt: null,
    finished: false,
    showRotation: false,
    confidenceBefore: null,
    confidenceAfter: null,
  };
  const notify = () => listeners.forEach((cb) => cb(state));
  const setState = (patch) => { state = { ...state, ...patch }; notify(); };

  let timer = null;
  function startRound() {
    const endsAt = Date.now() + ROUND_SECONDS * 1000;
    setState({ roundEndsAt: endsAt, finished: false });
  }

  function enterTable() {
    setState({ phase: "table" });
    startRound();
  }

  function nextStage() {
    const nextIdx = state.stageIndex + 1;
    if (nextIdx >= STAGES.length) {
      setState({ phase: "complete" });
      return;
    }
    const role = state.rolesEnabled ? roleOrder[nextIdx % roleOrder.length] : null;
    setState({
      stageIndex: nextIdx, roundIndex: state.roundIndex + 1, role,
      question: makeQuestionState(state.seasonId, STAGES[nextIdx]),
      showRotation: false,
    });
    startRound();
  }

  return {
    getState: () => state,
    subscribe: (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    actions: {
      enterTable,
      anotherQuestion: () => setState({ question: { ...state.question, text: pickAnotherQuestion(state.seasonId, STAGES[state.stageIndex], state.question.text), level: "base" } }),
      makeEasier: () => {
        const c = getStageContent(state.seasonId, STAGES[state.stageIndex]);
        setState({ question: { text: c.easier, phrases: c.phrases, level: "easier" } });
      },
      makeDeeper: () => {
        const c = getStageContent(state.seasonId, STAGES[state.stageIndex]);
        setState({ question: { text: c.deeper, phrases: c.phrases, level: "deeper" } });
      },
      weAreFinished: () => {
        setState({ finished: true, showRotation: state.stageIndex < STAGES.length - 1 });
        clearTimeout(timer);
        timer = setTimeout(nextStage, 2600);
      },
      submitConfidenceBefore: (v) => setState({ confidenceBefore: v }),
      submitConfidenceAfter: (v) => setState({ confidenceAfter: v }),
      leave: () => clearTimeout(timer),
    },
    destroy: () => clearTimeout(timer),
  };
}

export { STAGES, ROLES, rotationInstruction };

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
