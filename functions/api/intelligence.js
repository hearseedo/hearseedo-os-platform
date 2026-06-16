// HSD OS – Intelligence Endpoint
// Apps push learning events to the OS. The OS updates the unified learner profile.
// This is the integration point for both HSD apps and future third-party apps.

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const VALID_EVENTS = [
  "lesson_completed",
  "challenge_completed",
  "skill_practiced",
  "confidence_reported",
  "milestone_reached",
  "session_started",
  "session_ended",
  "mistake_detected",
  "breakthrough_moment",
  "goal_set",
  "goal_achieved",
  "reflection_written",
  "habit_completed",
];

const SKILL_DELTAS = {
  lesson_completed:      { all: 3 },
  challenge_completed:   { all: 5 },
  breakthrough_moment:   { all: 8 },
  habit_completed:       { all: 2 },
};

async function verifyIdToken(idToken, firebaseKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0] ?? null;
}

async function getLearnerProfile(projectId, apiKey, uid) {
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}?key=${apiKey}`
  );
  if (res.status === 404) return null;
  const doc = await res.json();
  if (!doc.fields) return null;

  return {
    totalInteractions: parseInt(doc.fields.totalInteractions?.integerValue ?? "0", 10),
    confidenceScore:   parseInt(doc.fields.confidenceScore?.integerValue ?? "50", 10),
    engagementScore:   parseInt(doc.fields.engagementScore?.integerValue ?? "50", 10),
  };
}

async function patchLearnerProfile(projectId, apiKey, uid, fields) {
  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${f}`).join("&");
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}?${mask}&key=${apiKey}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
    }
  ).catch(console.error);
}

async function saveInteractionEvent(projectId, apiKey, uid, eventData) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/learnerProfiles/${uid}/interactions/${id}?key=${apiKey}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          appId:     { stringValue: eventData.appId },
          event:     { stringValue: eventData.event },
          data:      { stringValue: JSON.stringify(eventData.data ?? {}) },
          timestamp: { stringValue: new Date().toISOString() },
        },
      }),
    }
  ).catch(console.error);
}

async function updatePlatformAnalytics(projectId, apiKey, eventType) {
  const fieldPath = `events.${eventType}`;
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: `projects/${projectId}/databases/(default)/documents/analytics/platform`,
            fieldTransforms: [
              { fieldPath: "totalEvents", increment: { integerValue: "1" } },
              { fieldPath, increment: { integerValue: "1" } },
            ],
          },
        }],
      }),
    }
  ).catch(console.error);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const FIREBASE_KEY = env.FIREBASE_API_KEY;
  const PROJECT_ID   = env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: CORS }); }

  const { idToken, appId, event, data } = body;

  if (!idToken || !appId || !event) {
    return new Response(JSON.stringify({ error: "Missing required fields: idToken, appId, event" }), { status: 400, headers: CORS });
  }

  if (!VALID_EVENTS.includes(event)) {
    return new Response(JSON.stringify({ error: `Unknown event: ${event}. Valid: ${VALID_EVENTS.join(", ")}` }), { status: 400, headers: CORS });
  }

  // Verify auth
  const user = await verifyIdToken(idToken, FIREBASE_KEY);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
  }
  const uid = user.localId;

  // Get current profile
  const profile = await getLearnerProfile(PROJECT_ID, FIREBASE_KEY, uid) ?? { totalInteractions: 0, confidenceScore: 50, engagementScore: 50 };

  // Compute confidence impact
  const skillDelta  = SKILL_DELTAS[event]?.all ?? 1;
  const newConfidence = Math.min(100, profile.confidenceScore + Math.round(skillDelta * 0.5));

  // Build skill updates from event data
  const skillUpdates = {};
  if (data?.skills) {
    for (const [skill, delta] of Object.entries(data.skills)) {
      skillUpdates[`skills.${skill}`] = { integerValue: String(Math.min(100, Math.max(0, 50 + delta))) };
    }
  }

  // Patch learner profile (non-blocking)
  patchLearnerProfile(PROJECT_ID, FIREBASE_KEY, uid, {
    confidenceScore:   { integerValue: String(newConfidence) },
    totalInteractions: { integerValue: String(profile.totalInteractions + 1) },
    [`appUsage.${appId}`]: { integerValue: String(1) }, // simplified — would need increment
    updatedAt: { stringValue: new Date().toISOString() },
    ...skillUpdates,
  });

  // Save event to interaction log
  saveInteractionEvent(PROJECT_ID, FIREBASE_KEY, uid, { appId, event, data });

  // Platform analytics
  updatePlatformAnalytics(PROJECT_ID, FIREBASE_KEY, event);

  return new Response(JSON.stringify({
    received:        true,
    uid,
    event,
    confidenceScore: newConfidence,
  }), { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
