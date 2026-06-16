import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { loginWithEmail, signupWithEmail, loginWithGoogle, resetPassword } from "../lib/firebase";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

const BOOT_LINES = [
  "HSD OS v1.0 — INITIALISING...",
  "LOADING INTELLIGENCE LAYER...",
  "CALIBRATING VOICE SYSTEMS...",
  "ESTABLISHING SECURE CONNECTION...",
  "ALL SYSTEMS ONLINE.",
  "AWAITING AUTHENTICATION.",
];

const GREETING = "H.S.D. OS online. Welcome back. Please authenticate to continue.";

async function speakGreeting() {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: GREETING }),
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch { /* silently skip if blocked */ }
}

export default function SignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode]         = useState(searchParams.get("mode") === "signup" ? "signup" : "login");
  const [email, setEmail]       = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");

  // Boot sequence state
  const [bootLines, setBootLines]     = useState([]);
  const [bootDone, setBootDone]       = useState(false);
  const [scanning, setScanning]       = useState(true);
  const [activated, setActivated]     = useState(false);
  const hasActivated = useRef(false);

  // Type out boot lines one by one
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setBootLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => { setBootDone(true); setScanning(false); }, 400);
      }
    }, 380);
    return () => clearInterval(interval);
  }, []);

  // Play voice on first user interaction with the page
  const activate = () => {
    if (hasActivated.current) return;
    hasActivated.current = true;
    setActivated(true);
    speakGreeting();
  };

  const handleSubmit = async () => {
    activate();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        await signupWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      navigate(email === ADMIN_EMAIL ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      console.error("Sign-in error:", err.code, err.message);
      setError(`${friendlyError(err.code)} (${err.code})`);
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    activate();
    if (!email) { setError("Enter your email address above first."); return; }
    setLoading(true); setError("");
    try {
      await resetPassword(email);
      setInfo("Password reset link sent — check your inbox.");
    } catch (err) { setError(friendlyError(err.code)); }
    setLoading(false);
  };

  const handleGoogle = async () => {
    activate();
    setLoading(true); setError("");
    try {
      const result = await loginWithGoogle();
      navigate(result.user.email === ADMIN_EMAIL ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") setError(`${friendlyError(err.code)} (${err.code})`);
    }
    setLoading(false);
  };

  const input = {
    width: "100%", padding: "12px 14px", boxSizing: "border-box",
    background: "#161616", border: "1px solid #2a2a2a",
    borderRadius: 8, color: "#fff", fontSize: 14, outline: "none",
  };

  return (
    <div
      onClick={activate}
      style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}
    >
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(rgba(224,16,16,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(224,16,16,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      {/* Radial glow */}
      <div style={{
        position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: 600, height: 600,
        background: "radial-gradient(circle, rgba(224,16,16,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>

        {/* Avatar + boot sequence */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>

          {/* Avatar with scanning effect */}
          <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
            <div style={{
              width: 110, height: 110, borderRadius: "50%",
              border: `2px solid ${scanning ? "rgba(224,16,16,0.8)" : bootDone ? "rgba(224,16,16,0.4)" : "rgba(224,16,16,0.6)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
              boxShadow: "0 0 30px rgba(224,16,16,0.3), inset 0 0 20px rgba(224,16,16,0.05)",
              animation: "avatarPulse 2s ease-in-out infinite",
              transition: "border-color 0.5s",
            }}>
              <img
                src="/assets/jarvis.png"
                alt="HSD AI"
                style={{ width: 100, height: 100, borderRadius: "50%", objectFit: "cover" }}
              />
              {/* Scanning line */}
              {scanning && (
                <div style={{
                  position: "absolute", left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, transparent, rgba(224,16,16,0.9), transparent)",
                  animation: "scanLine 1.2s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
              {/* Corner brackets */}
              {[
                { top: 4, left: 4, borderTop: "2px solid #e01010", borderLeft: "2px solid #e01010" },
                { top: 4, right: 4, borderTop: "2px solid #e01010", borderRight: "2px solid #e01010" },
                { bottom: 4, left: 4, borderBottom: "2px solid #e01010", borderLeft: "2px solid #e01010" },
                { bottom: 4, right: 4, borderBottom: "2px solid #e01010", borderRight: "2px solid #e01010" },
              ].map((s, i) => (
                <div key={i} style={{ position: "absolute", width: 12, height: 12, ...s }} />
              ))}
            </div>

            {/* Orbit ring */}
            <div style={{
              position: "absolute", top: -8, left: -8, right: -8, bottom: -8,
              borderRadius: "50%",
              border: "1px solid rgba(224,16,16,0.15)",
              animation: "orbitRing 4s linear infinite",
            }} />
            <div style={{
              position: "absolute", top: -16, left: -16, right: -16, bottom: -16,
              borderRadius: "50%",
              border: "1px solid rgba(224,16,16,0.07)",
              animation: "orbitRing 7s linear infinite reverse",
            }} />
          </div>

          {/* System label */}
          <div style={{ fontSize: 10, color: COLORS.red, letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>HEAR SEE DO™</div>
          <div style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 3 }}>OS AI — SECURE ACCESS</div>

          {/* Boot text terminal */}
          <div style={{
            marginTop: 16, padding: "10px 14px",
            background: "rgba(0,0,0,0.6)", border: "1px solid #1a1a1a",
            borderRadius: 8, textAlign: "left", minHeight: 90,
            fontFamily: "monospace",
          }}>
            {bootLines.map((line, i) => (
              <div key={i} style={{
                fontSize: 10, lineHeight: 1.8,
                color: i === bootLines.length - 1 ? (bootDone ? COLORS.red : "#aaa") : "#444",
                letterSpacing: 0.5,
                animation: "fadeIn 0.3s ease",
              }}>
                <span style={{ color: "#333", marginRight: 6 }}>›</span>{line}
              </div>
            ))}
            {!bootDone && (
              <span style={{ display: "inline-block", width: 6, height: 12, background: "#e01010", animation: "cursorBlink 0.8s step-end infinite", verticalAlign: "middle" }} />
            )}
          </div>

          {/* Tap to activate hint — shows after boot, before first click */}
          {bootDone && !activated && (
            <div style={{
              marginTop: 10, fontSize: 10, color: "rgba(224,16,16,0.6)",
              letterSpacing: 2, textTransform: "uppercase",
              animation: "blinkText 1.5s ease-in-out infinite",
            }}>
              ▶ TAP TO ACTIVATE VOICE
            </div>
          )}
        </div>

        {/* Auth card — slides in after boot */}
        <div style={{
          background: COLORS.surface, border: "1px solid #2a2a2a", borderRadius: 16, padding: 32,
          opacity: bootDone ? 1 : 0,
          transform: bootDone ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 700, color: COLORS.text }}>
            {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
          </h2>
          <p style={{ margin: "0 0 24px", fontSize: 13, color: COLORS.textMuted }}>
            {mode === "login" ? "Sign in to your HSD OS account" : mode === "signup" ? "You're joining as a Founding Member 🌟" : "We'll send you a reset link"}
          </p>

          {error && <Alert colour="red">{error}</Alert>}
          {info  && <Alert colour="green">{info}</Alert>}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input style={input} placeholder="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onClick={activate} />
            {(mode === "login" || mode === "signup") && (
              <input
                style={input}
                placeholder={mode === "signup" ? "Create a password (min 6 chars)" : "Password"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onClick={activate}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            )}

            {mode === "login" && (
              <div style={{ textAlign: "right", marginTop: -6 }}>
                <button onClick={() => { setMode("forgot"); setError(""); }} style={{ background: "none", border: "none", color: COLORS.red, fontSize: 12, cursor: "pointer" }}>
                  Forgot password?
                </button>
              </div>
            )}

            <button
              onClick={mode === "forgot" ? handleForgot : handleSubmit}
              disabled={loading}
              style={{
                width: "100%", padding: 13,
                background: loading ? "rgba(224,16,16,0.4)" : COLORS.red,
                border: "none", borderRadius: 8, color: "#fff",
                fontSize: 14, fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                boxShadow: "0 0 16px rgba(224,16,16,0.3)",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Authenticating…" : mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>

            {mode === "login" && (
              <>
                <Divider />
                <button
                  onClick={handleGoogle}
                  disabled={loading}
                  style={{
                    width: "100%", padding: 12, background: "#1a1a1a",
                    border: "1px solid #2a2a2a", borderRadius: 8,
                    color: "#ccc", fontSize: 13, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "#555"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2a2a2a"}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </>
            )}
          </div>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: COLORS.textMuted }}>
            {mode === "login" && (
              <>Don't have a password yet?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Create one</button>
              </>
            )}
            {mode === "signup" && (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Sign in</button>
              </>
            )}
            {mode === "forgot" && (
              <button onClick={() => { setMode("login"); setError(""); setInfo(""); }} style={{ background: "none", border: "none", color: COLORS.red, cursor: "pointer", fontSize: 13 }}>
                ← Back to sign in
              </button>
            )}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: COLORS.textDim, marginTop: 20 }}>
          Secured by Firebase • Hear See Do™
        </p>
        <p style={{ textAlign: "center", fontSize: 11, marginTop: 8, display: "flex", justifyContent: "center", gap: 16 }}>
          <a href="/terms"   style={{ color: COLORS.textDim, textDecoration: "none" }}>Terms of Service</a>
          <a href="/privacy" style={{ color: COLORS.textDim, textDecoration: "none" }}>Privacy Policy</a>
        </p>
      </div>

      <style>{`
        @keyframes avatarPulse {
          0%,100% { box-shadow: 0 0 20px rgba(224,16,16,0.3), inset 0 0 20px rgba(224,16,16,0.05); }
          50%      { box-shadow: 0 0 40px rgba(224,16,16,0.5), inset 0 0 30px rgba(224,16,16,0.08); }
        }
        @keyframes scanLine {
          0%   { top: 0%;   opacity: 1; }
          100% { top: 100%; opacity: 0.2; }
        }
        @keyframes orbitRing {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cursorBlink {
          0%,100% { opacity: 1; } 50% { opacity: 0; }
        }
        @keyframes blinkText {
          0%,100% { opacity: 0.6; } 50% { opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

function Alert({ colour, children }) {
  const c = colour === "red"
    ? { bg: "rgba(224,16,16,0.1)", border: "rgba(224,16,16,0.3)", text: "#ff6060" }
    : { bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)", text: "#22c55e" };
  return (
    <div style={{ padding: "10px 14px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, color: c.text, fontSize: 13, marginBottom: 4 }}>
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
      <span style={{ fontSize: 11, color: "#555" }}>OR</span>
      <div style={{ flex: 1, height: 1, background: "#2a2a2a" }} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

function friendlyError(code) {
  return {
    "auth/invalid-credential":     "Incorrect email or password.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect email or password.",
    "auth/email-already-in-use":   "An account with this email already exists.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/too-many-requests":      "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Please check your connection.",
  }[code] ?? "Something went wrong. Please try again.";
}
