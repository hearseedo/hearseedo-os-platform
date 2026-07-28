import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { COLORS } from "../constants/colors";

function cefrLabel(score) {
  if (score < 30) return "A1";
  if (score < 50) return "A2";
  if (score < 70) return "B1";
  return "B2+";
}

function ConfidenceBar({ score }) {
  const pct   = Math.max(0, Math.min(100, score ?? 0));
  const color = pct < 40 ? "#f97316" : pct < 70 ? "#C9A84C" : "#22c55e";
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
          Confidence Level
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>
          {pct}% · {cefrLabel(pct)}
        </span>
      </div>
      <div style={{ height: 8, background: "#1e1e1e", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 4, boxShadow: `0 0 8px ${color}80`,
          transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
        }} />
      </div>
    </div>
  );
}

export default function WeeklyReport({ week, onClose }) {
  const { user }    = useAuth();
  const { lang }    = useLang();
  const jp          = lang === "jp";
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !week) return;
    getDoc(doc(db, "users", user.uid, "weeklyReports", week))
      .then(snap => {
        if (snap.exists()) setReport(snap.data());
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user?.uid, week]);

  const weekNum = week?.split("W")[1] ?? "–";
  const stats   = report?.stats ?? {};

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px 16px 32px",
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #0d0d0d 0%, #120a0a 100%)",
          border: "1px solid rgba(224,16,16,0.2)",
          borderRadius: 20, padding: "32px 28px",
          maxWidth: 480, width: "100%",
          boxShadow: "0 0 80px rgba(224,16,16,0.07)",
          position: "relative",
          animation: "wrIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <style>{`@keyframes wrIn{from{opacity:0;transform:translateY(24px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
        >✕</button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(224,16,16,0.5)", boxShadow: "0 0 14px rgba(224,16,16,0.25)", flexShrink: 0 }}>
            <img src="/assets/jona.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.red, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>JONA · WEEKLY REPORT</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
              {jp ? `第${weekNum}週レポート` : `Week ${weekNum} Report`}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.textMuted, fontSize: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 12, animation: "spin 1s linear infinite" }}>⚙️</div>
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            {jp ? "レポートを読み込んでいます…" : "Loading your report…"}
          </div>
        )}

        {/* No report found */}
        {!loading && !report && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7 }}>
              {jp ? "このレポートはまだ準備できていません。" : "This report isn't available yet. Check back soon."}
            </div>
          </div>
        )}

        {/* Report content */}
        {!loading && report && (
          <>
            {/* Confidence bar */}
            <ConfidenceBar score={stats.confidenceScore} />

            {/* Stats grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
              {[
                { icon: "🔥", value: stats.streak ?? 0,                           label: jp ? "連続日数"   : "Day streak"  },
                { icon: "⭐", value: (stats.xpEarned ?? 0).toLocaleString(),       label: jp ? "総XP"       : "Total XP"   },
                { icon: "✅", value: stats.lessonsCompleted ?? 0,                  label: jp ? "完了レッスン" : "Lessons done" },
                { icon: "📈", value: `${stats.confidenceScore ?? 0}%`,             label: jp ? "自信スコア" : "Confidence"  },
              ].map(s => (
                <div key={s.label} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "14px 10px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, marginBottom: 5 }}>{s.icon}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.red, marginBottom: 2 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: "#555" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Jona's summary */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
                {jp ? "Jonaからのまとめ" : "Jona's Summary"}
              </div>
              <p style={{ fontSize: 14, color: "#bbb", lineHeight: 1.75, margin: 0 }}>
                {jp ? report.summary_jp : report.summary}
              </p>
            </div>

            {/* Strength chip */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "14px 16px", marginBottom: 20,
              background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 14,
            }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>🏆</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#C9A84C", marginBottom: 4 }}>
                  {jp ? report.strength_jp : report.strength}
                </div>
                <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
                  {jp ? report.strengthReason_jp : report.strengthReason}
                </div>
              </div>
            </div>

            {/* Next week recommendation */}
            <div style={{
              padding: "14px 16px", marginBottom: 24,
              background: "rgba(224,16,16,0.06)", border: "1px solid rgba(224,16,16,0.18)", borderRadius: 14,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
                {jp ? "来週のフォーカス" : "Next week's focus"}
              </div>
              <p style={{ fontSize: 13, color: "#999", lineHeight: 1.65, margin: 0 }}>
                {jp ? report.recommendation_jp : report.recommendation}
              </p>
            </div>

            {/* CTA */}
            <button
              onClick={onClose}
              style={{
                width: "100%", padding: "14px", marginBottom: 10,
                background: COLORS.red, border: "none", borderRadius: 10,
                color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 0 20px rgba(224,16,16,0.3)",
              }}
            >
              {jp ? "今週も頑張る →" : "Start this week →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
