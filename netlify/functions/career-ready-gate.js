// Career Ready — usage gate
// POST { uid, type: "interview"|"writing", action: "check"|"use" }
// Returns { allowed, used, limit, remaining }

const PROJECT_ID   = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY = process.env.FIREBASE_API_KEY    || "";
const FS_BASE      = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const LIMITS = { interview: 30, writing: 50 };

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getUsage(uid, month) {
  try {
    const r = await fetch(`${FS_BASE}/users/${uid}/careerReady/${month}?key=${FIREBASE_KEY}`);
    if (!r.ok) return { interviewSessions: 0, writingSessions: 0 };
    const doc = await r.json();
    const f   = doc.fields ?? {};
    return {
      interviewSessions: parseInt(f.interviewSessions?.integerValue ?? "0", 10),
      writingSessions:   parseInt(f.writingSessions?.integerValue   ?? "0", 10),
    };
  } catch { return { interviewSessions: 0, writingSessions: 0 }; }
}

async function incrementUsage(uid, month, field) {
  await fetch(`${FS_BASE}:commit?key=${FIREBASE_KEY}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      writes: [{ transform: {
        document: `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/careerReady/${month}`,
        fieldTransforms: [
          { fieldPath: field,   increment: { integerValue: "1" } },
          { fieldPath: "month", setToServerValue: "REQUEST_TIME"  },
        ],
      }}],
    }),
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { uid, type, action } = body;
  if (!uid || !type || !action) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "uid, type, action required" }) };
  }
  if (!LIMITS[type]) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unknown type: ${type}` }) };
  }

  const month   = monthKey();
  const limit   = LIMITS[type];
  const usage   = await getUsage(uid, month);
  const field   = type === "interview" ? "interviewSessions" : "writingSessions";
  const used    = usage[field];
  const allowed = used < limit;

  if (action === "use") {
    if (!allowed) {
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ allowed: false, used, limit, remaining: 0 }),
      };
    }
    await incrementUsage(uid, month, field);
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: true, used: used + 1, limit, remaining: limit - used - 1 }),
    };
  }

  // action === "check"
  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({ allowed, used, limit, remaining: limit - used }),
  };
};
