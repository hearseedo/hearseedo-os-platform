// Phase 9 (canonical registry) — unit tests for the compatibility adapter
// in src/constants/canonicalRegistry.js. Pure logic, no Firebase/network
// dependency — run with:
//   node --test tests/canonical-registry.test.js
import test from "node:test";
import assert from "node:assert/strict";
import {
  getCanonicalApp, getCanonicalRegistry, getAppsForPathway, getUniversityBranchApps,
} from "../src/constants/canonicalRegistry.js";
import { APPS } from "../src/constants/apps.js";

test("every legacy app in constants/apps.js derives a canonical entry", () => {
  for (const app of APPS) {
    const canonical = getCanonicalApp(app.id);
    assert.ok(canonical, `expected a canonical entry for ${app.id}`);
    assert.equal(canonical.id, app.id);
  }
});

test("unknown app id returns null rather than throwing", () => {
  assert.equal(getCanonicalApp("does-not-exist"), null);
});

test("EIKEN is corrected to teens, not kids (audit Section 5)", () => {
  const eiken = getCanonicalApp("eiken");
  assert.deepEqual(eiken.audiencePaths, ["teens"]);
});

test("Inner Key Blueprint is corrected to parents, not adult (audit Section 5/6)", () => {
  const innerkey = getCanonicalApp("innerkey");
  assert.deepEqual(innerkey.audiencePaths, ["parents"]);
});

test("Monkeys Unlock is corrected to teens + future/hidden, resolving the apps.js/appRegistry.js status conflict", () => {
  const monkeysUnlock = getCanonicalApp("monkeys-unlock");
  assert.deepEqual(monkeysUnlock.audiencePaths, ["teens"]);
  assert.equal(monkeysUnlock.status, "future");
  assert.equal(monkeysUnlock.visibility, "hidden");
  assert.equal(monkeysUnlock.books.length, 8);
});

test("Career/Global/Speak Ready carry the correct University branch, Global Ready kept whole", () => {
  assert.deepEqual(getCanonicalApp("career-ready").universityBranches, ["work"]);
  assert.deepEqual(getCanonicalApp("global-ready").universityBranches, ["travel"]);
  assert.deepEqual(getCanonicalApp("speak-ready").universityBranches, ["speak"]);
});

test("getUniversityBranchApps returns exactly one app per branch (no splitting Global Ready)", () => {
  assert.deepEqual(getUniversityBranchApps("work").map(a => a.id), ["career-ready"]);
  assert.deepEqual(getUniversityBranchApps("travel").map(a => a.id), ["global-ready"]);
  assert.deepEqual(getUniversityBranchApps("speak").map(a => a.id), ["speak-ready"]);
});

test("new hand-authored entries are present: HSD Family native, WonderCamp native, Sip Speak Learn, Confidence First, Monkeys Talk & Unlock", () => {
  const ids = getCanonicalRegistry().map(a => a.id);
  for (const expected of ["hsd-family-native", "wondercamp-native", "sip-speak-learn", "confidence-first", "monkeys-talk-unlock"]) {
    assert.ok(ids.includes(expected), `expected ${expected} in canonical registry`);
  }
});

test("WonderCamp's native lesson browser is tagged schools, not kids (audit Section 5)", () => {
  const registry = getCanonicalRegistry();
  const wondercampNative = registry.find(a => a.id === "wondercamp-native");
  assert.deepEqual(wondercampNative.audiencePaths, ["schools"]);
});

test("Confidence First is one canonical program shared across audiences, never duplicated per pathway", () => {
  const registry = getCanonicalRegistry();
  const confidenceFirstEntries = registry.filter(a => a.programs.includes("confidence-first"));
  assert.equal(confidenceFirstEntries.length, 1);
  assert.deepEqual(confidenceFirstEntries[0].audiencePaths.sort(), ["adults", "parents", "schools", "university"]);
});

test("Confidence First is not exposed to kids or teens", () => {
  assert.equal(getAppsForPathway("kids").some(a => a.programs.includes("confidence-first")), false);
  assert.equal(getAppsForPathway("teens").some(a => a.programs.includes("confidence-first")), false);
});

test("Monkeys Talk & Unlock and Inner Key Blueprint remain separate programs", () => {
  const registry = getCanonicalRegistry();
  const monkeysTalkUnlock = registry.find(a => a.id === "monkeys-talk-unlock");
  const innerkey = registry.find(a => a.id === "innerkey");
  assert.notDeepEqual(monkeysTalkUnlock.programs, innerkey.programs);
});

test("getAppsForPathway includes multi-tagged apps for every pathway they belong to", () => {
  const kidsApps = getAppsForPathway("kids").map(a => a.id);
  const parentsApps = getAppsForPathway("parents").map(a => a.id);
  assert.ok(kidsApps.includes("hsd-family-native"));
  assert.ok(parentsApps.includes("hsd-family-native"));
});

test("Hear/See/Do/Talk/Create experienceModes only appear on kids-pathway apps", () => {
  const registry = getCanonicalRegistry();
  for (const app of registry) {
    if (app.experienceModes.length > 0) {
      assert.ok(app.audiencePaths.includes("kids"), `${app.id} has experienceModes but isn't tagged kids`);
    }
  }
});
