// HSD Family — shared spray-paint/graffiti decorative CSS. Pure CSS shapes
// and gradients (no new artwork generated) reused across FamilyHome/
// MyJourney/ActivityGrid(hub) via <GraffitiStyles/> so the three pages share
// one definition instead of three copies. Purely presentational — no
// business logic, data, or translation strings live here.
export function GraffitiStyles() {
  return (
    <style>{`
      .fam-world-bg {
        position: relative;
        background-image:
          linear-gradient(180deg, rgba(255,248,240,0.88), rgba(255,248,240,0.97) 60%),
          url('/assets/hsd/family/backgrounds/family-bg-world.webp');
        background-size: cover;
        background-position: center top;
        background-repeat: no-repeat;
      }

      .fam-hero-banner {
        position: relative;
        overflow: hidden;
        background-size: cover;
        background-position: center 30%;
      }
      .fam-hero-banner::after {
        content: "";
        position: absolute; inset: 0;
        background: linear-gradient(0deg, rgba(58,42,58,0.75) 0%, rgba(58,42,58,0.32) 45%, rgba(58,42,58,0.06) 78%);
      }
      .fam-hero-banner > * { position: relative; z-index: 1; }

      .fam-tile { position: relative; overflow: hidden; transition: transform 0.18s ease, box-shadow 0.18s ease; }
      .fam-tile:hover:not(:disabled), .fam-tile:focus-visible { transform: translateY(-4px); box-shadow: 0 12px 26px rgba(0,0,0,0.14); }
      .fam-tile:focus-visible { outline: 3px solid #C9A84C; outline-offset: 2px; }
      .fam-tile-char { position: relative; z-index: 1; transition: transform 0.18s ease; }
      .fam-tile:hover:not(:disabled) .fam-tile-char, .fam-tile:focus-visible .fam-tile-char { transform: scale(1.08) rotate(-2deg); }

      .fam-hub-card { position: relative; overflow: hidden; transition: transform 0.18s ease, box-shadow 0.18s ease; }
      .fam-hub-card:hover, .fam-hub-card:focus-visible { transform: translateY(-4px); box-shadow: 0 14px 28px rgba(0,0,0,0.16); }
      .fam-hub-card:focus-visible { outline: 3px solid #C9A84C; outline-offset: 2px; }
      .fam-hub-card-img { transition: transform 0.35s ease; display: block; }
      .fam-hub-card:hover .fam-hub-card-img, .fam-hub-card:focus-visible .fam-hub-card-img { transform: scale(1.06); }

      .fam-badge-frame { position: relative; }
      .fam-badge-img { transition: filter 0.3s ease, opacity 0.3s ease; }
      .fam-badge-locked .fam-badge-img { filter: grayscale(1) brightness(0.65); opacity: 0.55; }
      .fam-badge-locked .fam-badge-overlay { position: absolute; inset: 0; background: rgba(20,15,20,0.12); border-radius: inherit; }
      @keyframes fam-badge-pop { 0% { transform: scale(0.85); filter: saturate(0.4); } 60% { transform: scale(1.06); filter: saturate(1.3); } 100% { transform: scale(1); filter: saturate(1); } }
      .fam-badge-earned .fam-badge-img { animation: fam-badge-pop 0.5s ease; }

      .fam-hub-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
      @media (min-width: 640px) { .fam-hub-grid { grid-template-columns: repeat(2, 1fr); } }
      @media (min-width: 1040px) { .fam-hub-grid { grid-template-columns: repeat(4, 1fr); } }

      .fam-underline { position: relative; }
      .fam-underline::after {
        content: "";
        position: absolute; left: 6%; right: 6%; bottom: -6px; height: 6px;
        background: currentColor; opacity: 0.55; border-radius: 3px;
        clip-path: polygon(0% 40%, 8% 0%, 22% 60%, 38% 10%, 55% 70%, 72% 5%, 88% 55%, 100% 20%, 100% 100%, 0% 100%);
      }

      @media (prefers-reduced-motion: reduce) {
        .fam-tile, .fam-tile-char, .fam-hub-card, .fam-hub-card-img, .fam-badge-img {
          transition: none !important; animation: none !important;
        }
        .fam-tile:hover:not(:disabled), .fam-tile:focus-visible,
        .fam-hub-card:hover, .fam-hub-card:focus-visible { transform: none !important; }
        .fam-tile:hover:not(:disabled) .fam-tile-char, .fam-tile:focus-visible .fam-tile-char,
        .fam-hub-card:hover .fam-hub-card-img, .fam-hub-card:focus-visible .fam-hub-card-img { transform: none !important; }
      }
    `}</style>
  );
}

// Layered radial-gradient "spray" splash — pure CSS, category-tinted.
// Returns an inline style object; not a generated image.
export function spraySplash(color) {
  return {
    backgroundImage: `radial-gradient(circle at 28% 28%, ${color}3d 0%, transparent 42%), radial-gradient(circle at 72% 62%, ${color}29 0%, transparent 46%), radial-gradient(circle at 50% 88%, ${color}1f 0%, transparent 36%)`,
  };
}
