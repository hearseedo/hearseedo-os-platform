// HSD OS — App Learning Event Tracker
// Called by individual apps when used standalone (not inside the OS iframe).
// Writes learning data to Firestore learnerProfiles via the REST API.

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const PROJECT_ID = "hear-see-do-os-ai";
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const SKILL_MAP = {
  eiken:      ["vocabulary", "reading", "listening", "speaking"],
  phonics:    ["pronunciation", "reading", "listening"],
  speak:      ["speaking", "grammar"],
  sipswitch:  ["listening", "speaking", "vocabulary"],
  wondercamp: ["vocabulary", "reading", "grammar"],
  family:     ["speaking", "listening", "vocabulary"],
  innerkey:   ["mindset", "speaking"],
};

async function fsGet(path) {
  const res = await fetch(`${FS_BASE}/${path}?key=${process.env.FIREBASE_API_KEY}`);
  if (!res.ok) return null;
  return (await res.json()).fields ?? null;
}

async function fsPatch(path, fields, updateMask) {
  const mask = updateMask.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
  const res  = await fetch(
    `${FS_BASE}/${path}?${mask}&key=${process.env.FIREBASE_API_KEY}`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) }
  );
  return res.ok;
}

async function fsCreate(path, fields) {
  const res = await fetch(
    `${FS_BASE}/${path}?key=${process.env.FIREBASE_API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }) }
  );
  return res.ok;
}

function intVal(v)  { return { integerValue: String(v) }; }
function strVal(v)  { return { stringValue: String(v) }; }
function boolVal(v) { return { booleanValue: Boolean(v) }; }
function nullVal()  { return { nullValue: null }; }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { sso_token: uid, appId = "unknown", lessonType = "practice", xp = 0, isCorrect = true, score } = body;

  if (!uid) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Missing sso_token" }) };

  try {
    const profile = await fsGet(`learnerProfiles/${uid}`);
    if (!profile) {
      return { statusCode: 404, headers: CORS, body: JSON.stringify({ error: "Learner profile not found" }) };
    }

    const totalInteractions = (parseInt(profile.totalInteractions?.integerValue ?? 0)) + 1;
    const prevEngagement    = parseInt(profile.engagementScore?.integerValue ?? 50);
    const engagementDelta   = isCorrect ? Math.min(xp / 4, 15) : 5;
    const newEngagement     = Math.round(prevEngagement * 0.85 + (prevEngagement + engagementDelta) * 0.15);

    // App usage increment
    const prevAppCount = parseInt(profile.appUsage?.mapValue?.fields?.[appId]?.integerValue ?? 0);
    const now          = new Date().toISOString();
    const today        = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

    // Skill updates
    const skills          = profile.skills?.mapValue?.fields ?? {};
    const relevantSkills  = SKILL_MAP[appId] ?? ["vocabulary"];
    const updatedSkills   = {};
    for (const skill of relevantSkills) {
      const prev = parseInt(skills[skill]?.integerValue ?? 50);
      updatedSkills[skill] = intVal(Math.max(0, Math.min(100, prev + (isCorrect ? 2 : -1))));
    }

    // Write interaction
    await fsCreate(`learnerProfiles/${uid}/interactions`, {
      appId:           strVal(appId),
      lessonType:      strVal(lessonType),
      xp:              intVal(xp),
      isCorrect:       boolVal(isCorrect),
      score:           score != null ? intVal(score) : nullVal(),
      engagementScore: intVal(Math.round(prevEngagement + engagementDelta)),
      confidenceImpact: intVal(isCorrect ? Math.round(engagementDelta) : -2),
      signals:         { arrayValue: { values: [strVal(isCorrect ? "lesson_correct" : "lesson_attempted")] } },
      timestamp:       strVal(now),
    });

    // Update learner profile
    const updateFields = {
      totalInteractions: intVal(totalInteractions),
      engagementScore:   intVal(newEngagement),
      updatedAt:         strVal(now),
      [`appUsage.${appId}`]: intVal(prevAppCount + 1),
    };
    for (const [k, v] of Object.entries(updatedSkills)) {
      updateFields[`skills.${k}`] = v;
    }

    await fsPatch(`learnerProfiles/${uid}`, updateFields, Object.keys(updateFields));

    // Daily confidence snapshot (only first event of day)
    const histPath = `learnerProfiles/${uid}/confidenceHistory/${today}`;
    const existing = await fsGet(histPath);
    if (!existing) {
      await fsPatch(histPath, {
        date:      strVal(today),
        score:     intVal(parseInt(profile.confidenceScore?.integerValue ?? 50)),
        timestamp: strVal(now),
      }, ["date", "score", "timestamp"]);
    }

    console.log("TRACK_EVENT", JSON.stringify({ uid, appId, lessonType, xp, isCorrect, totalInteractions }));

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, totalInteractions, newEngagement }),
    };
  } catch (err) {
    console.error("track-event error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Internal error" }) };
  }
};
