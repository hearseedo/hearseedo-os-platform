// Talk with Jona (Gemini Live) — Gate B Stage 4: asynchronous transcript
// safety supervision. See
// docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_FINAL_ARCHITECTURE_2026-09-28.md §1/§3/§4
// and docs/JONA_LIVE_SAFETY_GATE_B_STAGE3_REVISION_2026-09-29.md §1-§4 for
// the approved architecture this implements.
//
// Called by the browser once per transcript chunk it receives from Gemini
// Live's inputAudioTranscription (text only, never audio). This NEVER sits
// on Jona's normal audio response path — the browser calls this fire-and-
// forget alongside playing Gemini's realtime reply, not before it.
//
// Hardening this endpoint specifically implements (Stage 4 spec item 3):
//   - duplicate transcript chunks: deduped by chunkId via an atomic
//     "create only if absent" write, same pattern
//     record-curriculum-progress.js already uses for eventId idempotency.
//   - partial/final transcript confusion: only isFinal:true chunks are
//     classified; partial chunks are acknowledged but never scored (an
//     unfinished sentence is not something a classifier should judge).
//   - out-of-order classifier results / a slower older verdict overwriting
//     a newer higher-risk state: the session-state write is a genuine
//     compare-and-swap against the document's current updateTime (via the
//     :commit API's currentDocument precondition), re-read-and-retried on
//     conflict — never a blind PATCH that could clobber a concurrently
//     written higher tier.
//   - profile/session mismatch: the session doc's own stored profileId
//     must match the caller's claimed profileId (self-vs-self, or an exact
//     match) before any classification happens.
//   - replay: covered by the same chunkId dedupe (a replayed chunk is
//     just a duplicate chunkId) plus the session-must-not-be-ended check.
//
// Malformed/invalid classifier output is treated as a supervisor failure
// (§5/§8's failure-policy thresholds), never silently as NORMAL.

const { firestoreFetch, fromFirestoreFields, createIfAbsent, PROJECT_ID } = require("./_firebaseAdmin");
const { isSelfProfileId } = require("./_profileContext");
const { classify, SafetyClassificationError } = require("./_safetyEngine");
const { nextSessionState, interventionDirectiveFor } = require("./_safetyPolicy");

const FIREBASE_KEY = process.env.FIREBASE_API_KEY || "";
const POLICY_VERSION = "gate-b-stage4-2026-09-29";
const CLASSIFIER_VERSION = "gemini-2.5-flash-safety-v1";

// Supervisor failure thresholds (Stage 3 §5, unchanged by the revision).
const DEGRADED_AFTER_CONSECUTIVE_FAILURES = 2;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function verifyIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0] ?? null;
}

function profileIdsMatch(a, b) {
  if (isSelfProfileId(a) && isSelfProfileId(b)) return true;
  return a === b;
}

function docResourceName(uid, sessionId) {
  return `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/liveSessions/${sessionId}`;
}

function toFsTimestamp(date) {
  return { timestampValue: date.toISOString() };
}

// Compare-and-swap session-state write. Re-reads and retries on a
// precondition conflict (another classify call for a different chunk of
// the same session wrote in between) so an out-of-order or slower verdict
// can never blindly overwrite a newer, higher-risk state written by a
// faster/later call — each attempt recomputes newState against the
// CURRENT persisted tier, not a stale value read at the start of this
// request.
async function applyClassificationToSession({ uid, sessionId, classification, maxAttempts = 3 }) {
  const path = `/users/${uid}/liveSessions/${sessionId}`;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await firestoreFetch(path);
    if (!res.ok) throw new Error(`live-transcript-classify: session doc not found for ${uid}/${sessionId}`);
    const doc = await res.json();
    const existing = fromFirestoreFields(doc.fields ?? {});

    if (existing.endedAt) {
      // Session already ended — never write a safety state onto a closed
      // session doc (this also naturally rejects replay of a chunk after
      // the session the child was in has already finished).
      return { skipped: true, reason: "session_ended" };
    }

    const currentState = {
      tier: existing.safetyTier || "NORMAL",
      consecutiveNormalCount: Number.isInteger(existing.safetyConsecutiveNormalCount) ? existing.safetyConsecutiveNormalCount : 0,
      awaitingClarification: Boolean(existing.safetyAwaitingClarification),
    };

    const newState = nextSessionState(currentState, classification);
    const escalated = newState.escalated;
    const directive = escalated ? interventionDirectiveFor(newState.tier) : null;

    const fields = {
      safetyTier: { stringValue: newState.tier },
      safetyConsecutiveNormalCount: { integerValue: String(newState.consecutiveNormalCount) },
      safetyAwaitingClarification: { booleanValue: newState.awaitingClarification },
      policyVersion: { stringValue: POLICY_VERSION },
      classifierVersion: { stringValue: CLASSIFIER_VERSION },
    };
    const fieldPaths = ["safetyTier", "safetyConsecutiveNormalCount", "safetyAwaitingClarification", "policyVersion", "classifierVersion"];

    if (escalated) {
      fields.safetyTierReachedAt = toFsTimestamp(new Date());
      fieldPaths.push("safetyTierReachedAt");
    }
    if (directive) {
      fields.interventionDirective = {
        mapValue: { fields: { action: { stringValue: directive.action }, createdAt: toFsTimestamp(new Date()) } },
      };
      fieldPaths.push("interventionDirective");
    }

    const commitRes = await firestoreFetch(":commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          update: { name: docResourceName(uid, sessionId), fields },
          updateMask: { fieldPaths },
          currentDocument: { updateTime: doc.updateTime },
        }],
      }),
    });

    if (commitRes.ok) {
      return { skipped: false, state: newState, directive };
    }

    // Precondition failed (someone else wrote in between) — retry against
    // a fresh read rather than surfacing a spurious failure to the caller.
    if (attempt === maxAttempts - 1) {
      throw new Error("live-transcript-classify: session-state write lost the race too many times");
    }
  }
}

async function recordSupervisorFailure(uid, sessionId, reason) {
  try {
    const path = `/users/${uid}/liveSessions/${sessionId}`;
    const res = await firestoreFetch(path);
    if (!res.ok) return;
    const doc = await res.json();
    const existing = fromFirestoreFields(doc.fields ?? {});
    const priorFailures = Number.isInteger(existing.supervisorConsecutiveFailures) ? existing.supervisorConsecutiveFailures : 0;
    const consecutiveFailures = priorFailures + 1;
    const status = consecutiveFailures >= DEGRADED_AFTER_CONSECUTIVE_FAILURES ? "degraded" : "ok";

    const fields = {
      supervisorConsecutiveFailures: { integerValue: String(consecutiveFailures) },
      supervisorStatus: { stringValue: status },
      supervisorLastFailureReason: { stringValue: String(reason).slice(0, 200) },
    };
    const fieldPaths = ["supervisorConsecutiveFailures", "supervisorStatus", "supervisorLastFailureReason"];
    if (status === "degraded" && existing.supervisorStatus !== "degraded") {
      fields.supervisorDegradedAt = toFsTimestamp(new Date());
      fieldPaths.push("supervisorDegradedAt");
    }

    await firestoreFetch(":commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          update: { name: docResourceName(uid, sessionId), fields },
          updateMask: { fieldPaths },
        }],
      }),
    });
  } catch (e) {
    console.error("live-transcript-classify: failed to record supervisor failure (non-blocking):", e.message);
  }
}

async function resetSupervisorFailures(uid, sessionId) {
  try {
    await firestoreFetch(":commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          update: {
            name: docResourceName(uid, sessionId),
            fields: { supervisorConsecutiveFailures: { integerValue: "0" }, supervisorStatus: { stringValue: "ok" } },
          },
          updateMask: { fieldPaths: ["supervisorConsecutiveFailures", "supervisorStatus"] },
        }],
      }),
    });
  } catch (e) {
    console.error("live-transcript-classify: failed to reset supervisor failures (non-blocking):", e.message);
  }
}

// Metadata-only latency instrumentation (Stage 3 Revision §3). Durations
// and timestamps only — never transcript text.
async function logLatency(uid, sessionId, chunkId, timestamps) {
  try {
    await firestoreFetch(`/users/${uid}/liveSessions/${sessionId}/latencyLog/${chunkId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(timestamps)
            .filter(([, v]) => Number.isFinite(v))
            .map(([k, v]) => [k, { integerValue: String(Math.round(v)) }])
        ),
      }),
    });
  } catch (e) {
    console.error("live-transcript-classify: latency logging failed (non-blocking):", e.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  const receivedAt = Date.now();

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const {
    idToken, sessionId, profileId, chunkId, text, isFinal, lang, priorTurnsContext,
    speechEndAt, transcriptAvailableAt,
  } = body;

  if (!idToken || !sessionId || !chunkId) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "sessionId and chunkId are required." }) };
  }

  const firebaseUser = await verifyIdToken(idToken);
  if (!firebaseUser) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
  }
  const uid = firebaseUser.localId;

  // Session must exist under THIS uid (path-scoped — no value of sessionId
  // a caller supplies reaches another account's session, by construction).
  let sessionDoc;
  try {
    const res = await firestoreFetch(`/users/${uid}/liveSessions/${sessionId}`);
    if (!res.ok) return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Session not found." }) };
    sessionDoc = fromFirestoreFields((await res.json()).fields ?? {});
  } catch {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Could not verify session." }) };
  }

  if (sessionDoc.endedAt) {
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ skipped: true, reason: "session_ended" }) };
  }

  // Profile/session mismatch guard (Stage 4 spec item 3).
  if (!profileIdsMatch(sessionDoc.profileId, profileId)) {
    return { statusCode: 403, headers: CORS, body: JSON.stringify({ error: "Profile does not match this session." }) };
  }

  // Duplicate/replay guard — atomic create-only-if-absent, same shape
  // record-curriculum-progress.js already relies on for eventId idempotency.
  const dedupeOk = await createIfAbsent(
    `/users/${uid}/liveSessions/${sessionId}/processedChunks/${String(chunkId).slice(0, 200)}`,
    { processedAt: { timestampValue: new Date().toISOString() } }
  );
  if (!dedupeOk) {
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ duplicate: true }) };
  }

  // Partial transcript chunks are acknowledged but never classified — an
  // unfinished sentence should not be judged.
  if (isFinal !== true) {
    return { statusCode: 200, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ skipped: true, reason: "not_final" }) };
  }

  const classifierDispatchedAt = Date.now();
  let classification;
  try {
    classification = await classify(
      { text, lang, priorTurnsContext: Array.isArray(priorTurnsContext) ? priorTurnsContext.slice(-3) : [] },
      {}
    );
  } catch (e) {
    // Malformed/invalid/unavailable classifier output is a SUPERVISOR
    // FAILURE, never silently treated as NORMAL (explicit instruction).
    const reason = e instanceof SafetyClassificationError ? e.message : `unexpected error: ${e.message}`;
    console.error("live-transcript-classify: classification failed:", reason);
    await recordSupervisorFailure(uid, sessionId, reason);
    return { statusCode: 502, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "supervisor_failure", reason: "classification_failed" }) };
  }
  const classifierVerdictAt = Date.now();

  // A successful classification clears any prior failure streak.
  await resetSupervisorFailures(uid, sessionId);

  let applyResult;
  try {
    applyResult = await applyClassificationToSession({ uid, sessionId, classification });
  } catch (e) {
    console.error("live-transcript-classify: state write failed:", e.message);
    return { statusCode: 500, headers: { ...CORS, "Content-Type": "application/json" }, body: JSON.stringify({ error: "Could not record safety state." }) };
  }

  logLatency(uid, sessionId, chunkId, {
    receivedAt,
    classifierDispatchedAt,
    classifierVerdictAt,
    speechEndToTranscriptAvailableMs: Number.isFinite(speechEndAt) && Number.isFinite(transcriptAvailableAt) ? transcriptAvailableAt - speechEndAt : null,
    classifierComputeMs: classifierVerdictAt - classifierDispatchedAt,
  }).catch(() => {});

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({
      skipped: Boolean(applyResult?.skipped),
      tier: applyResult?.state?.tier ?? classification.tier,
      escalated: Boolean(applyResult?.state?.escalated),
    }),
  };
};

module.exports.__testables = { profileIdsMatch, applyClassificationToSession, recordSupervisorFailure };
