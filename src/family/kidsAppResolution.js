// HSD Family — Kids iframe-app curriculum resolution (Phase 3 canonical-
// registry migration, docs/HSD_FAMILY_PATHWAY_AUDIT_2026-09-11.md, Section
// 9 step 3). Pure logic, no JSX, no Firebase import — deliberately, same
// reasoning as src/lib/curriculumRouting.js: this needs to be directly
// unit-testable (including both feature-flag states) without a JSX
// transform or a Firestore emulator. src/family/ActivityPlayer.jsx imports
// this instead of defining the logic inline.
import { MONKEY_YOGA_CURRICULUM_ID } from "../lib/curriculumRouting.js";
import { getCanonicalApp } from "../constants/canonicalRegistry.js";
import { isCanonicalRegistryEnabled } from "../lib/canonicalRegistryFlag.js";

// Curriculum-aware sub-apps get routed to the learner's actual position
// instead of always opening at their home screen (item 5/6 of the V2
// integration). Only Monkey Yoga has a real curriculum today — every other
// iframe_app activity behaves exactly as before (curriculumTarget stays
// null, AppModal opens the app's plain home screen). This is the legacy
// (flag-off / production-default) data source.
export const CURRICULUM_BY_APP_ID = { phonics: MONKEY_YOGA_CURRICULUM_ID };

/**
 * Which curriculum (if any) an iframe_app activity's appId is tied to.
 * `useCanonical` defaults to the real feature flag but takes an explicit
 * override so tests can exercise both states directly, without mocking
 * import.meta.env. Behind the flag, the answer comes from
 * canonicalRegistry.js's `programs` field instead of the hardcoded map
 * above; both are proven to agree for "phonics" — see
 * tests/phase3-kids-migration.test.js.
 * @param {string} appId
 * @param {boolean} [useCanonical]
 * @returns {string|undefined}
 */
export function resolveCurriculumId(appId, useCanonical = isCanonicalRegistryEnabled()) {
  if (useCanonical) {
    const canonical = getCanonicalApp(appId);
    return canonical?.programs?.includes("monkey-yoga-phonics") ? MONKEY_YOGA_CURRICULUM_ID : undefined;
  }
  return CURRICULUM_BY_APP_ID[appId];
}
