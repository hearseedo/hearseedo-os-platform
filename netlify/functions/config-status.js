// Staging-isolation hardening (2026-09-16, corrected twice same-day) — safe,
// non-secret diagnostic endpoint for confirming which Firebase project a
// deployed Function is actually configured to use, without exposing any
// credential material.
// GET /api/config-status →
//   { hsdEnvironment, hsdDeployContext, firebaseProjectId, status, url }
//
// Earlier versions of this endpoint reported process.env.CONTEXT as
// "netlifyContext" and process.env.COMMIT_REF as "commit". Both turned out
// to be Netlify BUILD-time variables that are not reliably present in a
// deployed Function's actual runtime — verified directly against the real
// staging deploy, which reported CONTEXT as simply absent ("local"),
// despite genuinely being a published deploy. Reporting a value that can't
// be trusted at runtime is worse than not reporting it, so both fields have
// been replaced with hsdDeployContext (process.env.HSD_DEPLOY_CONTEXT) — an
// explicit, Functions-scoped variable WE set per deploy context on each
// site (see _firebaseAdmin.js's resolveProjectId for the full safety
// matrix this reflects). commit is omitted entirely rather than reported as
// a value that may not reflect reality; url reports Netlify's own
// non-secret runtime URL, which IS reliably present.
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS };

  const hsdEnvironment = process.env.HSD_ENV || null;
  const hsdDeployContext = process.env.HSD_DEPLOY_CONTEXT || null;
  const url = process.env.URL || null;

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
        body: JSON.stringify({ hsdEnvironment, hsdDeployContext, url, status: "unconfigured", firebaseProjectId: null }),
      };
    }
    return {
      statusCode: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ hsdEnvironment, hsdDeployContext, url, status: "configured", firebaseProjectId: PROJECT_ID }),
    };
  } catch (err) {
    // resolveProjectId's FirestoreConfigError (missing/invalid HSD_ENV,
    // missing/invalid HSD_DEPLOY_CONTEXT, missing project id, or an
    // HSD_ENV/HSD_DEPLOY_CONTEXT/project mismatch) lands here — reported,
    // never thrown raw.
    return {
      statusCode: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
      body: JSON.stringify({ hsdEnvironment, hsdDeployContext, url, status: "misconfigured", error: err.message }),
    };
  }
};
