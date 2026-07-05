const Anthropic = require("@anthropic-ai/sdk");
const crypto    = require("crypto");

const PROJECT_ID    = process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";
const FIREBASE_KEY  = process.env.FIREBASE_API_KEY    || "";
const FS_BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const PLAN_LIMITS = {
  // Active plans
  free:           5,
  individual:    50,
  family:       100,
  // Legacy plans (existing subscribers)
  phonics:       15,
  eiken:         15,
  sipswitch:     15,
  speak:         15,
  innerkey:      15,
  wondercamp:    15,
  kids_starter:  30,
  english_boost: 30,
  adult_growth:  30,
  adult_complete:30,
  family_core:   30,
  family_plus:   60,
  family_premium:100,
  all_access:   100,
};

// ── In-memory rate limit cache ─────────────────────────────────────────────
// Eliminates 2 Firestore ops per message. Persists for the lifetime of the
// Lambda instance (~15 min). Falls back to Firestore on cold start.
const memCache = new Map(); // key: `${uid}:${date}` → count

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function memKey(uid) { return `${uid}:${todayJST()}`; }

async function getCount(uid) {
  const key = memKey(uid);
  if (memCache.has(key)) return memCache.get(key);

  // Cold start — read from Firestore once, then cache
  try {
    const res  = await fetch(`${FS_BASE}/users/${uid}/chatUsage/${todayJST()}?key=${FIREBASE_KEY}`);
    if (res.status === 404) { memCache.set(key, 0); return 0; }
    const doc  = await res.json();
    const count = parseInt(doc.fields?.count?.integerValue ?? "0", 10);
    memCache.set(key, count);
    return count;
  } catch {
    return 0;
  }
}

async function incrementCount(uid) {
  const key   = memKey(uid);
  const next  = (memCache.get(key) ?? 0) + 1;
  memCache.set(key, next);

  // Write to Firestore async — don't await, don't block the response
  fetch(`${FS_BASE}/users/${uid}/chatUsage/${todayJST()}?key=${FIREBASE_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-HTTP-Method-Override": "PATCH" },
  }).catch(() => {});

  // Atomic increment via Firestore field transform
  fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/chatUsage/${todayJST()}:commit?key=${FIREBASE_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [{
          transform: {
            document: `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}/chatUsage/${todayJST()}`,
            fieldTransforms: [{ fieldPath: "count", increment: { integerValue: "1" } }],
          },
        }],
      }),
    }
  ).catch(() => {});

  return next;
}

// ── AI response cache ──────────────────────────────────────────────────────
// Cache common Q&A in Firestore. 40% token reduction at scale.
function hashMessages(system, messages) {
  const str = system + JSON.stringify(messages.slice(-2)); // last 2 turns
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, 16);
}

async function getCachedResponse(hash) {
  try {
    const res = await fetch(`${FS_BASE}/aiCache/${hash}?key=${FIREBASE_KEY}`);
    if (!res.ok) return null;
    const doc = await res.json();
    const ttl = parseInt(doc.fields?.ttl?.integerValue ?? "0", 10);
    if (Date.now() > ttl) return null; // expired
    return doc.fields?.response?.stringValue ?? null;
  } catch { return null; }
}

async function setCachedResponse(hash, response) {
  const ttl = Date.now() + 24 * 60 * 60 * 1000; // 24h TTL
  fetch(`${FS_BASE}/aiCache/${hash}?updateMask.fieldPaths=response&updateMask.fieldPaths=ttl&key=${FIREBASE_KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        response: { stringValue: response },
        ttl:      { integerValue: String(ttl) },
      },
    }),
  }).catch(() => {});
}

// ── Token verification ─────────────────────────────────────────────────────
async function verifyIdToken(idToken) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0] ?? null;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { system, messages, idToken, plan = "free" } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "messages array is required" }) };
  }

  // ── Auth + rate limit — idToken is required ───────────────────────────
  if (!idToken) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  }

  let uid = null;
  try {
    const firebaseUser = await verifyIdToken(idToken);
    if (!firebaseUser) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid session. Please sign in again." }) };
    }
    uid = firebaseUser.localId;
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const count = await getCount(uid);

    if (count >= limit) {
      return {
        statusCode: 429,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({
          error:   "daily_limit_reached",
          count, limit,
          message: plan === "all_access"
            ? "You've reached today's message limit. Resets at midnight Japan time."
            : `You've used all ${limit} messages for today. Upgrade for more daily conversations.`,
        }),
      };
    }
  } catch (e) {
    console.error("Auth/rate-limit error:", e.message);
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication failed. Please sign in again." }) };
  }

  // ── AI cache check ─────────────────────────────────────────────────────
  const cacheHash = hashMessages(system || "", messages || []);
  const cached    = await getCachedResponse(cacheHash);
  if (cached) {
    // Cache hit — increment counter but skip Claude API entirely
    if (uid) await incrementCount(uid);
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ content: cached, cached: true }),
    };
  }

  // ── Claude API ─────────────────────────────────────────────────────────
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system:     system || "You are Jona, the HSD OS AI English learning assistant.",
      messages:   messages || [],
    });

    const text = response.content[0].text;

    // Increment counter and cache response (both non-blocking)
    if (uid) incrementCount(uid);
    setCachedResponse(cacheHash, text);

    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    };
  } catch (err) {
    console.error("Claude error:", err.message);
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "AI service temporarily unavailable. Please try again." }),
    };
  }
};
