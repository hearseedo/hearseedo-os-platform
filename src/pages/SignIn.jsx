import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { loginWithEmail, signupWithEmail, loginWithGoogle, resetPassword, db } from "../lib/firebase";
import { doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useLang } from "../hooks/useLang";
import { resolveAuthSuccessDestination } from "../lib/pathwayRouteAccess";

const OWNER_EMAILS = [import.meta.env.VITE_ADMIN_EMAIL, "waltho79@gmail.com"].filter(Boolean);

const N = {
  navy:   "#07091a",
  navy2:  "#0c0f27",
  gold:   "#C9A84C",
  gold2:  "#F0C060",
  red:    "#e01010",
  white:  "#ffffff",
  pale:   "rgba(255,255,255,0.72)",
  muted:  "rgba(255,255,255,0.38)",
  dim:    "rgba(255,255,255,0.16)",
  glass:  "rgba(255,255,255,0.04)",
  glassB: "1px solid rgba(255,255,255,0.09)",
  goldB:  "1px solid rgba(201,168,76,0.35)",
};

// ── STAR CANVAS ───────────────────────────────────────────────────────────────
function StarField() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let W, H, raf;
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random() * 2000, y: Math.random() * 2000,
      r: Math.random() * 1.2 + 0.2,
      a: Math.random(), da: (Math.random() - 0.5) * 0.004,
      sp: Math.random() * 0.08 + 0.01,
    }));
    function resize() { W = c.width = window.innerWidth; H = c.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    function draw() {
      ctx.clearRect(0, 0, W, H);
      stars.forEach(s => {
        s.a += s.da; if (s.a <= 0 || s.a >= 1) s.da *= -1;
        s.x -= s.sp; if (s.x < 0) s.x = W;
        ctx.beginPath(); ctx.arc(s.x % W, s.y % H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.a})`; ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);
  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ── JOIN METHOD CARDS ─────────────────────────────────────────────────────────
function JoinCards({ onSelect }) {
  const { t } = useLang();
  const cards = [
    { id: "member",  icon: "⭐", title: t("join_membership_title"), sub: t("join_membership_sub") },
    { id: "code",    icon: "🔑", title: t("join_code_title"),       sub: t("join_code_sub")       },
    { id: "explore", icon: "🌍", title: t("join_explore_title"),    sub: t("join_explore_sub")    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 400, margin: "0 auto" }}>
      {cards.map(c => (
        <button key={c.id} onClick={() => onSelect(c.id)} style={{
          background: N.glass, border: N.glassB, borderRadius: 16,
          padding: "18px 20px", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", gap: 16,
          transition: "all 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(201,168,76,0.4)"; e.currentTarget.style.background = "rgba(201,168,76,0.06)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; e.currentTarget.style.background = N.glass; }}
        >
          <span style={{ fontSize: 26, flexShrink: 0 }}>{c.icon}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: N.white, marginBottom: 3 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: N.muted }}>{c.sub}</div>
          </div>
          <div style={{ marginLeft: "auto", color: N.gold, fontSize: 16 }}>→</div>
        </button>
      ))}
    </div>
  );
}

// ── AUTH FORM ─────────────────────────────────────────────────────────────────
function AuthForm({ joinMethod, onSuccess, onBack }) {
  const [mode, setMode]       = useState(joinMethod === "member" ? "signup" : joinMethod === "explore" ? "signup" : "signup");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [info, setInfo]       = useState("");
  const [isHuman, setIsHuman] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const navigate = useNavigate();

  const inp = {
    width: "100%", padding: "13px 16px",
    background: "rgba(255,255,255,0.06)", border: N.glassB,
    borderRadius: 10, color: N.white, fontSize: 14,
    outline: "none", fontFamily: "inherit",
  };

  const handleSubmit = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    if (mode === "signup") {
      if (honeypot) return;
      if (!isHuman) { setError("Please confirm you are a real person."); return; }
    }
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        const cred = await signupWithEmail(email, password);
        await setDoc(doc(db, "users", cred.user.uid), {
          email, name: email.split("@")[0],
          joinMethod, createdAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});
        const ref = sessionStorage.getItem("hsd_ref");
        if (ref && ref !== cred.user.uid) {
          await updateDoc(doc(db, "users", cred.user.uid), { referredBy: ref }).catch(() => {});
          sessionStorage.removeItem("hsd_ref");
        }
      } else {
        await loginWithEmail(email, password);
      }
      onSuccess(email);
    } catch (err) {
      setError(friendlyError(err.code));
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true); setError("");
    try {
      const result = await loginWithGoogle();
      await setDoc(doc(db, "users", result.user.uid), {
        email: result.user.email,
        name: result.user.displayName || result.user.email.split("@")[0],
        joinMethod, createdAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
      const ref = sessionStorage.getItem("hsd_ref");
      if (ref && ref !== result.user.uid) {
        await updateDoc(doc(db, "users", result.user.uid), { referredBy: ref }).catch(() => {});
        sessionStorage.removeItem("hsd_ref");
      }
      onSuccess(result.user.email);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") setError(friendlyError(err.code));
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) { setError("Enter your email first."); return; }
    setLoading(true); setError("");
    try { await resetPassword(email); setInfo("Reset link sent — check your inbox."); }
    catch (err) { setError(friendlyError(err.code)); }
    setLoading(false);
  };

  return (
    <div style={{ width: "100%", maxWidth: 400, margin: "0 auto" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: N.muted, fontSize: 12, cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back
      </button>

      {joinMethod === "code" && mode === "signup" && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: N.gold, letterSpacing: "0.15em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>Your Access Code</label>
          <input
            style={{ ...inp, borderColor: "rgba(201,168,76,0.4)", letterSpacing: "0.15em", textTransform: "uppercase", fontSize: 16, fontWeight: 700 }}
            placeholder="ENTER CODE"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
          />
          <div style={{ fontSize: 11, color: N.muted, marginTop: 6 }}>Workbook, school, event and promotional codes are all valid.</div>
        </div>
      )}

      {error && <div style={{ padding: "10px 14px", background: "rgba(224,16,16,0.1)", border: "1px solid rgba(224,16,16,0.3)", borderRadius: 10, color: "#ff6060", fontSize: 13, marginBottom: 14 }}>{error}</div>}
      {info  && <div style={{ padding: "10px 14px", background: "rgba(34,197,94,0.1)",  border: "1px solid rgba(34,197,94,0.3)",  borderRadius: 10, color: "#22c55e", fontSize: 13, marginBottom: 14 }}>{info}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input style={inp} placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />

        {mode !== "forgot" && (
          <input style={inp} placeholder={mode === "signup" ? "Create a password (min 6 chars)" : "Password"} type="password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
        )}

        {mode === "login" && (
          <div style={{ textAlign: "right", marginTop: -4 }}>
            <button onClick={() => { setMode("forgot"); setError(""); }} style={{ background: "none", border: "none", color: N.gold, fontSize: 12, cursor: "pointer" }}>Forgot password?</button>
          </div>
        )}

        {mode === "signup" && (
          <>
            <input tabIndex={-1} aria-hidden="true" value={honeypot} onChange={e => setHoneypot(e.target.value)}
              style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} autoComplete="off" />
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={isHuman} onChange={e => setIsHuman(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: N.gold, cursor: "pointer", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: N.muted }}>I confirm I'm a real person, not a bot</span>
            </label>
          </>
        )}

        <button onClick={mode === "forgot" ? handleForgot : handleSubmit} disabled={loading} style={{
          width: "100%", padding: "16px",
          background: loading ? "rgba(201,168,76,0.4)" : N.gold,
          border: "none", borderRadius: 50, color: "#0a0700",
          fontSize: 15, fontWeight: 700, cursor: loading ? "wait" : "pointer",
          boxShadow: `0 0 32px rgba(201,168,76,0.4)`, letterSpacing: "0.02em",
        }}>
          {loading ? "Please wait…" : mode === "login" ? "Sign In" : mode === "signup" ? "Begin Your Journey →" : "Send Reset Link"}
        </button>

        {mode === "login" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: N.dim }} />
              <span style={{ fontSize: 11, color: N.dim }}>OR</span>
              <div style={{ flex: 1, height: 1, background: N.dim }} />
            </div>
            <button onClick={handleGoogle} disabled={loading} style={{
              width: "100%", padding: "13px", background: N.glass,
              border: N.glassB, borderRadius: 10, color: N.pale,
              fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              <GoogleIcon /> Continue with Google
            </button>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: N.muted }}>
        {mode === "signup" && <span>Already have an account?{" "}<button onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: N.gold, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Sign in</button></span>}
        {mode === "login"  && <span>Don't have an account?{" "}<button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: N.gold, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Create one</button></span>}
        {mode === "forgot" && <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} style={{ background: "none", border: "none", color: N.gold, cursor: "pointer", fontSize: 13 }}>← Back to sign in</button>}
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: N.dim, marginTop: 24 }}>
        <a href="/terms" style={{ color: N.dim, textDecoration: "none" }}>Terms</a>{"  ·  "}
        <a href="/privacy" style={{ color: N.dim, textDecoration: "none" }}>Privacy</a>{"  ·  "}
        <a href="/disclaimer" style={{ color: N.dim, textDecoration: "none" }}>Disclaimer</a>
      </p>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { lang, setLang, t } = useLang();
  const [step, setStep]           = useState("welcome"); // welcome | how | auth
  const [joinMethod, setJoinMethod] = useState(null);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) sessionStorage.setItem("hsd_ref", ref);
    if (searchParams.get("mode") === "signup") setStep("how");
  }, []);

  const onSuccess = (email) => {
    navigate(resolveAuthSuccessDestination(email, OWNER_EMAILS), { replace: true });
  };

  const ring = (size, opacity, dur, rev) => ({
    position: "absolute", top: "50%", left: "50%",
    transform: `translate(-50%, -50%)`,
    width: size, height: size, borderRadius: "50%",
    border: `1px solid rgba(201,168,76,${opacity})`,
    animation: `orbit ${dur}s linear infinite${rev ? " reverse" : ""}`,
    pointerEvents: "none",
  });

  return (
    <div style={{ minHeight: "100vh", background: N.navy, backgroundImage: "url('/assets/bg/gold-particles.png')", backgroundSize: "cover", backgroundPosition: "center", color: N.white, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px 48px", position: "relative", overflow: "hidden", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif" }}>
      <StarField />

      {/* Language toggle — top right */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 20, overflow: "hidden" }}>
        {["en", "jp"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: "6px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
            background: lang === l ? "#C9A84C" : "transparent",
            color: lang === l ? "#0a0700" : "rgba(255,255,255,0.45)",
            border: "none", cursor: "pointer", transition: "all 0.15s",
          }}>{l === "en" ? "EN" : "JP"}</button>
        ))}
      </div>

      {/* Ambient glow */}
      <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, rgba(224,16,16,0.04) 40%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 480, textAlign: "center" }}>

        {/* ── STEP 1: WELCOME ── */}
        {step === "welcome" && (
          <>
            {/* Adult Jona — upper body in circle */}
            <div style={{ position: "relative", display: "inline-block", marginBottom: 36, animation: "jonaFloat 6s ease-in-out infinite" }}>
              <div style={{ position: "absolute", inset: -20, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.22) 0%, transparent 70%)", animation: "glowPulse 3s ease-in-out infinite" }} />
              <div style={{
                width: 140, height: 140, borderRadius: "50%", overflow: "hidden",
                border: "2px solid rgba(201,168,76,0.5)",
                boxShadow: "0 0 40px rgba(201,168,76,0.3), 0 0 80px rgba(201,168,76,0.1)",
                position: "relative",
              }}>
                <img
                  src="/assets/jona/pose-waving.png"
                  alt="Jona"
                  style={{ width: "160%", height: "160%", objectFit: "cover", objectPosition: "top center", marginLeft: "-30%", marginTop: "-8%" }}
                />
              </div>
            </div>

            <div style={{ fontSize: 11, color: N.red, letterSpacing: "0.28em", textTransform: "uppercase", marginBottom: 12, animation: "fadeUp 0.7s 0.1s both" }}>HEAR SEE DO™ · OS AI</div>

            <div style={{ fontSize: 16, color: N.muted, marginBottom: 6, animation: "fadeUp 0.7s 0.25s both" }}>
              {lang === "jp" ? "はじめまして、Jonaです。" : "Hi, I'm Jona."}
            </div>

            <h1 style={{ fontSize: "clamp(34px, 7vw, 56px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 12, animation: "fadeUp 0.7s 0.35s both" }}>
              {lang === "jp" ? <><span style={{ color: N.gold }}>HSDOS</span>へようこそ</> : <>Welcome to <span style={{ color: N.gold }}>HSDOS</span></>}
            </h1>

            <p style={{ fontSize: 15, color: N.muted, lineHeight: 1.65, marginBottom: 40, maxWidth: 340, margin: "0 auto 40px", animation: "fadeUp 0.7s 0.45s both", whiteSpace: "pre-line" }}>
              {t("welcome_sub")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animation: "fadeUp 0.7s 0.55s both" }}>
              <button onClick={() => setStep("how")} style={{ padding: "18px 52px", background: N.gold, border: "none", borderRadius: 50, color: "#0a0700", fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: "0.02em", boxShadow: "0 0 40px rgba(201,168,76,0.5), 0 4px 20px rgba(0,0,0,0.4)", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = N.gold2; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = N.gold; e.currentTarget.style.transform = "none"; }}
              >
                {t("begin_journey")}
              </button>
              <button onClick={() => { setJoinMethod("login"); setStep("auth"); }} style={{ background: "none", border: "none", color: N.muted, fontSize: 12, cursor: "pointer", letterSpacing: "0.08em" }}>
                {t("already_member")} {t("sign_in_link")}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: HOW JOINING ── */}
        {step === "how" && (
          <>
            <div style={{ marginBottom: 8, fontSize: 11, color: N.gold, letterSpacing: "0.2em", textTransform: "uppercase", animation: "fadeUp 0.5s both" }}>{t("how_joining")}</div>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 700, marginBottom: 32, animation: "fadeUp 0.5s 0.1s both" }}>{t("choose_path")}</h2>
            <div style={{ animation: "fadeUp 0.5s 0.2s both" }}>
              <JoinCards onSelect={method => { setJoinMethod(method); setStep("auth"); }} />
            </div>
            <button onClick={() => setStep("welcome")} style={{ marginTop: 28, background: "none", border: "none", color: N.muted, fontSize: 12, cursor: "pointer" }}>{t("back")}</button>
          </>
        )}

        {/* ── STEP 3: AUTH ── */}
        {step === "auth" && (
          <div style={{ animation: "fadeUp 0.5s both" }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: N.gold, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 8 }}>
                {joinMethod === "code" ? "Enter your code + create account" : joinMethod === "explore" ? "Start for free" : joinMethod === "login" ? "Welcome back" : "Create your account"}
              </div>
              <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 700 }}>
                {joinMethod === "login" ? "Sign in to HSDOS" : "Join HSDOS"}
              </h2>
            </div>
            <AuthForm joinMethod={joinMethod} onSuccess={onSuccess} onBack={() => setStep(joinMethod === "login" ? "welcome" : "how")} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes orbit    { from{transform:translate(-50%,-50%) rotate(0deg)} to{transform:translate(-50%,-50%) rotate(360deg)} }
        @keyframes jonaFloat{ 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes glowPulse{ 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function friendlyError(code) {
  return {
    "auth/invalid-credential":   "Incorrect email or password.",
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/too-many-requests":    "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
  }[code] ?? "Something went wrong. Please try again.";
}
