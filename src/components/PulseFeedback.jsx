import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { COLORS } from "../constants/colors";

const MOODS = [
  { id: "struggling", emoji: "😫", en: "Struggling",  jp: "難しい",   color: "#e01010" },
  { id: "ok",         emoji: "😊", en: "It's OK",      jp: "まあまあ", color: "#f59e0b" },
  { id: "loving_it",  emoji: "❤️", en: "Loving it!",   jp: "最高！",   color: "#22c55e" },
];

export default function PulseFeedback({ trigger, onDismiss }) {
  const { user }    = useAuth();
  const { lang }    = useLang();
  const jp          = lang === "jp";
  const [mood, setMood]       = useState(null);
  const [comment, setComment] = useState("");
  const [phase, setPhase]     = useState("rating");
  const [saving, setSaving]   = useState(false);

  const selectedMood = MOODS.find(m => m.id === mood);

  async function submit(skipComment = false) {
    if (!mood || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "feedback"), {
        uid:       user.uid,
        name:      user.name   ?? null,
        email:     user.email  ?? null,
        mood,
        comment:   skipComment ? "" : comment.trim(),
        trigger,
        lang,
        createdAt: serverTimestamp(),
      });
      localStorage.setItem("hsd_pulse_last", Date.now().toString());
      setPhase("thanks");
      setTimeout(onDismiss, 2400);
    } catch (e) {
      console.error("Pulse feedback:", e);
      onDismiss();
    }
    setSaving(false);
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 1200,
      width: 296, background: COLORS.surface,
      border: `1px solid ${selectedMood ? selectedMood.color + "55" : "rgba(224,16,16,0.35)"}`,
      borderRadius: 16, padding: "20px 20px 16px",
      boxShadow: "0 12px 48px rgba(0,0,0,0.7)",
      animation: "pulseSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
      transition: "border-color 0.3s",
    }}>

      {phase === "rating" && (
        <>
          <button
            onClick={onDismiss}
            style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: COLORS.textDim, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 0 }}
          >×</button>

          <div style={{ fontSize: 10, color: COLORS.red, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>
            {jp ? "クイックチェック" : "Quick check-in"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
            {jp ? "最近どうですか？" : "How's it going?"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 18 }}>
            {jp ? "ご家族の英語学習はいかがですか？" : "How is the platform working for your family?"}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {MOODS.map(m => (
              <button
                key={m.id}
                onClick={() => { setMood(m.id); setPhase("comment"); }}
                style={{
                  flex: 1, padding: "12px 4px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.background = m.color + "18"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              >
                <span style={{ fontSize: 28 }}>{m.emoji}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: COLORS.textMuted }}>{jp ? m.jp : m.en}</span>
              </button>
            ))}
          </div>

          <button
            onClick={onDismiss}
            style={{ width: "100%", background: "none", border: "none", color: COLORS.textDim, fontSize: 11, cursor: "pointer", textAlign: "center", padding: "4px 0" }}
          >
            {jp ? "あとで →" : "Maybe later →"}
          </button>
        </>
      )}

      {phase === "comment" && (
        <>
          <div style={{ fontSize: 28, marginBottom: 8 }}>{selectedMood?.emoji}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>
            {jp ? "ありがとうございます！" : "Got it — thank you!"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 12 }}>
            {jp ? "具体的なことがあれば教えてください（任意）" : "Anything specific we should know? (optional)"}
          </div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={jp ? "ご意見・ご要望など…" : "What would make this better for your family?"}
            rows={3}
            style={{
              width: "100%", padding: "10px 12px",
              background: "#0f0f0f", border: "1px solid #2a2a2a",
              borderRadius: 8, color: COLORS.text, fontSize: 12,
              resize: "none", outline: "none", boxSizing: "border-box",
              lineHeight: 1.6, fontFamily: "inherit", transition: "border-color 0.15s",
            }}
            onFocus={e => e.target.style.borderColor = selectedMood?.color ?? COLORS.red}
            onBlur={e  => e.target.style.borderColor = "#2a2a2a"}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => submit(true)}
              style={{ flex: 1, padding: "9px 0", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 7, color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}
            >
              {jp ? "スキップ" : "Skip"}
            </button>
            <button
              onClick={() => submit(false)}
              disabled={saving}
              style={{ flex: 2, padding: "9px 0", background: selectedMood?.color ?? COLORS.red, border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer" }}
            >
              {saving ? "…" : jp ? "送信する" : "Send feedback"}
            </button>
          </div>
        </>
      )}

      {phase === "thanks" && (
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🙏</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.text, marginBottom: 6 }}>
            {jp ? "ありがとうございます！" : "Thank you!"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
            {jp ? "あなたのフィードバックがプラットフォームを進化させます。" : "Your feedback shapes the platform for every family."}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseSlideUp {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
