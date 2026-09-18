// HSD Family Core Polish (2026-09-18) — the Fall seasonal-audio QA found
// that Family exposed no working language switch: FamilySetup.jsx has a
// language control, but it's local component state (useState("en")), never
// wired to the shared useLang()/localStorage("hsd-lang") context that
// FamilyHome, ActivityPlayer, and MTAU all actually read from. QA had to
// call localStorage.setItem("hsd-lang", ...) directly to test JP rendering.
//
// This adds a compact EN/JP toggle to FamilyHome's header that reuses the
// existing useLang() hook and its existing persistence — no second
// language state, no new architecture. These are source-text assertions
// (this repo's established convention for files that import ../lib/firebase
// and so can't run under plain `node --test`), verifying the toggle is
// wired to the real shared state rather than a decorative local one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function read(relPath) { return readFileSync(path.join(ROOT, relPath), "utf8"); }

const familyHomeSrc = read("src/family/FamilyHome.jsx");

test("FamilyHome destructures setLang from the SAME useLang() hook already used for t/lang — no second language state", () => {
  assert.ok(/const \{ t, lang, setLang \} = useLang\(\);/.test(familyHomeSrc));
});

test("the toggle calls setLang directly, which is the existing hsd-lang persistence mechanism — nothing bespoke", () => {
  const useLangSrc = read("src/hooks/useLang.jsx");
  assert.ok(/localStorage\.setItem\("hsd-lang", l\)/.test(useLangSrc), "setLang must still be the one function that persists to hsd-lang");
  assert.ok(/onClick=\{\(\) => setLang\(l\)\}/.test(familyHomeSrc), "the toggle must call the real setLang, not a local copy");
});

test("both EN and JP segments render at all times, with the active one visually distinguished via aria-pressed — not a single 'switch to X' button", () => {
  assert.ok(/\["en", "jp"\]\.map\(l =>/.test(familyHomeSrc));
  assert.ok(/aria-pressed=\{lang === l\}/.test(familyHomeSrc));
});

test("the toggle does not introduce a new language state — no useState for language, no second localStorage key", () => {
  const toggleBlock = familyHomeSrc.slice(familyHomeSrc.indexOf('role="group"'), familyHomeSrc.indexOf("Parent mode stays a distinct"));
  assert.ok(!/useState/.test(toggleBlock), "must not declare its own state — lang comes entirely from useLang()");
  assert.ok(!/localStorage/.test(toggleBlock), "must not touch localStorage directly — persistence is useLang()'s job alone");
});

test("child profile names are rendered raw, never passed through t() or localizedTitle — a name is not a translatable string", () => {
  assert.ok(/👋 \{currentProfile\?\.name \?\? ""\}/.test(familyHomeSrc));
});

test("FamilySetup's pre-existing language control is confirmed disconnected from the shared state (documents why it doesn't already work)", () => {
  const familySetupSrc = read("src/pages/FamilySetup.jsx");
  assert.ok(/const \[lang, setLang\]\s*=\s*useState\("en"\)/.test(familySetupSrc), "FamilySetup's own local lang state, unrelated to useLang()");
  assert.ok(!/useLang/.test(familySetupSrc), "FamilySetup must not import the shared hook — if it starts to, this test (and the audit finding) is stale");
});
