// HSD Family — Hear/See/Do/Talk/Create section backgrounds (2026-09-11).
// The actual CSS lives in ./sectionBackgrounds.css (a real Vite-bundled
// stylesheet, not a JSX-rendered <style> tag) — see that file's header
// comment for why: both a JSX <style> tag with @media background-image
// rules, and a <picture>/<source media> element, caused Chrome to
// speculatively download BOTH the desktop and mobile file regardless of
// which one actually matched (confirmed via
// performance.getEntriesByType('resource'), in dev and in a production
// build). A genuine external stylesheet's @media rules go through the
// normal CSSOM pipeline instead and only fetch the matching image.
import "./sectionBackgrounds.css";

const BASE = "/assets/family-sections";

export const SECTION_META = {
  hear:   { color: "#2f8fed" },
  see:    { color: "#7B5EA7" },
  do:     { color: "#2f9e5c" },
  talk:   { color: "#e0559c" },
  create: { color: "#e0b31b" },
};

export const JONA_FIGURE_SRC = `${BASE}/family-jona.png`;

// Background art + scrim for one category — CSS class only, the browser
// resolves which background-image to fetch via the real @media rules in
// sectionBackgrounds.css.
export function SectionBackground({ category }) {
  if (!SECTION_META[category]) return null;
  return <div className={`fam-section-bg fam-section-bg--${category}`} aria-hidden="true" />;
}
