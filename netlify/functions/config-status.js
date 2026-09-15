// Staging-isolation hardening (2026-09-16, corrected same-day) — safe,
// non-secret diagnostic endpoint for confirming which Firebase project a
// deployed Function is actually configured to use, without exposing any
// credential material.
// GET /api/config-status →
//   { hsdEnvironment, netlifyContext, firebaseProjectId, commit, status }
//
// hsdEnvironment (HSD_ENV) and netlifyContext (Netlify's own CONTEXT) are
// reported SEPARATELY and deliberately — they are not the same concept.
// CONTEXT=production means "this is the published deploy of whichever
// Netlify site this is"; it says nothing about which HSD environment that
// site represents. A separate staging Netlify site's own published deploy
// legitimately reports { hsdEnvironment: "staging", netlifyContext:
// "production", firebaseProjectId: "monkey-see-c4c28" } — that combination
// is correct, not a bug; see _firebaseAdmin.js's resolveProjectId for the
// full safety matrix this reflects.
//
// Deliberately requires _firebaseAdmin.js INSIDE the handler (not at module
// top) and wrapped in try/catch: that module throws at require() time when
// a real deploy's HSD_ENV/CONTEXT/FIREBASE_PROJECT_ID combination is
// invalid — this endpoint's whole purpose is to surface that as a readable
// { status: "misconfigured" } response instead of a bare 502, so requiring
// it eagerly (and letting the throw propagate uncaught) would defeat the
// point.
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  const netlifyContext = process.env.CONTEXT || "local";
  const hsdEnvironment = process.env.HSD_ENV || null;
  const commit = process.env.COMMIT_REF ? process.env.COMMIT_REF.slice(0, 7) : null;

  try {
    // Fresh require each invocation (not cached at module scope) so a
    // change to env config between cold starts is always re-evaluated,
    // and so this file itself never throws at its own module load.
    delete require.cache[require.resolve("./_firebaseAdmin.js")];
    const { PROJECT_ID } = require("./_firebaseAdmin.js");
    if (!PROJECT_ID) {
      return {
        statusCode: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
        body: JSON.stringify({ hsdEnvironment, netlifyContext, commit, status: "unconfigured", firebaseProjectId: null }),
      };
    }
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ hsdEnvironment, netlifyContext, commit, status: "configured", firebaseProjectId: PROJECT_ID }),
    };
  } catch (err) {
    // resolveProjectId's FirestoreConfigError (missing HSD_ENV, an
    // unrecognized HSD_ENV, missing project id, or an
    // HSD_ENV/CONTEXT/project mismatch) lands here — reported, never
    // thrown raw.
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ hsdEnvironment, netlifyContext, commit, status: "misconfigured", error: err.message }),
    };
  }
};
