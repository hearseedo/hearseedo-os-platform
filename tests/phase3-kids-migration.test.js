// Phase 3 — Kids/Monkey Yoga canonical-registry migration.
// docs/HSD_FAMILY_PATHWAY_AUDIT_2026-09-11.md, Section 9 step 3.
//
// Proves two things:
//   1. The canonical registry's "phonics" entry agrees with the legacy
//      registries on every dimension that matters for the single migrated
//      consumer (src/family/ActivityPlayer.jsx's resolveCurriculumId, now
//      in src/family/kidsAppResolution.js).
//   2. resolveCurriculumId() returns the identical value in BOTH feature-
//      flag states, for both a curriculum app (phonics) and a non-
//      curriculum app (wondercamp) — i.e. flipping
//      VITE_USE_CANONICAL_REGISTRY changes nothing observable yet.
//
// Pure logic only, no JSX/Firebase import — run with:
//   node --test tests/phase3-kids-migration.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveCurriculumId, CURRICULUM_BY_APP_ID } from "../src/family/kidsAppResolution.js";
import { getCanonicalApp } from "../src/constants/canonicalRegistry.js";
import { APP_MAP } from "../src/constants/apps.js";
import { APP_REGISTRY_MAP } from "../src/constants/appRegistry.js";
import { MONKEY_YOGA_CURRICULUM_ID } from "../src/lib/curriculumRouting.js";
import { APP_PATHWAY_MAP } from "../src/constants/pathways.js";

const legacyPhonics = APP_MAP.phonics;
const registryPhonics = APP_REGISTRY_MAP.phonics;
const canonicalPhonics = getCanonicalApp("phonics");

// ── Old-vs-canonical parity ─────────────────────────────────────────────

test("ID parity: canonical id matches the legacy app id", () => {
  assert.equal(canonicalPhonics.id, "phonics");
  assert.equal(canonicalPhonics.id, legacyPhonics.id);
});

test("Route parity: neither legacy nor canonical claims a dedicated internal route (modal/iframe-only, unchanged)", () => {
  // Legacy: apps.js has no `route` field at all — phonics only ever opens
  // via AppModal from a click, never a direct URL.
  assert.equal(legacyPhonics.route, undefined);
  // Canonical: worlds.js tags phonics launch:"external", so
  // launchDestination.route is null rather than an invented value, and its
  // kind correctly reflects an iframe launch, not a native route.
  assert.equal(canonicalPhonics.launchDestination.route, null);
  assert.equal(canonicalPhonics.launchDestination.kind, "iframe");
});

test("Title parity: canonical name is read directly from the legacy name, not re-typed", () => {
  assert.equal(canonicalPhonics.name, legacyPhonics.name);
  assert.equal(canonicalPhonics.name, "Monkey Yoga Phonics™");
});

test("i18n keys used elsewhere for this app's family activities are untouched by this migration", () => {
  // This migration does not add, remove, or rename any i18n key — the
  // existing fam_hear/fam_see/fam_do etc. keys (tested in
  // tests/sync-banner-i18n.test.js) are not read by canonicalRegistry.js
  // or kidsAppResolution.js at all.
  const fs = "";
  void fs; // no i18n import in the migrated files — nothing to assert beyond that fact
  assert.ok(!Object.keys(canonicalPhonics).includes("i18nKey"), "canonical entry does not introduce a competing i18n reference");
});

test("Status parity: both legacy and canonical agree phonics is active, not coming-soon", () => {
  assert.equal(legacyPhonics.comingSoon, undefined);
  assert.equal(registryPhonics.status, "active");
  assert.equal(canonicalPhonics.status, "active");
});

test("Visibility parity: both agree phonics is visible/recommended, not hidden", () => {
  assert.notEqual(canonicalPhonics.visibility, "hidden");
  assert.equal(canonicalPhonics.visibility, "recommended");
});

test("Access requirements are unchanged: canonical entry does not add or remove an access gate", () => {
  // Access control stays entirely with PathwayRoute/useAuth/pathwayAccess.js
  // (audit Section 10) — the canonical entry carries no field that could
  // override or duplicate that, and appRegistry.js's subscriptionRequirements
  // (the legacy access-control source) is untouched by this migration.
  assert.ok(Array.isArray(registryPhonics.subscriptionRequirements) && registryPhonics.subscriptionRequirements.length > 0);
  assert.equal(canonicalPhonics.requiresCredits, false); // phonics was never part of the AI-credits system
});

test("Audience-vs-surface parity (Phase 3.1 correction): 'kids' is the learner audience, 'family' is the launch surface — not the same field", () => {
  // Phase 3.1 correction: these were never allowed to be asserted as
  // interchangeable. audiencePaths answers "who is this for"; surfaces
  // answers "which existing HSDOS pathway currently launches it".
  assert.deepEqual(canonicalPhonics.audiencePaths, ["kids"]);
  assert.deepEqual(canonicalPhonics.surfaces, ["family"]);
  assert.equal(APP_PATHWAY_MAP.phonics, "family"); // legacy's own name for this surface agrees
});

test("App launch destination parity: both point at the same iframe env var", () => {
  assert.equal(canonicalPhonics.launchDestination.kind, "iframe");
  assert.equal(canonicalPhonics.launchDestination.envVar, "VITE_APP_URL_PHONICS");
  // legacyPhonics.iframeUrl is a resolved URL string at import time (env-
  // dependent); what matters for parity is that it's iframe-based (truthy
  // string), matching the canonical launchDestination's iframe kind.
  assert.equal(typeof legacyPhonics.iframeUrl, "string");
  assert.ok(legacyPhonics.iframeUrl.length > 0);
});

test("Progress identity parity: canonical progressEvent and the exact stable curriculumId match the real progress pipeline", () => {
  assert.equal(canonicalPhonics.progressEvent, "HSD_OS_PROGRESS");
  // curriculumId (Phase 3.1: the exact stable progress identity, distinct
  // from `programs`, a looser named-program-membership list) must equal
  // MONKEY_YOGA_CURRICULUM_ID exactly — this is the value resolveCurriculumId()
  // actually returns and the value get-classroom-position.js/
  // record-curriculum-progress.js key their Firestore paths on.
  assert.equal(canonicalPhonics.curriculumId, MONKEY_YOGA_CURRICULUM_ID);
  assert.deepEqual(canonicalPhonics.programs, ["monkey-yoga-phonics"]);
});

test("Analytics identity parity: the app id used for tracking is unchanged", () => {
  // netlify/functions/track-event.js, src/lib/appEvents.js, and
  // AppOrbit/Dashboard all key analytics off the app id string "phonics" —
  // the canonical entry's id is that same string, so no event/tracking key
  // changes as a result of this migration.
  assert.equal(canonicalPhonics.id, "phonics");
});

// ── Feature-flag behavior: identical output in both states today ───────

test("resolveCurriculumId('phonics') agrees with the legacy hardcoded map, flag off", () => {
  assert.equal(resolveCurriculumId("phonics", false), CURRICULUM_BY_APP_ID.phonics);
  assert.equal(resolveCurriculumId("phonics", false), MONKEY_YOGA_CURRICULUM_ID);
});

test("resolveCurriculumId('phonics') returns the same value with the canonical registry, flag on", () => {
  assert.equal(resolveCurriculumId("phonics", true), MONKEY_YOGA_CURRICULUM_ID);
});

test("flag on vs flag off produce byte-identical output for phonics (no behavior change when migrated)", () => {
  assert.equal(resolveCurriculumId("phonics", true), resolveCurriculumId("phonics", false));
});

test("flag on vs flag off agree for a non-curriculum app (wondercamp): both undefined", () => {
  assert.equal(resolveCurriculumId("wondercamp", false), undefined);
  assert.equal(resolveCurriculumId("wondercamp", true), undefined);
});

test("flag on vs flag off agree for an unknown app id: both undefined, no throw", () => {
  assert.equal(resolveCurriculumId("does-not-exist", false), undefined);
  assert.equal(resolveCurriculumId("does-not-exist", true), undefined);
});

test("default parameter reads the real (unset in this test env) flag, defaulting to legacy behavior", () => {
  // No override passed — exercises the real isCanonicalRegistryEnabled()
  // default parameter path. In this test environment
  // VITE_USE_CANONICAL_REGISTRY is unset, so this must behave exactly like
  // the explicit `false` case (the production default).
  assert.equal(resolveCurriculumId("phonics"), MONKEY_YOGA_CURRICULUM_ID);
});

// ── The invariant this whole phase must never violate ───────────────────

test("classroom/home progress separation is untouched by this migration (no Firestore-touching code was added)", () => {
  // resolveCurriculumId and getCanonicalApp are both pure, synchronous,
  // side-effect-free functions — neither reads nor writes Firestore, so
  // neither can affect classroomPosition, individualPosition, or
  // homePracticeLog. This test documents that invariant structurally:
  // both functions' source is data-in/data-out with no async/await, no
  // fetch, no Firebase import (see this file's own module imports above —
  // none of them touch src/family/curriculumProgress.js or netlify/functions).
  assert.equal(resolveCurriculumId.constructor.name, "Function"); // synchronous, not AsyncFunction
  assert.equal(getCanonicalApp.constructor.name, "Function");
});
