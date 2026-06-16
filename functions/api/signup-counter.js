// Cloudflare Pages Function — atomic signup counter

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const TOTAL_SPOTS = 200;

async function getCount(projectId, apiKey) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/meta/signups?key=${apiKey}`);
  if (res.status === 404) return 0;
  const doc = await res.json();
  return parseInt(doc.fields?.count?.integerValue ?? "0", 10);
}

async function atomicIncrement(projectId, apiKey) {
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ writes: [{ transform: {
        document: `projects/${projectId}/databases/(default)/documents/meta/signups`,
        fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
      }}]}),
    }
  );
  return await getCount(projectId, apiKey);
}

export async function onRequestGet(context) {
  const { env } = context;
  const count = await getCount(env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai", env.FIREBASE_API_KEY || "");
  return new Response(JSON.stringify({ count, spotsLeft: Math.max(0, TOTAL_SPOTS - count) }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const { env } = context;
  const PROJECT_ID = env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
  const API_KEY    = env.FIREBASE_API_KEY    || "";

  const current = await getCount(PROJECT_ID, API_KEY);
  if (current >= TOTAL_SPOTS) {
    return new Response(JSON.stringify({ count: current, spotsLeft: 0, full: true }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
  const next = await atomicIncrement(PROJECT_ID, API_KEY);
  return new Response(JSON.stringify({ count: next, spotsLeft: Math.max(0, TOTAL_SPOTS - next), spotNumber: next }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}
