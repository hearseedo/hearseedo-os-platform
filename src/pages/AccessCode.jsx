import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { validateAccessCode, activateAccessCode, isAccessActive, formatExpiry, getRemainingCredits } from "../lib/accessCodeUtils";

const BG    = "#0a0a0a";
const CARD  = "#111111";
const TEAL  = "#2ec4b6";
const RED   = "#e01010";
const MUTED = "#888";
const DIM   = "#555";
const WHITE = "#ffffff";

export default function AccessCode() {
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const [code, setCode]   = useState("");
  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [errorType, setErrorType] = useState(null);

  const activePass = user?.accessPass && isAccessActive(user.accessPass) ? user.accessPass : null;

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    // Check if user already has an active pass
    if (activePass) { setErrorType("already_active"); setState("error"); return; }

    const validation = validateAccessCode(trimmed);
    if (!validation.valid) { setErrorType(validation.error); setState("error"); return; }

    setState("loading");
    try {
      const result = await activateAccessCode(user, trimmed);
      if (result.success) setState("success");
      else { setErrorType(result.error ?? "invalid"); setState("error"); }
    } catch {
      setErrorType("invalid");
      setState("error");
    }
  }

  if (state === "success" || activePass) {
    const pass = user?.accessPass ?? activePass;
    return (
      <Page>
        <SuccessCard pass={pass} navigate={navigate} />
      </Page>
    );
  }

  return (
    <Page>
      <div style={{ maxWidth: 520, width: "100%", margin: "0 auto" }}>
        {/* Header */}
        <button
          onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer", padding: "0 0 24px", display: "flex", alignItems: "center", gap: 6 }}
        >
          ← Back to dashboard
        </button>

        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            HSDOS.AI Access Code
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 14px", color: WHITE, lineHeight: 1.2 }}>
            Unlock your free month.
          </h1>
          <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
            Have a kindergarten, university, family, teacher, workshop, event, or partner access code?
          </p>
        </div>

        {/* What you get */}
        <div style={{ background: CARD, border: `1px solid rgba(46,196,182,0.2)`, borderRadius: 16, padding: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>
            Enter your code to unlock
          </div>
          {[
            "1 month full platform access",
            "All HSDOS.AI learning paths",
            "30 AI practice credits included",
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < 2 ? `1px solid #1a1a1a` : "none" }}>
              <span style={{ color: TEAL, fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: 14, color: WHITE }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); setState("idle"); }}
            placeholder="Enter your access code"
            style={{
              width: "100%", padding: "14px 16px", borderRadius: 12, fontSize: 16,
              background: CARD, border: `1px solid ${state === "error" ? RED : "#2a2a2a"}`,
              color: WHITE, outline: "none", letterSpacing: 1, fontWeight: 600,
              boxSizing: "border-box", marginBottom: 12,
            }}
          />
          {state === "error" && <ErrorMessage type={errorType} />}
          <button
            type="submit"
            disabled={state === "loading" || !code.trim()}
            style={{
              width: "100%", padding: 16, borderRadius: 12, fontSize: 16, fontWeight: 800,
              background: code.trim() ? TEAL : "#1a1a1a", border: "none",
              color: code.trim() ? "#0a1a1a" : DIM,
              cursor: code.trim() ? "pointer" : "default", transition: "all 0.2s",
            }}
          >
            {state === "loading" ? "Checking code…" : "Unlock Free Month"}
          </button>
        </form>

        {/* AI credits description */}
        <div style={{ marginTop: 36, padding: 20, background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>
            Use your 30 AI credits for
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px" }}>
            {[
              "Speaking practice", "EIKEN practice", "Phonics support", "Interview practice",
              "Travel conversations", "Presentation feedback", "Resume support", "Email writing",
              "Confidence challenges", "Parent-child practice",
            ].map((item, i) => (
              <div key={i} style={{ fontSize: 12, color: "#aaa", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: TEAL, fontSize: 10 }}>●</span> {item}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: DIM, lineHeight: 1.6, marginTop: 16, marginBottom: 0 }}>
            When your AI credits run out, you can still use all practice materials, templates, examples, saved phrases, and progress tools until your free month ends.
          </p>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: DIM, marginTop: 28, lineHeight: 1.6 }}>
          HSDOS.AI — Confidence First English for every stage of life.
        </p>
      </div>
    </Page>
  );
}

function ErrorMessage({ type }) {
  const messages = {
    invalid:       "This code is not valid. Please check the code and try again.",
    expired:       "This code has expired. Please contact HSDOS.AI for support.",
    already_used:  "This code has already been used on this account.",
    already_active: null, // shown separately below
  };
  const msg = messages[type] ?? messages.invalid;
  if (!msg) return null;
  return (
    <p style={{ fontSize: 13, color: RED, margin: "0 0 12px", padding: "10px 14px", background: "rgba(224,16,16,0.08)", borderRadius: 8 }}>
      {msg}
    </p>
  );
}

function SuccessCard({ pass, navigate }) {
  if (!pass) return null;
  const remaining = pass.aiCreditsRemaining ?? 0;
  const isLow     = remaining > 0 && remaining <= 5;
  const isUsedUp  = remaining === 0;

  return (
    <div style={{ maxWidth: 520, width: "100%", margin: "0 auto", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: TEAL, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
        Success! Your access code has been applied.
      </div>
      <h2 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 8px", color: WHITE }}>Free Month Access Pass</h2>
      <div style={{ display: "inline-block", padding: "4px 14px", background: "rgba(46,196,182,0.15)", border: "1px solid rgba(46,196,182,0.4)", borderRadius: 20, fontSize: 11, fontWeight: 700, color: TEAL, marginBottom: 28 }}>
        ACTIVE
      </div>

      <div style={{ background: CARD, border: `1px solid rgba(46,196,182,0.2)`, borderRadius: 16, padding: 24, marginBottom: 20, textAlign: "left" }}>
        {[
          ["Full platform access", "✓"],
          ["Kids, Family, University & Adult paths", "✓"],
          ["AI practice credits included", `${remaining} / ${pass.aiCreditsGranted ?? 30} remaining`],
          ["Expires on", formatExpiry(pass.expiresAt)],
        ].map(([label, val], i, arr) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #1a1a1a" : "none" }}>
            <span style={{ fontSize: 13, color: MUTED }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: isUsedUp && label.includes("credits") ? RED : TEAL }}>{val}</span>
          </div>
        ))}
      </div>

      {isLow && (
        <p style={{ fontSize: 13, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          You have {remaining} AI credit{remaining !== 1 ? "s" : ""} remaining. Use them for your most important practice sessions.
        </p>
      )}
      {isUsedUp && (
        <p style={{ fontSize: 13, color: RED, background: "rgba(224,16,16,0.08)", border: "1px solid rgba(224,16,16,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          You've used your AI practice credits. You can still use all practice materials, templates, saved phrases, and progress tools until your free month ends.
        </p>
      )}

      <button
        onClick={() => navigate("/dashboard")}
        style={{ width: "100%", padding: 16, borderRadius: 12, background: TEAL, border: "none", color: "#0a1a1a", fontSize: 16, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}
      >
        Start Practicing
      </button>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ width: "100%", padding: 12, borderRadius: 12, background: "transparent", border: "1px solid #2a2a2a", color: MUTED, fontSize: 13, cursor: "pointer" }}
      >
        View All Learning Paths
      </button>
    </div>
  );
}

function Page({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "40px 20px 60px" }}>
      {children}
    </div>
  );
}
