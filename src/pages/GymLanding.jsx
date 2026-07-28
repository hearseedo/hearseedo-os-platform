import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const CODE = "GYM-HSD-2026";

export default function GymLanding() {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  useEffect(() => {
    sessionStorage.setItem("hsd_pending_code", CODE);
  }, []);

  function start() {
    if (user) {
      navigate("/access-code");
    } else {
      navigate("/?mode=signup");
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#fff",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "32px 20px", textAlign: "center",
    }}>

      {/* Logo area */}
      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 32 }}>
        HSDOS.AI
      </div>

      {/* Hero */}
      <h1 style={{ fontSize: "clamp(28px, 8vw, 48px)", fontWeight: 900, lineHeight: 1.1, margin: "0 0 16px", maxWidth: 480 }}>
        Train your body.<br />
        <span style={{ color: "#2ec4b6" }}>Build your English confidence.</span>
      </h1>

      <p style={{ fontSize: 15, color: "#888", lineHeight: 1.7, maxWidth: 380, margin: "0 0 8px" }}>
        体を鍛えながら、英語の自信も磨く。
      </p>

      {/* Offer box */}
      <div style={{
        margin: "32px 0", padding: "24px 28px",
        background: "#111", border: "1px solid rgba(46,196,182,0.3)",
        borderRadius: 18, maxWidth: 380, width: "100%",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#2ec4b6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
          Your Exclusive Offer / 特別オファー
        </div>
        {[
          "1 month full HSDOS.AI platform access",
          "All learning paths: Kids, Family, University, Adult",
          "30 AI practice credits included",
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 2 ? "1px solid #1a1a1a" : "none", textAlign: "left" }}>
            <span style={{ color: "#2ec4b6", fontWeight: 700, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 14 }}>{item}</span>
          </div>
        ))}

        {/* Code badge */}
        <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(46,196,182,0.08)", border: "1px solid rgba(46,196,182,0.2)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Your access code / アクセスコード</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#2ec4b6", letterSpacing: 2, fontFamily: "monospace" }}>{CODE}</div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={start}
        style={{
          width: "100%", maxWidth: 380, padding: "18px 24px",
          borderRadius: 14, background: "#2ec4b6", border: "none",
          color: "#0a1a1a", fontSize: 17, fontWeight: 800,
          cursor: "pointer", marginBottom: 12, letterSpacing: 0.3,
        }}
      >
        Start My Free Month →
      </button>
      <p style={{ fontSize: 12, color: "#555", margin: 0 }}>
        No credit card needed. Sign up takes 30 seconds.
        <br />クレジットカード不要。30秒で登録完了。
      </p>

      {/* Steps */}
      <div style={{ marginTop: 36, display: "flex", gap: 8, maxWidth: 380, width: "100%" }}>
        {[["1", "Sign up free", "無料登録"], ["2", "Enter code", "コード入力"], ["3", "Start practicing", "練習開始"]].map(([n, en, jp]) => (
          <div key={n} style={{ flex: 1, background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#2ec4b6", marginBottom: 4 }}>{n}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc" }}>{en}</div>
            <div style={{ fontSize: 10, color: "#555" }}>{jp}</div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 40, fontSize: 11, color: "#333" }}>
        HSDOS.AI — Confidence First English for every stage of life.
      </p>
    </div>
  );
}
