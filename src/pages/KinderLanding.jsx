import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const CODE = "KINDER-HSD-2026";

export default function KinderLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();

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

      <div style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: 2, textTransform: "uppercase", marginBottom: 32 }}>
        HSDOS.AI
      </div>

      <h1 style={{ fontSize: "clamp(26px, 7vw, 44px)", fontWeight: 900, lineHeight: 1.15, margin: "0 0 16px", maxWidth: 480 }}>
        English confidence<br />
        <span style={{ color: "#f97316" }}>for every family.</span>
      </h1>

      <p style={{ fontSize: 15, color: "#888", lineHeight: 1.7, maxWidth: 400, margin: "0 0 8px" }}>
        子どもから大人まで。家族みんなで英語の自信を育てよう。
      </p>

      {/* Offer box */}
      <div style={{
        margin: "32px 0", padding: "24px 28px",
        background: "#111", border: "1px solid rgba(249,115,22,0.3)",
        borderRadius: 18, maxWidth: 380, width: "100%",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#f97316", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
          Teacher & Family Offer / 先生・ファミリー特典
        </div>
        {[
          "1 month full HSDOS.AI platform access",
          "Kids, Family, University & Adult paths",
          "30 AI practice credits included",
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < 2 ? "1px solid #1a1a1a" : "none", textAlign: "left" }}>
            <span style={{ color: "#f97316", fontWeight: 700, flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: 14 }}>{item}</span>
          </div>
        ))}

        {/* Code badge */}
        <div style={{ marginTop: 20, padding: "12px 16px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>Your access code / アクセスコード</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#f97316", letterSpacing: 2, fontFamily: "monospace" }}>{CODE}</div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={start}
        style={{
          width: "100%", maxWidth: 380, padding: "18px 24px",
          borderRadius: 14, background: "#f97316", border: "none",
          color: "#fff", fontSize: 17, fontWeight: 800,
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
            <div style={{ fontSize: 18, fontWeight: 900, color: "#f97316", marginBottom: 4 }}>{n}</div>
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
