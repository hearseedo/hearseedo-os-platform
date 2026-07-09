import { useState } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { RESUME_TOOLS, RESUME_TOOL_MAP } from "./data";
import { crt } from "./i18n";
import { askCoach, buildResumeSystemPrompt, buildResumeUserMessage, parseResumeResult } from "./ai";
import { recordResumeToolUse, addSavedAnswer } from "./storage";

export default function ResumeTool({ user, onExit, onBadgesEarned }) {
  const { lang } = useLang();
  const tr = (k) => crt(lang, k);
  const jp = lang === "jp";
  const [toolId, setToolId] = useState(null);
  const [notes, setNotes]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [result, setResult] = useState(null);
  const [saved, setSaved]   = useState(false);
  const [dictateLang, setDictateLang] = useState("ja-JP");
  const [listening, setListening] = useState(false);

  const tool = toolId ? RESUME_TOOL_MAP[toolId] : null;

  const startDictation = () => {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { alert("Speech recognition isn't supported in this browser — please type instead."); return; }
    const r = new SR();
    r.lang = dictateLang;
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    r.onresult = (e) => setNotes((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    r.start();
  };

  const polish = async () => {
    const trimmed = notes.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError("");
    try {
      const raw = await askCoach(
        buildResumeSystemPrompt(),
        [{ role: "user", content: buildResumeUserMessage(tool.label, trimmed) }],
        user
      );
      setResult(parseResumeResult(raw));
      setSaved(false);
      const { newBadges } = recordResumeToolUse(user?.uid);
      if (newBadges.length) onBadgesEarned?.(newBadges);
    } catch (e) {
      setError(jp ? tr("coach_unavailable") : (e.message || tr("coach_unavailable")));
    }
    setLoading(false);
  };

  const saveResult = () => {
    addSavedAnswer(user?.uid, {
      category: "resume",
      question: tool.label,
      originalAnswer: notes.trim(),
      betterVersion: result.polished,
    });
    setSaved(true);
  };

  const reset = () => {
    setToolId(null);
    setNotes("");
    setResult(null);
    setError("");
    setSaved(false);
  };

  if (!tool) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
        <button onClick={onExit} style={backBtnStyle}>{tr("back_to_career_ready")}</button>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: "20px 0 6px" }}>{tr("resume_email_tools")}</h1>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 24 }}>
          {tr("resume_tool_desc")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {RESUME_TOOLS.map((t) => (
            <div
              key={t.id}
              onClick={() => setToolId(t.id)}
              style={{
                background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12,
                padding: 16, cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#a855f7"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{t.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{jp && t.labelJp ? t.labelJp : t.label}</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.4 }}>{jp && t.descJp ? t.descJp : t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
      <button onClick={reset} style={backBtnStyle}>{tr("back_to_all_tools")}</button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "20px 0 20px" }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: "rgba(168,85,247,0.15)",
          border: "1px solid rgba(168,85,247,0.4)", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 24, flexShrink: 0,
        }}>
          {tool.icon}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{jp && tool.labelJp ? tool.labelJp : tool.label}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>{jp && tool.descJp ? tool.descJp : tool.desc}</div>
        </div>
      </div>

      {!result && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button
              onClick={startDictation}
              style={{
                width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                background: listening ? "#ff2020" : "#1a1a1a", border: "1px solid #333",
                color: "#fff", fontSize: 16, cursor: "pointer",
                animation: listening ? "pulse 1s ease-in-out infinite" : "none",
              }}
              title={tr("speak_notes")}
            >🎤</button>
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>{tr("or_speak_notes")}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[{ id: "ja-JP", label: "日本語" }, { id: "en-US", label: "English" }].map((l) => (
                <button
                  key={l.id}
                  onClick={() => setDictateLang(l.id)}
                  style={{
                    padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                    background: dictateLang === l.id ? "#a855f7" : "#1a1a1a",
                    border: `1px solid ${dictateLang === l.id ? "#a855f7" : "#333"}`,
                    color: "#fff",
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={tr("resume_placeholder")}
            rows={7}
            style={{
              width: "100%", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 12,
              padding: 16, color: COLORS.text, fontSize: 14, lineHeight: 1.6, resize: "vertical",
              fontFamily: "inherit", marginBottom: 14,
            }}
          />
          {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</div>}
          <button
            onClick={polish}
            disabled={!notes.trim() || loading}
            style={{
              width: "100%", padding: "13px 20px", borderRadius: 12, border: "none",
              background: !notes.trim() || loading ? "#333" : "#a855f7",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: !notes.trim() || loading ? "default" : "pointer",
            }}
          >
            {loading ? tr("polishing") : tr("polish_with_ai")}
          </button>
        </>
      )}

      {result && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          <div style={{
            background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: 12, padding: "16px 18px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
              ✨ {tr("polished_version")}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.polished}</div>
          </div>

          {result.why && (
            <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 4 }}>💬 {tr("why_better")}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{result.why}</div>
            </div>
          )}
          {result.tip && (
            <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, marginBottom: 4 }}>💡 {tr("confidence_tip")}</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{result.tip}</div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setResult(null)} style={secondaryBtnStyle}>{tr("try_again")}</button>
            <button onClick={saveResult} disabled={saved} style={{ ...secondaryBtnStyle, color: saved ? COLORS.success : COLORS.text }}>
              {saved ? tr("saved") : tr("save")}
            </button>
            <button onClick={reset} style={{ ...secondaryBtnStyle, flex: 1, background: "#a855f7", color: "#fff", border: "none" }}>
              {tr("another_tool")}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}

const backBtnStyle = {
  background: "none", border: "none", color: COLORS.textMuted,
  fontSize: 13, cursor: "pointer", padding: 0,
};

const secondaryBtnStyle = {
  padding: "12px 18px", borderRadius: 10, background: "#1a1a1a", border: "1px solid #333",
  color: COLORS.text, fontSize: 13, fontWeight: 700, cursor: "pointer",
};
