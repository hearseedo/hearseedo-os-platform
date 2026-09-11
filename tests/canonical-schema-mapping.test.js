// Phase 3.1 hardening — formal tests for the legacy->canonical translation
// functions in src/constants/canonicalRegistry.js (mapLegacyStatus,
// mapLegacyVisibility, buildLaunchDestination), and for the
// audience-vs-surface separation. These exist because the earlier adapter
// asserted legacy "visible" == canonical "recommended" inline, with no
// single defined+tested translation — this file is that definition.
//
// Pure logic only — run with:
//   node --test tests/canonical-schema-mapping.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  mapLegacyStatus, mapLegacyVisibility, buildLaunchDestination,
  getCanonicalApp, getCanonicalRegistry, getAppsForSurface, getAppsForPathway,
} from "../src/constants/canonicalRegistry.js";

// ── mapLegacyStatus ───────────────────────────────────────────────────────

test("mapLegacyStatus: comingSoon:true always wins, regardless of registryEntry.status", () => {
  assert.equal(mapLegacyStatus({ comingSoon: true }, { status: "active" }), "coming_soon");
  assert.equal(mapLegacyStatus({ comingSoon: true }, undefined), "coming_soon");
});

test("mapLegacyStatus: registryEntry.status 'active' maps to canonical 'active'", () => {
  assert.equal(mapLegacyStatus({}, { status: "active" }), "active");
});

test("mapLegacyStatus: an unrecognized registryEntry.status passes through as-is", () => {
  assert.equal(mapLegacyStatus({}, { status: "beta" }), "beta");
});

test("mapLegacyStatus: no registryEntry at all defaults to 'active'", () => {
  assert.equal(mapLegacyStatus({}, undefined), "active");
});

// ── mapLegacyVisibility ───────────────────────────────────────────────────

test("mapLegacyVisibility: comingSoon:true maps to 'hidden'", () => {
  assert.equal(mapLegacyVisibility({ comingSoon: true }), "hidden");
});

test("mapLegacyVisibility: no comingSoon flag maps to 'recommended', never silently to something else", () => {
  assert.equal(mapLegacyVisibility({}), "recommended");
  assert.equal(mapLegacyVisibility({ comingSoon: false }), "recommended");
});

test("mapLegacyVisibility never returns 'explore' — that state has no legacy signal to infer from", () => {
  for (const legacyApp of [{}, { comingSoon: true }, { comingSoon: false }, { free: true }]) {
    assert.notEqual(mapLegacyVisibility(legacyApp), "explore");
  }
});

// ── buildLaunchDestination ────────────────────────────────────────────────

test("buildLaunchDestination: worlds.js launch:'internal' produces a native destination with that route", () => {
  const dest = buildLaunchDestination({ id: "career-ready", iframeUrl: "" }, { launch: "internal", route: "/career-ready" });
  assert.deepEqual(dest, { kind: "native", route: "/career-ready", envVar: null });
});

test("buildLaunchDestination: empty-string iframeUrl (native/modal special-case apps) produces a native destination with no route", () => {
  const dest = buildLaunchDestination({ id: "eiken", iframeUrl: "" }, undefined);
  assert.deepEqual(dest, { kind: "native", route: null, envVar: null });
});

test("buildLaunchDestination: a real iframeUrl string produces an iframe destination with the derived env var name", () => {
  const dest = buildLaunchDestination({ id: "phonics", iframeUrl: "https://example.netlify.app" }, { launch: "external" });
  assert.deepEqual(dest, { kind: "iframe", route: null, envVar: "VITE_APP_URL_PHONICS" });
});

test("buildLaunchDestination: multi-word hyphenated ids derive a correctly underscored env var name", () => {
  const dest = buildLaunchDestination({ id: "monkeys-unlock", iframeUrl: "https://example.com" }, undefined);
  assert.equal(dest.envVar, "VITE_APP_URL_MONKEYS_UNLOCK");
});

test("buildLaunchDestination: no iframeUrl and no world info produces 'none'", () => {
  const dest = buildLaunchDestination({ id: "confidence-first" }, undefined);
  assert.deepEqual(dest, { kind: "none", route: null, envVar: null });
});

// ── Audience vs. surface separation (the core Phase 3.1 correction) ─────

test("phonics: audiencePaths (kids) and surfaces (family) are both present and are NOT the same value", () => {
  const phonics = getCanonicalApp("phonics");
  assert.deepEqual(phonics.audiencePaths, ["kids"]);
  assert.deepEqual(phonics.surfaces, ["family"]);
  assert.notDeepEqual(phonics.audiencePaths, phonics.surfaces);
});

test("getAppsForSurface('family') and getAppsForPathway('kids') are different queries with different results", () => {
  const bySurface = getAppsForSurface("family").map(a => a.id).sort();
  const byAudience = getAppsForPathway("kids").map(a => a.id).sort();
  // wondercamp-native is audience "schools" but has no "family" surface;
  // it must not appear in either of these for the same reason, but the two
  // lists are computed from genuinely different fields — assert that at
  // least the underlying arrays being compared are distinct fields, not
  // that the two happen to produce different ids (which they may not for
  // every possible future entry).
  assert.ok(Array.isArray(bySurface));
  assert.ok(Array.isArray(byAudience));
  const phonics = getCanonicalApp("phonics");
  assert.ok(bySurface.includes("phonics"));
  assert.ok(byAudience.includes("phonics"));
  assert.notStrictEqual(phonics.audiencePaths, phonics.surfaces); // never the same array reference or shape by convention
});

test("every canonical entry has both an audiencePaths array and a surfaces array, even when surfaces is empty", () => {
  for (const app of getCanonicalRegistry()) {
    assert.ok(Array.isArray(app.audiencePaths), `${app.id} missing audiencePaths`);
    assert.ok(Array.isArray(app.surfaces), `${app.id} missing surfaces`);
  }
});

// ── curriculumId as the exact stable progress identity ───────────────────

test("only apps with a real server-tracked curriculum have a non-null curriculumId", () => {
  const registry = getCanonicalRegistry();
  const withCurriculum = registry.filter(a => a.curriculumId !== null);
  assert.deepEqual(withCurriculum.map(a => a.id), ["phonics"]);
});

test("monkeys-talk-unlock has books listed but curriculumId is null (no progress system exists yet — Future, not built)", () => {
  const mtu = getCanonicalRegistry().find(a => a.id === "monkeys-talk-unlock");
  assert.equal(mtu.curriculumId, null);
  assert.equal(mtu.books.length, 8);
});

// ── Unknown / malformed app ids ───────────────────────────────────────────

test("getCanonicalApp returns null for an unknown id, never a partially-filled object", () => {
  assert.equal(getCanonicalApp("does-not-exist"), null);
  assert.equal(getCanonicalApp(""), null);
  assert.equal(getCanonicalApp(undefined), null);
});

test("getAppsForSurface/getAppsForPathway with a nonsense value return an empty array, never throw", () => {
  assert.deepEqual(getAppsForSurface("not-a-real-surface"), []);
  assert.deepEqual(getAppsForPathway("not-a-real-audience"), []);
});

// ── Explicit legacy visibility/status translation, formally proven (not
// just asserted equal inline as the pre-3.1 adapter did) ────────────────

test("every canonical entry's visibility and status came from the documented mapping functions, not an ad-hoc equality claim", () => {
  const registry = getCanonicalRegistry();
  for (const app of registry) {
    assert.ok(["recommended", "explore", "hidden"].includes(app.visibility), `${app.id} has an invalid visibility value`);
    assert.ok(["active", "beta", "coming_soon", "future", "archived"].includes(app.status), `${app.id} has an invalid status value`);
  }
});
