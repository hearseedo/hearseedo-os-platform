// Workbook bonus code redemption
// Validates a Monkey Yoga Phonics workbook code server-side and writes
// a 1-month phonics access grant to the user's Firestore profile.
// Codes are NEVER exposed to the client.
//
// The workbookBonus* fields are privileged (access-granting) fields per
// firestore.rules (Phase 0 security hardening, 2026-09-09), so the write
// below now goes through the service-account-authenticated firestoreFetch
// (_firebaseAdmin.js) rather than the caller's own ID token — a plain user
// bearer token no longer has permission to touch these fields, by design.
const { verifyIdToken, firestoreFetch } = require("./_firebaseAdmin");

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

// Write workbook bonus fields to Firestore via the service account
async function writeWorkbookBonus(uid, code, bookNumber) {
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
  const res  = await firestoreFetch(`/users/${uid}?${mask}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ fields }),
  });

  return res.ok;
}

// Write to admin redemption log via the service account (non-blocking)
async function logRedemption(uid, email, code, bookNumber) {
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

  await firestoreFetch("/workbookRedemptions", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(logData),
  }).catch(() => {}); // non-blocking
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

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
  let uid;
  try {
    uid = await verifyIdToken(idToken);
  } catch {
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

  // Check if user already redeemed a code by reading their profile.
  // (Fixed a pre-existing bug here: profileData was previously declared
  // inside the `if (profileRes.ok)` block but referenced outside it further
  // down — a ReferenceError that would have thrown on every redemption
  // attempt where the read succeeded, i.e. essentially always.)
  let profileData = null;
  const profileRes = await firestoreFetch(`/users/${uid}`);
  if (profileRes.ok) {
    profileData = await profileRes.json();
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

  const email = profileData?.fields?.email?.stringValue ?? null;

  const written = await writeWorkbookBonus(uid, code, codeData.bookNumber);
  if (!written) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to activate code. Please try again." }) };
  }

  // Non-blocking admin log
  logRedemption(uid, email, code, codeData.bookNumber);

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
