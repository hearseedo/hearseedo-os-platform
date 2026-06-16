// Shared signup counter — atomic Firestore increment (no race condition)
// GET  → returns { count, spotsLeft }
// POST → atomically increments, returns { count, spotsLeft, spotNumber }

const PROJECT_ID  = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const API_KEY     = process.env.FIREBASE_API_KEY    || "";
const FS_BASE     = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const TOTAL_SPOTS = 200;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function getCount() {
  const res = await fetch(`${FS_BASE}/meta/signups?key=${API_KEY}`);
  if (res.status === 404) return 0;
  const doc = await res.json();
  return parseInt(doc.fields?.count?.integerValue ?? "0", 10);
}

async function atomicIncrement() {
  // Firestore field transform increment — atomic, no read-modify-write race
  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: `projects/${PROJECT_ID}/databases/(default)/documents/meta/signups`,
            fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
          },
        }],
      }),
    }
  );
  if (!res.ok) throw new Error(`Firestore increment failed: ${res.status}`);
  // Read back the new value
  return await getCount();
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  try {
    if (event.httpMethod === "GET") {
      const count = await getCount();
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ count, spotsLeft: Math.max(0, TOTAL_SPOTS - count) }),
      };
    }

    if (event.httpMethod === "POST") {
      const current = await getCount();
      if (current >= TOTAL_SPOTS) {
        return {
          statusCode: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
          body: JSON.stringify({ count: current, spotsLeft: 0, full: true }),
        };
      }
      const next = await atomicIncrement();
      return {
        statusCode: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ count: next, spotsLeft: Math.max(0, TOTAL_SPOTS - next), spotNumber: next }),
      };
    }

    return { statusCode: 405, headers: CORS, body: "Method not allowed" };
  } catch (err) {
    console.error("signup-counter error:", err);
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ count: 0, spotsLeft: TOTAL_SPOTS, error: err.message }),
    };
  }
};
