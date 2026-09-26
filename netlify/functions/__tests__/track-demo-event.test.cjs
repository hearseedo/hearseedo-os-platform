// Phase 1 — track-demo-event.js input validation. This endpoint is
// intentionally auth-free (anonymous demo visitors), so what's tested here
// is that an unrecognized event/pathwayId is rejected BEFORE any network
// call (no credentials needed to run this), keeping the allowlist real
// rather than decorative.
//
// Run with: npm run test:functions

const test = require("node:test");
const assert = require("node:assert/strict");

test("track-demo-event: rejects an unrecognized event name (400), before any network call", async () => {
  const { handler } = require("../track-demo-event.js");
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ event: "not_a_real_event" }) });
  assert.equal(res.statusCode, 400);
});

test("track-demo-event: rejects a missing event field (400)", async () => {
  const { handler } = require("../track-demo-event.js");
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ pathwayId: "student" }) });
  assert.equal(res.statusCode, 400);
});

test("track-demo-event: rejects an unrecognized pathwayId (400)", async () => {
  const { handler } = require("../track-demo-event.js");
  const res = await handler({ httpMethod: "POST", body: JSON.stringify({ event: "eco_demo_entry", pathwayId: "attacker-supplied" }) });
  assert.equal(res.statusCode, 400);
});

test("track-demo-event: rejects invalid JSON (400)", async () => {
  const { handler } = require("../track-demo-event.js");
  const res = await handler({ httpMethod: "POST", body: "not json" });
  assert.equal(res.statusCode, 400);
});

test("track-demo-event: rejects non-POST methods", async () => {
  const { handler } = require("../track-demo-event.js");
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});

test("track-demo-event: OPTIONS preflight returns 204", async () => {
  const { handler } = require("../track-demo-event.js");
  const res = await handler({ httpMethod: "OPTIONS" });
  assert.equal(res.statusCode, 204);
});
