// Workbook bonus code redemption
// Validates a Monkey Yoga Phonics workbook code server-side and writes
// a 1-month phonics access grant to the user's Firestore profile.
// Codes are NEVER exposed to the client.

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Server-side only — never sent to client
const VALID_CODES = {
  "MYP-WORKBOOK-HSD": { bookNumber: 1, bookName: "Monkey Yoga Phonics Workbook" },
  "MTU-WORKBOOK-HSD": { bookNumber: 2, bookName: "MTU Series Workbook" },
};

async function verifyIdToken(idToken, firebaseApiKey) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.users?.[0]?.localId ?? null;
}

// Write workbook bonus fields to Firestore using the user's own ID token
async function writeWorkbookBonus(uid, idToken, code, bookNumber, projectId) {
  const startDate = new Date();
  const endDate   = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  const fields = {
    workbookBonusRedeemed:  { booleanValue: true },
    redeemedWorkbookCode:   { stringValue: code },
    workbookBookNumber:     { integerValue: String(bookNumber) },
    workbookBonusStartDate: { timestampValue: startDate.toISOString() },
    workbookBonusEndDate:   { timestampValue: endDate.toISOString() },
    workbookAccessStatus:   { stringValue: "free_trial" },
    convertedFromWorkbookCode: { booleanValue: false },
  };

  const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
  const url  = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}?${mask}`;

  const res = await fetch(url, {
    method:  "PATCH",
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ fields }),
  });

  return res.ok;
}

// Write to admin redemption log (uses service account if available, else skips)
async function logRedemption(uid, email, code, bookNumber, projectId, idToken) {
  const startDate = new Date();
  const endDate   = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  const logData = {
    fields: {
      uid:             { stringValue: uid },
      email:           { stringValue: email ?? "" },
      code:            { stringValue: code },
      bookNumber:      { integerValue: String(bookNumber) },
      redeemedAt:      { timestampValue: startDate.toISOString() },
      freeMonthStart:  { timestampValue: startDate.toISOString() },
      freeMonthEnd:    { timestampValue: endDate.toISOString() },
      convertedToPaid: { booleanValue: false },
      becameFounder:   { booleanValue: false },
    }
  };

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/workbookRedemptions`;
  await fetch(url, {
    method:  "POST",
    headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify(logData),
  }).catch(() => {}); // non-blocking
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;
  const PROJECT_ID       = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "hear-see-do-os-ai";

  if (!FIREBASE_API_KEY) {
    return { statusCode: 503, headers: CORS, body: JSON.stringify({ error: "Server not configured" }) };
  }

  let idToken, code;
  try {
    const body = JSON.parse(event.body || "{}");
    idToken = body.idToken;
    code    = (body.code || "").toUpperCase().trim();
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid request" }) };
  }

  if (!idToken || !code) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "idToken and code are required" }) };
  }

  // Verify ID token
  const uid = await verifyIdToken(idToken, FIREBASE_API_KEY);
  if (!uid) {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session" }) };
  }

  // Validate code (server-side only)
  const codeData = VALID_CODES[code];
  if (!codeData) {
    return {
      statusCode: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid code. Please check your workbook and try again." }),
    };
  }

  // Check if user already redeemed a code by reading their profile
  const profileUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  const profileRes = await fetch(profileUrl, {
    headers: { "Authorization": `Bearer ${idToken}` },
  });
  if (profileRes.ok) {
    const profileData = await profileRes.json();
    const alreadyRedeemed = profileData.fields?.workbookBonusRedeemed?.booleanValue;
    if (alreadyRedeemed) {
      return {
        statusCode: 409,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "A workbook bonus code has already been redeemed on this account." }),
      };
    }
  }

  // Write bonus to user profile
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  const email = profileRes.ok ? profileData?.fields?.email?.stringValue : null;

  const written = await writeWorkbookBonus(uid, idToken, code, codeData.bookNumber, PROJECT_ID);
  if (!written) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to activate code. Please try again." }) };
  }

  // Non-blocking admin log
  logRedemption(uid, email, code, codeData.bookNumber, PROJECT_ID, idToken);

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({
      success:    true,
      bookNumber: codeData.bookNumber,
      bookName:   codeData.bookName,
      endDate:    endDate.toISOString(),
    }),
  };
};
