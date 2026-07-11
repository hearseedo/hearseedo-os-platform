import { useState, useEffect, useRef } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { CATEGORY_MAP, PRACTICE_BANKS } from "./data";
import { srt } from "./i18n";
import {
  askCoach, playTTS,
  buildConversationSystemPrompt, buildOpeningUserMessage, buildConversationUserMessage,
  parseConversationReply,
} from "./ai";
import { recordPracticeResult, addSavedPhrase } from "./storage";
import { getMemorySummary, updateMemorySummary, mergeMemoryNote } from "./memory";

const LANGS = [
  { id: "ja-JP", label: "日本語" },
  { id: "en-US", label: "English" },
];

// Voice-first conversation, Whisper-Flow style: tap the mic, talk in Japanese
// or English, the coach always replies in spoken English with a Japanese
// subtitle underneath so beginners can start before they're fluent. Every
// category (missions, quick thinking, picture speaking, debate) roleplays
// a different persona per scenario.
export default function PracticeSession({ categoryId, user, onExit, onBadgesEarned }) {
  const category = CATEGORY_MAP[categoryId];
  const scenarios = PRACTICE_BANKS[categoryId];
  const { lang } = useLang();
  const tr = (k) => srt(lang, k);
  const jp = lang === "jp";

  const [index, setIndex]         = useState(0);
  const [messages, setMessages]   = useState([]); // [{role:"user"|"assistant", text, en, jp, phrases}]
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking]   = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [speechLang, setSpeechLang] = useState("ja-JP");
  const [showTextFallback, setShowTextFallback] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [savedPhrases, setSavedPhrases] = useState({}); // phrase text -> true
  const memoryRef  = useRef({ summary: "", sessionsCount: 0 });
  const audioRef   = useRef(null);
  const bottomRef  = useRef(null);

  const scenario = scenarios[index];
  const isLast    = index === scenarios.length - 1;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    (async () => {
      memoryRef.current = await getMemorySummary(user?.uid);
      openScenario(0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopSpeaking() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeaking(false);
  }

  function speak(text) {
    if (!ttsEnabled || !user?.uid || !text) return;
    stopSpeaking();
    playTTS(text, user.uid, () => setSpeaking(true), () => setSpeaking(false))
      .then((a) => { if (a) audioRef.current = a; });
  }

  function saveMemoryNote(note) {
    if (!note) return;
    const merged = mergeMemoryNote(memoryRef.current.summary, note);
    memoryRef.current = { summary: merged, sessionsCount: memoryRef.current.sessionsCount };
    updateMemorySummary(user?.uid, merged, memoryRef.current.sessionsCount);
  }

  async function openScenario(idx) {
    setIndex(idx);
    setMessages([]);
    setError("");
    setLoading(true);
    setSavedPhrases({});
    try {
      const s = scenarios[idx];
      const system = buildConversationSystemPrompt(s.persona, memoryRef.current.summary);
      const raw = await askCoach(system, [{ role: "user", content: buildOpeningUserMessage(s.prompt) }], user);
      const parsed = parseConversationReply(raw);
      setMessages([{ role: "assistant", en: parsed.reply_en, jp: parsed.reply_jp, phrases: parsed.phrases }]);
      speak(parsed.reply_en);
      saveMemoryNote(parsed.memory_note);
    } catch (e) {
      setError(jp ? tr("coach_unavailable") : (e.message || tr("coach_unavailable")));
    }
    setLoading(false);
  }

  async function sendTranscript(transcript) {
    const trimmed = transcript.trim();
    if (!trimmed || loading) return;
    setError("");
    const next = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setLoading(true);
    try {
      const system = buildConversationSystemPrompt(scenario.persona, memoryRef.current.summary);
      const history = next.map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.role === "user" ? m.text : m.en,
      }));
      history[history.length - 1] = { role: "user", content: buildConversationUserMessage(trimmed) };
      const raw = await askCoach(system, history, user);
      const parsed = parseConversationReply(raw);
      setMessages([...next, { role: "assistant", en: parsed.reply_en, jp: parsed.reply_jp, phrases: parsed.phrases }]);
      speak(parsed.reply_en);
      saveMemoryNote(parsed.memory_note);
      const { newBadges } = recordPracticeResult(user?.uid, {
        category: categoryId,
        scenarioId: scenario.id,
        confidenceScore: parsed.pulse ?? 60,
      });
      if (newBadges.length) onBadgesEarned?.(newBadges);
    } catch (e) {
      setError(jp ? tr("coach_unavailable") : (e.message || tr("coach_unavailable")));
    }
    setLoading(false);
  }

  function startListening() {
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { setShowTextFallback(true); return; }
    stopSpeaking();
    const r = new SR();
    r.lang = speechLang;
    r.onstart  = () => setListening(true);
    r.onend    = () => setListening(false);
    r.onerror  = () => setListening(false);
    r.onresult = (e) => sendTranscript(e.results[0][0].transcript);
    r.start();
  }

  function submitTextFallback() {
    if (!textInput.trim()) return;
    sendTranscript(textInput);
    setTextInput("");
  }

  function savePhrase(phrase) {
    addSavedPhrase(user?.uid, { category: categoryId, situation: jp && scenario.promptJp ? scenario.promptJp : scenario.prompt, phrase });
    setSavedPhrases((prev) => ({ ...prev, [phrase]: true }));
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={onExit} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
        <button
          onClick={() => !loading && !isLast && openScenario(index + 1)}
          disabled={loading || isLast}
          style={{ marginLeft: "auto", background: "none", border: "none", color: isLast ? COLORS.textDim : category.color, fontSize: 12, fontWeight: 700, cursor: isLast ? "default" : "pointer" }}
        >
          {isLast ? tr("last_topic") : tr("next_topic")}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: `${category.color}22`,
          border: `1px solid ${category.color}55`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 24, flexShrink: 0,
        }}>
          {category.icon}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{jp && category.nameJp ? category.nameJp : category.name}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted }}>
            {tr("topic_of")} {index + 1} {tr("of_word")} {scenarios.length} · {jp && scenario.promptJp ? scenario.promptJp : scenario.prompt}
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {scenarios.map((s, i) => (
          <div key={s.id} style={{ flex: 1, height: 4, borderRadius: 2, background: i < index ? category.color : i === index ? `${category.color}88` : "#222" }} />
        ))}
      </div>

      {/* Chat */}
      <div style={{
        background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 14, padding: 16,
        minHeight: 320, maxHeight: 460, overflowY: "auto", marginBottom: 16,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%", padding: "12px 16px", borderRadius: 14,
              background: m.role === "user" ? `${category.color}22` : COLORS.card,
              border: `1px solid ${m.role === "user" ? `${category.color}44` : "#2a2a2a"}`,
            }}>
              {m.role === "assistant" ? (
                <>
                  <div style={{ fontSize: 14, lineHeight: 1.6 }}>{m.en}</div>
                  {m.jp && <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6, fontStyle: "italic", borderTop: "1px solid #222", paddingTop: 6 }}>{m.jp}</div>}
                  {m.phrases?.length > 0 && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #222" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                        {tr("useful_phrases")}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {m.phrases.map((p, pi) => (
                          <div key={pi} style={{ display: "flex", alignItems: "center", gap: 8, background: "#0d0d0d", border: "1px solid #222", borderRadius: 8, padding: "6px 10px" }}>
                            <span style={{ fontSize: 13, flex: 1 }}>{p}</span>
                            <button
                              onClick={() => savePhrase(p)}
                              disabled={!!savedPhrases[p]}
                              style={{ background: "none", border: "none", color: savedPhrases[p] ? COLORS.success : category.color, fontSize: 11, fontWeight: 700, cursor: savedPhrases[p] ? "default" : "pointer", whiteSpace: "nowrap" }}
                            >
                              {savedPhrases[p] ? tr("phrase_saved") : tr("save_phrase")}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{m.text}</div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: "flex-start", padding: "10px 16px", background: COLORS.card, border: "1px solid #2a2a2a", borderRadius: 14 }}>
              <span style={{ display: "inline-flex", gap: 4 }}>
                {[0, 1, 2].map((i) => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: category.color, animation: `blink 1.2s ${i * 0.2}s ease-in-out infinite` }} />)}
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {error && <div style={{ color: "#ff6b6b", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
        {LANGS.map((l) => (
          <button
            key={l.id}
            onClick={() => setSpeechLang(l.id)}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: "pointer",
              background: speechLang === l.id ? category.color : "#1a1a1a",
              border: `1px solid ${speechLang === l.id ? category.color : "#333"}`,
              color: "#fff",
            }}
          >
            {l.label}
          </button>
        ))}
        <button
          onClick={() => { setTtsEnabled((v) => !v); if (speaking) stopSpeaking(); }}
          title={ttsEnabled ? tr("mute_coach") : tr("unmute_coach")}
          style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 20, padding: "5px 10px", color: ttsEnabled ? category.color : COLORS.textMuted, fontSize: 13, cursor: "pointer" }}
        >
          {ttsEnabled ? "🔊" : "🔇"}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button
          onClick={startListening}
          disabled={loading}
          style={{
            width: 76, height: 76, borderRadius: "50%", border: "none",
            background: listening ? "#ff2020" : loading ? "#333" : category.color,
            color: "#fff", fontSize: 30, cursor: loading ? "default" : "pointer",
            boxShadow: listening ? "0 0 24px rgba(255,32,32,0.5)" : `0 0 20px ${category.color}44`,
            animation: listening ? "pulse 1s ease-in-out infinite" : "none",
          }}
        >
          🎤
        </button>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>
          {listening ? tr("listening") : loading ? tr("coach_thinking") : tr("tap_to_talk")}
        </div>
        <button onClick={() => setShowTextFallback((v) => !v)} style={{ background: "none", border: "none", color: COLORS.textDim, fontSize: 11, cursor: "pointer", textDecoration: "underline" }}>
          {showTextFallback ? tr("hide_typing") : tr("quiet_room")}
        </button>
      </div>

      {showTextFallback && (
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitTextFallback()}
            placeholder={tr("type_placeholder")}
            style={{ flex: 1, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 20, padding: "10px 16px", color: COLORS.text, fontSize: 13 }}
          />
          <button onClick={submitTextFallback} disabled={!textInput.trim() || loading} style={{ ...primaryBtnStyle(category.color), padding: "10px 18px" }}>{tr("send")}</button>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}} @keyframes blink{0%,80%,100%{opacity:0}40%{opacity:1}}`}</style>
    </div>
  );
}

const backBtnStyle = {
  background: "none", border: "none", color: COLORS.textMuted,
  fontSize: 13, cursor: "pointer", padding: 0,
};

const primaryBtnStyle = (color) => ({
  borderRadius: 10, background: color, border: "none",
  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
});
