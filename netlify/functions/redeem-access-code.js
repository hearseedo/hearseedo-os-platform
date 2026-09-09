// Free-month access-code redemption — validated and written server-side.
//
// Previously src/lib/accessCodeUtils.js wrote the resulting `accessPass`
// object (which sets hasFullPlatformAccess: true) directly from the client
// via updateDoc(). accessPass is a privileged, access-granting field, so as
// of the Phase 0 security hardening (2026-09-09) firestore.rules denies
// client writes to it — this endpoint replaces that direct write, verifying
// the caller's Firebase ID token and writing via the service account
// (_firebaseAdmin.js), same pattern as redeem-workbook-code.js.
const { verifyIdToken, firestoreFetch, toFirestoreValue } = require("./_firebaseAdmin");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Mirrors src/constants/accessCodes.js. Kept in sync manually — these codes
// are already visible in the client bundle (they're simple free-trial
// coupon codes, not secrets), so duplicating them here is only about moving
// the *validation + write* server-side, not about hiding the code list.
const ACCESS_CODES = {
  "KINDER-HSD-2026":  { codeType: "Kindergarten Access Code", source: "kindergarten",            campaignCategory: "Kindergarten",           campaignName: "Kindergarten Family Access Campaign",         accessDays: 30, aiCredits: 30,  active: true },
  "UNI-READY-HSD":    { codeType: "University Access Code",   source: "university",               campaignCategory: "University",             campaignName: "University Full Platform Access Campaign",   accessDays: 30, aiCredits: 30,  active: true },
  "FAMILY-HSD-2026":  { codeType: "Family Access Code",       source: "family",                   campaignCategory: "Family",                 campaignName: "Family Free Month Campaign",                  accessDays: 30, aiCredits: 30,  active: true },
  "TEACHER-HSD-2026": { codeType: "Teacher Access Code",      source: "teacher",                  campaignCategory: "Teacher",                campaignName: "Teacher Access Campaign",                     accessDays: 30, aiCredits: 30,  active: true },
  "WORKSHOP-HSD-2026":{ codeType: "Workshop Access Code",     source: "workshop_event_partner",   campaignCategory: "Workshop / Event / Partner", campaignName: "Workshop Event Partner Access Campaign",  accessDays: 30, aiCredits: 30,  active: true },
  "GYM-HSD-2026":     { codeType: "Gym Access Code",          source: "gym",                      campaignCategory: "Gym / Fitness",          campaignName: "Gym Partner Access Campaign",                 accessDays: 30, aiCredits: 30,  active: true },
  "XPRIZE-JUDGE-2026":{ codeType: "Judge Access Code",        source: "xprize_judge",              campaignCategory: "Workshop / Event / Partner", campaignName: "Build with Gemini XPRIZE — Judge Access", accessDays: 90, aiCredits: 100, active: true },
};

const INACTIVE_CODES = [
  "CAREER-READY-30", "GLOBAL-READY-30", "SPEAK-READY-30",
  "CHIGUSA-HSD-2026", "PARTNER-HSD-2026", "EVENT-HSD-2026",
];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers: CORS, body: "Method not allowed" };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Invalid JSON" }) }; }

  const { idToken } = body;
  const code = (body.code || "").trim().toUpperCase();

  if (!idToken) return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Authentication required." }) };
  if (!code)    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: "Code is required." }) };

  let uid;
  try {
    uid = await verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: "Invalid or expired session." }) };
  }

  if (INACTIVE_CODES.includes(code)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: "expired" }) };
  }
  const definition = ACCESS_CODES[code];
  if (!definition || !definition.active) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ success: false, error: "invalid" }) };
  }

  const now       = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + definition.accessDays);

  const accessPass = {
    hasFullPlatformAccess: true,
    accessPassType:        "Free Month Access Pass",
    accessCodeUsed:        code,
    codeType:              definition.codeType,
    source:                definition.source,
    campaignCategory:      definition.campaignCategory,
    campaignName:          definition.campaignName,
    activatedAt:           now.toISOString(),
    expiresAt:             expiresAt.toISOString(),
    aiCreditsGranted:      definition.aiCredits,
    aiCreditsRemaining:    definition.aiCredits,
    aiCreditsUsed:         0,
    status:                "active",
  };

  try {
    const res = await firestoreFetch(`/users/${uid}?updateMask.fieldPaths=accessPass`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ fields: { accessPass: toFirestoreValue(accessPass) } }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("redeem-access-code write failed:", res.status, err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to activate code. Please try again." }) };
    }
  } catch (err) {
    console.error("redeem-access-code error:", err.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: "Failed to activate code. Please try again." }) };
  }

  return {
    statusCode: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
    body: JSON.stringify({ success: true, accessPass }),
  };
};
