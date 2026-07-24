// Sip Speak Learn — scoped UI kit
// Everything is namespaced under `.ssl-root` so no styles leak into the rest of
// the platform. Primitives + layout used by every screen.
import { useState } from "react";
import { SSL } from "./constants";
import { DRINKS_MEDIA, DRINKS_FORMAT } from "./config";

// ── Scoped stylesheet ───────────────────────────────────────────────────────
export function SSLStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,500&display=swap');

      .ssl-root { font-family:${SSL.sans}; color:${SSL.ink}; background:${SSL.cream}; min-height:100vh; -webkit-font-smoothing:antialiased; }
      .ssl-root *, .ssl-root *::before, .ssl-root *::after { box-sizing:border-box; }
      .ssl-serif { font-family:${SSL.serif}; letter-spacing:-0.01em; }

      .ssl-shell { display:flex; min-height:100vh; }
      .ssl-main  { flex:1; min-width:0; }
      .ssl-page  { max-width:${SSL.maxW}px; margin:0 auto; padding:40px 44px 96px; }

      /* Sidebar */
      .ssl-sidebar { width:${SSL.sidebarW}px; flex-shrink:0; background:${SSL.navy}; color:${SSL.onNavy};
        display:flex; flex-direction:column; padding:26px 18px; position:sticky; top:0; height:100vh; }
      .ssl-logo { display:flex; align-items:center; justify-content:center; padding:6px 6px 22px; }
      .ssl-logo img { width:132px; height:auto; }
      .ssl-nav { display:flex; flex-direction:column; gap:4px; margin-top:8px; }
      .ssl-navItem { display:flex; align-items:center; gap:13px; padding:12px 14px; border-radius:12px;
        color:${SSL.onNavyMuted}; font-size:15px; font-weight:500; cursor:pointer; border:none; background:transparent;
        text-align:left; width:100%; transition:background .15s,color .15s; }
      .ssl-navItem:hover { color:${SSL.onNavy}; background:rgba(255,255,255,.05); }
      .ssl-navItem.active { color:#fff; background:${SSL.copper}; box-shadow:0 6px 18px rgba(181,121,74,.35); }
      .ssl-navItem svg { width:20px; height:20px; flex-shrink:0; }
      .ssl-navSpacer { flex:1; }
      .ssl-profile { display:flex; align-items:center; gap:11px; padding:10px 8px; border-top:1px solid ${SSL.borderNavy}; margin-top:10px; }
      .ssl-avatar { width:38px; height:38px; border-radius:50%; background:${SSL.copper}; color:#fff; display:flex;
        align-items:center; justify-content:center; font-weight:600; font-size:15px; overflow:hidden; }
      .ssl-profile .nm { font-size:14px; font-weight:600; color:#fff; }
      .ssl-profile .sub { font-size:12px; color:${SSL.onNavyMuted}; }

      /* Buttons */
      .ssl-btn { display:inline-flex; align-items:center; justify-content:center; gap:8px; font-family:${SSL.sans};
        font-size:15px; font-weight:600; padding:13px 24px; border-radius:12px; border:1px solid transparent;
        cursor:pointer; transition:transform .12s, box-shadow .15s, background .15s; }
      .ssl-btn:active { transform:translateY(1px); }
      .ssl-btn-primary { background:${SSL.copper}; color:#fff; box-shadow:0 8px 22px rgba(181,121,74,.32); }
      .ssl-btn-primary:hover { background:${SSL.copperLight}; }
      .ssl-btn-ghost { background:transparent; color:${SSL.ink}; border-color:${SSL.border}; }
      .ssl-btn-ghost:hover { background:${SSL.creamPanel}; }
      .ssl-btn-onNavy { background:transparent; color:${SSL.onNavy}; border-color:${SSL.borderNavy}; }
      .ssl-btn-onNavy:hover { background:rgba(255,255,255,.08); }
      .ssl-btn:disabled { opacity:.5; cursor:not-allowed; box-shadow:none; }

      /* Cards & bits */
      .ssl-card { background:${SSL.creamCard}; border:1px solid ${SSL.border}; border-radius:${SSL.radiusLg}px; }
      .ssl-pill { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; font-weight:600;
        padding:5px 12px; border-radius:999px; }
      .ssl-eyebrow { font-size:12px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:${SSL.copper}; }
      .ssl-focusable:focus-visible { outline:3px solid ${SSL.teal}; outline-offset:2px; }

      /* Season / lesson cards */
      .ssl-seasonCard { position:relative; border-radius:${SSL.radius}px; overflow:hidden; cursor:pointer;
        aspect-ratio:4/5; border:1px solid ${SSL.border}; transition:transform .18s, box-shadow .18s; }
      .ssl-seasonCard:hover { transform:translateY(-4px); box-shadow:0 18px 40px rgba(14,32,56,.22); }
      .ssl-seasonCard img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .ssl-seasonCard .ov { position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,26,46,0) 38%, rgba(10,26,46,.86) 100%); }
      .ssl-seasonCard .cap { position:absolute; left:0; right:0; bottom:0; padding:18px; color:#fff; }

      .ssl-lessonCard { position:relative; border-radius:${SSL.radius}px; overflow:hidden; cursor:pointer;
        background:${SSL.navy}; border:1px solid ${SSL.border}; transition:transform .18s, box-shadow .18s; display:flex; flex-direction:column; }
      .ssl-lessonCard:hover { transform:translateY(-3px); box-shadow:0 14px 32px rgba(14,32,56,.20); }
      .ssl-lessonCard.locked { opacity:.72; }
      .ssl-lessonThumb { aspect-ratio:16/10; background:${SSL.navySoft}; position:relative; overflow:hidden; }
      .ssl-lessonThumb .grad { position:absolute; inset:0; background:linear-gradient(180deg, rgba(14,32,56,.1), rgba(14,32,56,.7)); }
      .ssl-lessonBody { padding:14px 16px 16px; color:${SSL.onNavy}; }

      /* Progress ring */
      .ssl-ring { transform:rotate(-90deg); }
      .ssl-ring circle { fill:none; stroke-linecap:round; }

      .ssl-resume { display:flex; align-items:center; gap:20px; padding:18px; }
      .ssl-resume .thumb { width:130px; height:90px; border-radius:12px; flex-shrink:0; background-size:cover; background-position:center; }

      .ssl-grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; }
      .ssl-grid2 { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
      .ssl-row { display:flex; gap:18px; }

      /* Mobile */
      .ssl-mobileTop { display:none; }
      .ssl-mobileNav { display:none; }
      @media (max-width: 900px) {
        .ssl-sidebar { display:none; }
        .ssl-page { padding:20px 18px 96px; }
        .ssl-grid4 { grid-template-columns:1fr 1fr; gap:12px; }
        .ssl-grid2 { grid-template-columns:1fr; }
        .ssl-resume { flex-wrap:wrap; }
        .ssl-resume .thumb { width:100%; height:120px; }
        .ssl-resume .ssl-btn { width:100%; }
        .ssl-mobileTop { display:flex; align-items:center; justify-content:space-between; padding:14px 18px;
          background:${SSL.navy}; position:sticky; top:0; z-index:20; }
        .ssl-mobileTop img { height:34px; }
        .ssl-mobileNav { display:flex; position:fixed; bottom:0; left:0; right:0; z-index:30; background:${SSL.navy};
          border-top:1px solid ${SSL.borderNavy}; padding:8px 6px calc(8px + env(safe-area-inset-bottom));
          justify-content:space-around; }
        .ssl-mobileNav button { background:none; border:none; color:${SSL.onNavyMuted}; display:flex; flex-direction:column;
          align-items:center; gap:3px; font-size:10.5px; font-weight:600; padding:4px 8px; cursor:pointer; }
        .ssl-mobileNav button.active { color:${SSL.copperLight}; }
        .ssl-mobileNav svg { width:22px; height:22px; }
      }
      /* Spinning drink — gentle "presenting" turn with real perspective depth */
      @keyframes sslDrinkTurn {
        0%,100% { transform: perspective(760px) rotateY(-20deg); }
        50%     { transform: perspective(760px) rotateY(20deg); }
      }
      .ssl-drinkspin { display:block; object-fit:contain; filter:drop-shadow(0 10px 18px rgba(0,0,0,.35)); }
      .ssl-drinkspin.png { animation: sslDrinkTurn 7s ease-in-out infinite; will-change:transform; }

      @media (prefers-reduced-motion: reduce) {
        .ssl-root * { transition:none !important; animation:none !important; }
      }
    `}</style>
  );
}

// ── Spinning drink player ────────────────────────────────────────────────────
// Prefers a looping muted video (Sora), falls back to a transparent PNG with a
// gentle CSS turn, then to nothing. Dormant until DRINKS_MEDIA is enabled.
// Assets live in public/ssl/drinks/ as ssl-drink-{lessonId}-{type}.{mp4|png}.
export function DrinkSpin({ id, type, size = 92 }) {
  const [mode, setMode] = useState(DRINKS_FORMAT === "video" ? "video" : "png");
  if (!DRINKS_MEDIA || !id) return null;
  const base = `/ssl/drinks/ssl-drink-${id}-${type}`;
  const box = { width: size, height: size, flexShrink: 0 };
  if (mode === "video") {
    return (
      <video className="ssl-drinkspin" style={box} src={`${base}.mp4`}
        autoPlay loop muted playsInline preload="metadata" onError={() => setMode("png")} />
    );
  }
  if (mode === "png") {
    return <img className="ssl-drinkspin png" style={box} src={`${base}.png`} alt="" onError={() => setMode("none")} />;
  }
  return null;
}

// ── Line icons (inherit currentColor) ───────────────────────────────────────
const P = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const Icon = {
  home:     P(<><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></>),
  seasons:  P(<><path d="M12 3c3 3 4 6 4 9a4 4 0 0 1-8 0c0-3 1-6 4-9Z" /><path d="M12 21v-6" /></>),
  games:    P(<><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M8 12h.01M16 12h.01M12 9v6" /></>),
  events:   P(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>),
  progress: P(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
  saved:    P(<><path d="M6 3h12v18l-6-4-6 4Z" /></>),
  play:     P(<><path d="M8 5v14l11-7Z" /></>),
  lock:     P(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  check:    P(<><path d="M20 6 9 17l-5-5" /></>),
  clock:    P(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  chat:     P(<><path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12Z" /></>),
  bookmark: P(<><path d="M6 3h12v18l-6-4-6 4Z" /></>),
  download: P(<><path d="M12 3v12M7 11l5 4 5-4M5 21h14" /></>),
  spark:    P(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>),
  arrow:    P(<><path d="M5 12h14M13 6l6 6-6 6" /></>),
  mic:      P(<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" /></>),
  repeat:   P(<><path d="M17 2l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3" /></>),
  help:     P(<><circle cx="12" cy="12" r="9" /><path d="M9.5 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.5" /><path d="M12 17.2h.01" /></>),
  bulb:     P(<><path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 2Z" /></>),
  send:     P(<><path d="M22 2 11 13M22 2 15 22l-4-9-9-4Z" /></>),
  transcript: P(<><path d="M4 5h16M4 12h16M4 19h10" /></>),
};

// ── Progress ring ───────────────────────────────────────────────────────────
export function Ring({ pct = 0, size = 132, stroke = 9, color = SSL.teal, track = "rgba(255,255,255,.15)", children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg className="ssl-ring" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

export function Btn({ variant = "primary", className = "", children, ...props }) {
  return <button className={`ssl-btn ssl-btn-${variant} ssl-focusable ${className}`} {...props}>{children}</button>;
}
