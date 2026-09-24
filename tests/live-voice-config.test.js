// Talk with Jona (Gemini Live) — session-limit config reader. Confirms
// requirement #9: conservative defaults, remotely adjustable, fails closed
// to the conservative defaults (never to "unlimited") on any read problem.
// Run with:
//   node --test tests/live-voice-config.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { loadLiveVoiceConfig, DEFAULTS } from "../netlify/functions/_liveVoiceConfig.js";

function fromFirestoreFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) {
    if ("integerValue" in v) out[k] = parseInt(v.integerValue, 10);
    else if ("doubleValue" in v) out[k] = v.doubleValue;
    else if ("stringValue" in v) out[k] = v.stringValue;
    else if ("booleanValue" in v) out[k] = v.booleanValue;
  }
  return out;
}

test("no config doc -> conservative defaults", async () => {
  const fetch = async () => ({ ok: false, status: 404, json: async () => ({}) });
  const config = await loadLiveVoiceConfig(fetch, fromFirestoreFields);
  assert.deepEqual(config, DEFAULTS);
});

test("a real config doc overrides the defaults", async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({ fields: { maxSessionSeconds: { integerValue: "600" }, dailySessionCap: { integerValue: "3" }, inactivitySeconds: { integerValue: "60" } } }),
  });
  const config = await loadLiveVoiceConfig(fetch, fromFirestoreFields);
  assert.equal(config.maxSessionSeconds, 600);
  assert.equal(config.dailySessionCap, 3);
  assert.equal(config.inactivitySeconds, 60);
});

test("a network error fails closed to the conservative defaults, never throws", async () => {
  const fetch = async () => { throw new Error("boom"); };
  const config = await loadLiveVoiceConfig(fetch, fromFirestoreFields);
  assert.deepEqual(config, DEFAULTS);
});

test("a zero/negative override is rejected in favor of the default (never an effectively-unlimited value)", async () => {
  const fetch = async () => ({
    ok: true,
    json: async () => ({ fields: { maxSessionSeconds: { integerValue: "0" }, dailySessionCap: { integerValue: "-5" } } }),
  });
  const config = await loadLiveVoiceConfig(fetch, fromFirestoreFields);
  assert.equal(config.maxSessionSeconds, DEFAULTS.maxSessionSeconds);
  assert.equal(config.dailySessionCap, DEFAULTS.dailySessionCap);
});
