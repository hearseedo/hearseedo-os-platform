import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { db } from "../lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { resolvePathwayDestination } from "../lib/pathwayAccess";

const N = {
  navy:  "#07091a",
  navy2: "#0c0f27",
  gold:  "#C9A84C",
  white: "#ffffff",
  pale:  "rgba(255,255,255,0.72)",
  muted: "rgba(255,255,255,0.38)",
  dim:   "rgba(255,255,255,0.16)",
  glass: "rgba(255,255,255,0.04)",
  glassB:"1px solid rgba(255,255,255,0.09)",
};

const BUILD_STEPS = [
  { icon: "🧭", label: "Understanding your goals…",    dur: 1400 },
  { icon: "✨", label: "Mapping your learning style…", dur: 1200 },
  { icon: "🌍", label: "Discovering your Worlds…",     dur: 1200 },
  { icon: "🔑", label: "Building your Inner Key…",     dur: 1100 },
  { icon: "⭐", label: "Creating your Blueprint…",     dur: 1000 },
];

export default function Blueprint() {
  const { user, currentPathway } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  const [stepsDone, setStepsDone] = useState([]);
  const [complete, setComplete]   = useState(false);
  const [progress, setProgress]   = useState(0);

  // Animate build steps sequentially
  useEffect(() => {
    let idx = 0;
    let totalMs = 0;

    BUILD_STEPS.forEach((step, i) => {
      setTimeout(() => {
        setStepsDone(p => [...p, i]);
        setProgress(Math.round(((i + 1) / BUILD_STEPS.length) * 100));
      }, totalMs + step.dur * 0.4);
      totalMs += step.dur;
    });

    setTimeout(() => setComplete(true), totalMs + 600);

    return () => {};
  }, []);

  // Constellation canvas
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    let W, H, raf;

    const nodes = Array.from({ length: 24 }, (_, i) => ({
      x: 0, y: 0,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.008,
      active: false,
    }));

    function resize() {
      W = c.width = c.offsetWidth;
      H = c.height = c.offsetHeight;
      nodes.forEach(n => {
        if (!n.active) { n.x = Math.random() * W; n.y = Math.random() * H; }
      });
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      ctx.clearRect(0, 0, W, H);

      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0) n.x = W; if (n.x > W) n.x = 0;
        if (n.y < 0) n.y = H; if (n.y > H) n.y = 0;
        n.a += n.da; if (n.a <= 0 || n.a >= 1) n.da *= -1;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201,168,76,${n.a * 0.8})`; ctx.fill();
      });

      // Connect close nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(201,168,76,${(1 - dist / 120) * 0.12})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);

  const handleEnter = async () => {
    if (user?.uid) {
      await updateDoc(doc(db, "users", user.uid), {
        blueprintDone: true,
        blueprintAt: serverTimestamp(),
      }).catch(() => {});
    }
    // Phase 5 (pathway routing cutover): this is the natural end of the
    // existing sign-in/onboarding chain (SignIn → JoinFlow → Blueprint →
    // here) for EVERY login, not just new signups — so it's the safest
    // single place to resolve "where does this account actually belong".
    // `currentPathway` (useAuth.jsx) is already the authoritative
    // resolution of lastUsedPathway — null unless it's both set AND still
    // in this account's accessiblePathways (covers "invalid" and
    // "access revoked" in one place, no duplicate check needed here).
    // Routing through PATHWAYS[...].route (the same canonical config
    // ChoosePath.jsx uses) rather than a second hardcoded map means a
    // pathway that's since become disabled/coming-soon is handled for
    // free by PathwayRoute's existing LOCKED/COMING_SOON guard, which
    // bounces back to /choose-path itself — no separate case needed here.
    navigate(resolvePathwayDestination(currentPathway), { replace: true });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: N.navy,
      color: N.white,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "60px 24px 48px", position: "relative", overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Constellation canvas */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />

      {/* Gold ambient */}
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 460, textAlign: "center" }}>

        {/* Step label */}
        <div style={{ fontSize: 11, color: N.gold, letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 12, animation: "fadeUp 0.5s both" }}>
          Step 2 of 3
        </div>

        {/* Blueprint title */}
        <h1 style={{ fontSize: "clamp(26px, 5vw, 40px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 8, animation: "fadeUp 0.5s 0.1s both" }}>
          Building your <span style={{ color: N.gold }}>Blueprint</span>
        </h1>

        <p style={{ fontSize: 14, color: N.muted, marginBottom: 40, animation: "fadeUp 0.5s 0.2s both" }}>
          Jona is personalising everything for you.
        </p>

        {/* Progress bar */}
        <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginBottom: 32, overflow: "hidden", animation: "fadeUp 0.5s 0.3s both" }}>
          <div style={{ height: "100%", background: `linear-gradient(90deg, ${N.gold}, #F0C060)`, borderRadius: 2, width: `${progress}%`, transition: "width 0.6s ease", boxShadow: "0 0 8px rgba(201,168,76,0.6)" }} />
        </div>

        {/* Build steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 40, animation: "fadeUp 0.5s 0.4s both" }}>
          {BUILD_STEPS.map((step, i) => {
            const done = stepsDone.includes(i);
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 18px",
                background: done ? "rgba(201,168,76,0.08)" : N.glass,
                border: done ? "1px solid rgba(201,168,76,0.25)" : N.glassB,
                borderRadius: 14,
                transition: "all 0.5s ease",
              }}>
                <span style={{ fontSize: 20, flexShrink: 0, opacity: done ? 1 : 0.3, transition: "opacity 0.4s" }}>{step.icon}</span>
                <span style={{ fontSize: 13, color: done ? N.pale : N.dim, transition: "color 0.4s", textAlign: "left", flex: 1 }}>{step.label}</span>
                {done && (
                  <span style={{ color: N.gold, fontSize: 14, animation: "checkPop 0.3s ease" }}>✓</span>
                )}
                {!done && i === stepsDone.length && (
                  <span style={{ display: "inline-block", width: 14, height: 14 }}>
                    <svg viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite", width: 14, height: 14 }}>
                      <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(201,168,76,0.4)" strokeWidth="2" />
                      <path d="M12 2 A10 10 0 0 1 22 12" fill="none" stroke={N.gold} strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Complete state */}
        {complete && (
          <div style={{ animation: "fadeUp 0.6s both" }}>
            <div style={{
              padding: "20px 24px",
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.3)",
              borderRadius: 20, marginBottom: 24,
            }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: N.white, marginBottom: 6 }}>Your Blueprint is ready</div>
              <div style={{ fontSize: 13, color: N.muted, lineHeight: 1.6 }}>
                Jona has mapped your journey. Your Worlds are waiting.
              </div>
            </div>

            <button
              onClick={handleEnter}
              style={{
                padding: "18px 60px",
                background: N.gold,
                border: "none", borderRadius: 50,
                color: "#0a0700", fontSize: 16, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.02em",
                boxShadow: "0 0 40px rgba(201,168,76,0.5)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 50px rgba(201,168,76,0.6)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 40px rgba(201,168,76,0.5)"; }}
            >
              Enter Your World →
            </button>

            <p style={{ fontSize: 11, color: N.dim, marginTop: 20 }}>
              Step 3: explore your Dashboard and start your first World
            </p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
        @keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes checkPop { from{transform:scale(0)} to{transform:scale(1)} }
      `}</style>
    </div>
  );
}
