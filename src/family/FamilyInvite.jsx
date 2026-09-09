// HSD Family beta invite redemption (Phase 4, item 3). Mirrors the existing
// AccessCode.jsx pattern (src/pages/AccessCode.jsx) but grants pathwayAccess
// via redeem-beta-invite.js instead of the older accessPass mechanism —
// deliberately not merged into AccessCode.jsx since that's a different,
// already-working flow for a different privilege (platform-wide access
// pass vs. one specific pathway).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { auth } from "../lib/firebase";
import { FAMILY_COLORS } from "./theme";

export default function FamilyInvite() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [state, setState] = useState("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!code.trim() || !user) return;
    setState("loading");
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/redeem-beta-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, code: code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        navigate("/family", { replace: true });
      } else {
        setErrMsg(data.error === "already_used" ? "This invite has already been used." : "That code isn't valid.");
        setState("error");
      }
    } catch {
      setErrMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ maxWidth: 380, width: "100%", background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 20, padding: 28, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>🐵</div>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: FAMILY_COLORS.pink, marginBottom: 6 }}>HSD Family Beta</h1>
        <p style={{ fontSize: 13, color: FAMILY_COLORS.textMuted, marginBottom: 20 }}>
          {lang === "jp" ? "招待コードを入力してください" : "Enter your invite code"}
        </p>
        <input
          value={code}
          onChange={e => { setCode(e.target.value); setState("idle"); }}
          placeholder="HSD-FAMILY-XXXX"
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: `2px solid ${state === "error" ? "#e01010" : FAMILY_COLORS.border}`, fontSize: 15, marginBottom: 12, boxSizing: "border-box", textAlign: "center", letterSpacing: 1 }}
        />
        {state === "error" && <p style={{ fontSize: 12, color: "#e01010", marginBottom: 12 }}>{errMsg}</p>}
        <button type="submit" disabled={state === "loading" || !code.trim()} style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: code.trim() ? FAMILY_COLORS.pink : "#e0d0da", color: "#fff", fontWeight: 800, fontSize: 15, cursor: code.trim() ? "pointer" : "default",
        }}>
          {state === "loading" ? "…" : (lang === "jp" ? "参加する" : "Join the Beta")}
        </button>
      </form>
    </div>
  );
}
