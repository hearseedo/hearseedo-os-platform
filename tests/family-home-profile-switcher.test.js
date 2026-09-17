// Summit Readiness Sprint 1, Priority 2 (2026-09-17) — static-source
// regression tests for the Family Home profile switcher. This project has
// no React-rendering test harness (no jsdom/@testing-library) — matching
// the existing convention in tests/dashboard-mobile-and-profile.test.js and
// tests/no-direct-locked-writes.test.js, these read the source as TEXT and
// assert the exact structural facts the feature depends on, rather than
// mounting the component. Run with:
//   node --test tests/family-home-profile-switcher.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) {
  return readFileSync(path.join(ROOT, relPath), "utf8");
}

const familyHomeSrc = read("src/family/FamilyHome.jsx");
const childCreateSrc = read("src/family/ChildProfileCreate.jsx");
const useAuthSrc = read("src/hooks/useAuth.jsx");

// ── Multiple profiles rendered, current profile indicated ───────────────

test("FamilyHome destructures profiles and setActiveProfile from the existing useAuth architecture (no second profile-state system)", () => {
  assert.ok(
    /const\s*\{\s*user,\s*profiles,\s*currentProfile,\s*setActiveProfile\s*\}\s*=\s*useAuth\(\)/.test(familyHomeSrc),
    "FamilyHome must reuse useAuth's existing profiles/currentProfile/setActiveProfile rather than inventing new state"
  );
});

test("FamilyHome renders one switcher entry per profile via profiles.map", () => {
  assert.ok(/profiles\.map\(p\s*=>/.test(familyHomeSrc), "the switcher must iterate over the real profiles array, not a hardcoded list");
});

test("FamilyHome never hardcodes a child's name as a literal string in the switcher", () => {
  assert.ok(!/["']Mira["']|["']Kenji["']/.test(familyHomeSrc), "profile names must come from data (p.name), never hardcoded literals");
});

test("the switcher visually marks the active profile via isActive derived from the real profileId", () => {
  assert.ok(/const isActive = p\.id === profileId/.test(familyHomeSrc), "active-state must be computed per profile from the real active profileId");
  assert.ok(/aria-selected=\{isActive\}/.test(familyHomeSrc), "the active chip must be exposed to assistive tech, not just styled");
});

// ── Switching changes active profile, in place ───────────────────────────

test("clicking a non-active chip calls the existing setActiveProfile(p.id) — no navigation, no Switch Pathway", () => {
  assert.ok(
    /onClick=\{\(\)\s*=>\s*\{\s*if\s*\(!isActive\)\s*setActiveProfile\(p\.id\)/.test(familyHomeSrc),
    "switching must call setActiveProfile directly from Family Home, not navigate elsewhere"
  );
});

test("the switcher's onClick never calls navigate(...) to leave Family Home", () => {
  const switcherBlock = familyHomeSrc.slice(
    familyHomeSrc.indexOf('role="tablist"'),
    familyHomeSrc.indexOf('{/* Continue Your Journey')
  );
  assert.ok(switcherBlock.length > 0, "the switcher block must be found");
  assert.ok(!/navigate\(/.test(switcherBlock), "switching profile must never route through Switch Pathway / Continue / Who's learning?");
});

// ── Recommendations/progress update on switch (no stale previous-child state) ─

test("progress refetches whenever profileId changes, so switching never shows the previous child's stale progress", () => {
  assert.ok(
    /useEffect\(\(\) => \{[\s\S]*?getActivityProgress\(user\.uid, profileId\)[\s\S]*?\}, \[user\?\.uid, profileId\]\)/.test(familyHomeSrc),
    "the progress effect must be keyed on profileId so it re-runs on every profile switch"
  );
});

test("recommended/last activity are derived fresh from progress on every render, not cached per-mount", () => {
  assert.ok(/const recommended = getRecommendedActivity\(progress, ageBand\)/.test(familyHomeSrc));
  assert.ok(/const last = getLastActivity\(progress\)/.test(familyHomeSrc));
});

test("ageBand used for recommendations is read from currentProfile, so it changes with the active profile", () => {
  assert.ok(/const ageBand = currentProfile\?\.ageBand/.test(familyHomeSrc));
});

// ── Newly added child becomes active immediately ─────────────────────────

test("ChildProfileCreate calls setActiveProfile with the newly created profile's real id before navigating home", () => {
  assert.ok(childCreateSrc.includes("const { user, setActiveProfile } = useAuth()"), "ChildProfileCreate must pull setActiveProfile from the existing useAuth architecture");
  const submitFn = childCreateSrc.slice(childCreateSrc.indexOf("async function handleSubmit"));
  const createIdx = submitFn.indexOf("createProfile(");
  const setActiveIdx = submitFn.indexOf("setActiveProfile(ref.id");
  const navigateIdx = submitFn.indexOf('navigate("/family/home")');
  assert.ok(createIdx !== -1 && setActiveIdx !== -1 && navigateIdx !== -1, "createProfile, setActiveProfile, and navigate must all be present");
  assert.ok(createIdx < setActiveIdx && setActiveIdx < navigateIdx, "the new child must become active AFTER being created and BEFORE navigating to Family Home");
});

test("ChildProfileCreate does not return the parent to a previously active profile (no setActiveProfile call to SELF_PROFILE_ID after creation)", () => {
  const submitFn = childCreateSrc.slice(childCreateSrc.indexOf("async function handleSubmit"), childCreateSrc.indexOf("async function handleSubmit") + 600);
  assert.ok(!/setActiveProfile\(SELF_PROFILE_ID/.test(submitFn), "the new child, not the parent, must be the active profile after creation");
});

// ── setActiveProfile's race-safe knownValid path ─────────────────────────

test("setActiveProfile accepts a knownValid escape hatch instead of only trusting the (possibly stale) live profiles list", () => {
  assert.ok(
    /const setActiveProfile = useCallback\(\(profileId, \{ knownValid = false \} = \{\}\) => \{/.test(useAuthSrc),
    "setActiveProfile must support a caller-asserted valid id, since a just-created child's doc may not have round-tripped through the familyMembers listener yet"
  );
  assert.ok(
    /if \(!firebaseUser \|\| !\(knownValid \|\| profiles\.some\(p => p\.id === profileId\)\)\) return Promise\.resolve\(false\)/.test(useAuthSrc),
    "the existing stale/garbage-id guard must still apply for every other caller — knownValid only opts out of it explicitly"
  );
});

test("ChildProfileCreate opts into knownValid rather than bypassing setActiveProfile entirely", () => {
  assert.ok(
    childCreateSrc.includes("setActiveProfile(ref.id, { knownValid: true })"),
    "ChildProfileCreate must use the same setActiveProfile mechanism as every other caller, just with knownValid asserted"
  );
});
