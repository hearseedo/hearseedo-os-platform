// Sip Speak Learn — full solo lesson flow (Phase 2)
// intro → confidence(pre) → HEAR → SEE → DO(interface) → feedback(+post) → reflection → done
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { SSL, CONFIDENCE_LEVELS, DIFFICULTY_LEVELS } from "./constants";
import { Icon, Btn, Ring, DrinkSpin } from "./ui";
import { SEASON_MAP, LESSONS_BY_SEASON, LESSON_DURATION_MIN, REFLECTION_ORDER, SEASONS, lessonThumb } from "./data";
import { describePhrase } from "./see";
import { playDialogue, speakLine, cancelSpeech, speechSupported } from "./audio";
import {
  buildConversationSystemPrompt, buildOpeningUserMessage, buildTurnUserMessage,
  buildHintRequest, buildClarifyRequest, parseAIReply, converseWithAI,
} from "./ai";
import {
  markLessonStarted, markLessonCompleted, recordConfidence, setDifficulty,
  addSpeakingSeconds, recordConversationDone, saveExpression, removeExpression, isExpressionSaved,
} from "./storage";

const STAGES = ["intro", "confidence-pre", "hear", "see", "do", "feedback", "reflection"];

export default function Lesson({ seasonId, n, uid, onExit }) {
  const season = SEASON_MAP[seasonId];
  const lesson = LESSONS_BY_SEASON[seasonId]?.find((l) => l.n === n);
  const { user } = useAuth();
  const [stage, setStage] = useState("intro");
  const [difficulty, setDiff] = useState("intermediate");
  const [pre, setPre] = useState(null);
  const [post, setPost] = useState(null);
  const [speakingSecs, setSpeakingSecs] = useState(0);
  const [conversation, setConversation] = useState(null);

  useEffect(() => { cancelSpeech(); window.scrollTo?.(0, 0); }, [stage]);
  useEffect(() => () => cancelSpeech(), []);

  if (!lesson) return null;
  const goStage = (s) => setStage(s);

  const common = { lesson, season, uid, user, difficulty };

  return (
    <div>
      <button onClick={() => { cancelSpeech(); onExit(); }} className="ssl-focusable"
        style={{ display: "block", background: "none", border: "none", color: SSL.copper, fontWeight: 600, cursor: "pointer", marginBottom: 12, fontSize: 14, padding: 0 }}>
        ← {season.name}
      </button>

      {stage === "intro" && (
        <Intro {...common} setDiff={(d) => { setDiff(d); setDifficulty(uid, d); }}
          onStart={() => { markLessonStarted(uid, seasonId, n); goStage("confidence-pre"); }} />
      )}
      {stage === "confidence-pre" && (
        <ConfidenceCheck lesson={lesson} title="Before we start"
          question="How confident do you feel discussing this topic in English?"
          onPick={(v) => { setPre(v); recordConfidence(uid, lesson.id, "pre", v); goStage("hear"); }} />
      )}
      {stage === "hear" && <Hear {...common} onNext={() => goStage("see")} />}
      {stage === "see"  && <See  {...common} onNext={() => goStage("do")} />}
      {stage === "do"   && (
        <Do {...common} onFinish={(secs, convo) => {
          setSpeakingSecs(secs);
          setConversation(convo);
          addSpeakingSeconds(uid, secs);
          recordConversationDone(uid);
          goStage("feedback");
        }} />
      )}
      {stage === "feedback" && (
        <Feedback {...common} speakingSecs={speakingSecs} pre={pre} conversation={conversation}
          onPost={(v) => { setPost(v); recordConfidence(uid, lesson.id, "post", v); }}
          post={post} onNext={() => goStage("reflection")} />
      )}
      {stage === "reflection" && (
        <Reflection lesson={lesson} pre={pre} post={post}
          onFinish={() => { markLessonCompleted(uid, lesson.id); onExit(true); }} />
      )}
    </div>
  );
}

// ── Shared: Hear/See/Do stepper ─────────────────────────────────────────────
function Stepper({ active }) {
  const steps = [["hear", "HEAR"], ["see", "SEE"], ["do", "DO"]];
  const idx = steps.findIndex(([k]) => k === active);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 26, flexWrap: "wrap" }}>
      {steps.map(([k, label], i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "todo";
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14,
              background: state === "todo" ? "transparent" : SSL.copper,
              color: state === "todo" ? SSL.textMuted : "#fff",
              border: state === "todo" ? `2px solid ${SSL.border}` : "none" }}>
              {state === "done" ? <span style={{ width: 15, height: 15 }}>{Icon.check}</span> : i + 1}
            </div>
            <span style={{ fontWeight: 700, letterSpacing: ".08em", fontSize: 13,
              color: state === "active" ? SSL.ink : SSL.textMuted }}>{label}</span>
            {i < 2 && <div style={{ width: 40, height: 2, background: i < idx ? SSL.copper : SSL.border, margin: "0 4px" }} />}
          </div>
        );
      })}
    </div>
  );
}

function DrinksCard({ lesson }) {
  return (
    <div className="ssl-card" style={{ padding: 20, background: SSL.navy, border: "none", color: SSL.onNavy }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 12.5, letterSpacing: ".1em", color: SSL.copperLight }}>
        <span style={{ width: 16, height: 16 }}>{Icon.spark}</span> DRINKS FOR THE MOMENT
      </div>
      {[["Cocktail", "cocktail", lesson.cocktail], ["Mocktail", "mocktail", lesson.mocktail]].map(([label, type, d], i) => (
        <div key={label} style={{ marginTop: 12, paddingTop: i ? 12 : 0, borderTop: i ? `1px solid ${SSL.borderNavy}` : "none", display: "flex", gap: 12, alignItems: "center" }}>
          <DrinkSpin id={lesson.id} type={type} size={72} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: SSL.onNavyMuted, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</div>
            <div className="ssl-serif" style={{ fontSize: 18, color: "#fff", marginTop: 2 }}>{d.name}</div>
            <div style={{ fontSize: 12.5, color: SSL.onNavyMuted, marginTop: 3 }}>{d.ingredients}</div>
          </div>
        </div>
      ))}
      <p style={{ fontSize: 11.5, color: SSL.onNavyMuted, marginTop: 14, lineHeight: 1.5 }}>
        Every cocktail has an equal mocktail. Please enjoy responsibly.
      </p>
    </div>
  );
}

function SceneVisual({ season, lesson, height = 210 }) {
  return (
    <div style={{ height, borderRadius: SSL.radius, overflow: "hidden", position: "relative",
      background: `linear-gradient(135deg, ${season.accent}66, ${SSL.navy})`, display: "flex", alignItems: "flex-end", padding: 16 }}>
      <img src={lessonThumb(lesson.id)} alt={lesson.setting} loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(10,26,46,.82))" }} />
      <div style={{ position: "relative", color: "#fff" }}>
        <div style={{ fontSize: 12, opacity: .85 }}>{season.icon} {season.name}</div>
        <div className="ssl-serif" style={{ fontSize: 17 }}>{lesson.setting}</div>
      </div>
    </div>
  );
}

// ── Intro ───────────────────────────────────────────────────────────────────
function Intro({ lesson, season, difficulty, setDiff, onStart }) {
  return (
    <>
      <span className="ssl-eyebrow">Lesson {lesson.n} · {season.name}</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 600, margin: "6px 0 4px" }}>{lesson.theme}</h1>
      <p style={{ color: SSL.inkSoft, fontSize: 16, maxWidth: 640 }}>{lesson.setting}</p>

      <div className="ssl-row" style={{ marginTop: 22, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <div className="ssl-card" style={{ padding: 22 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copper, letterSpacing: ".08em" }}>CONVERSATION OBJECTIVE</div>
            <p className="ssl-serif" style={{ fontSize: 20, marginTop: 8, lineHeight: 1.35 }}>{lesson.objective}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <Pill>{Icon.clock} {LESSON_DURATION_MIN}</Pill>
              <Pill>6 key expressions</Pill>
              <Pill>Hear · See · Do</Pill>
            </div>
          </div>

          <div className="ssl-card" style={{ padding: 22, marginTop: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copper, letterSpacing: ".08em", marginBottom: 12 }}>CHOOSE YOUR LEVEL</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {DIFFICULTY_LEVELS.map((d) => (
                <button key={d.id} onClick={() => setDiff(d.id)} className="ssl-focusable"
                  style={{ flex: "1 1 120px", padding: "14px 16px", borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: 15,
                    border: `1.5px solid ${difficulty === d.id ? SSL.copper : SSL.border}`,
                    background: difficulty === d.id ? SSL.copper : "transparent",
                    color: difficulty === d.id ? "#fff" : SSL.ink }}>
                  {d.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: SSL.textMuted, marginTop: 12 }}>
              This sets how the practice prompt is pitched — you can change it any time.
            </p>
          </div>
        </div>

        <div style={{ flex: "0 0 300px" }}>
          <DrinksCard lesson={lesson} />
          <Btn onClick={onStart} style={{ width: "100%", marginTop: 16 }}>
            Start Lesson <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span>
          </Btn>
        </div>
      </div>
    </>
  );
}

function Pill({ children }) {
  return (
    <span className="ssl-pill" style={{ background: SSL.creamPanel, color: SSL.inkSoft }}>
      {Array.isArray(children) ? children.map((c, i) => (typeof c === "object" ? <span key={i} style={{ width: 15, height: 15 }}>{c}</span> : <span key={i}>{c}</span>)) : children}
    </span>
  );
}

// ── Confidence check (reused pre + post) ────────────────────────────────────
function ConfidenceCheck({ title, question, onPick, initial }) {
  return (
    <div style={{ maxWidth: 640, margin: "10px auto", textAlign: "center", padding: "20px 0" }}>
      <span className="ssl-eyebrow">{title}</span>
      <h2 className="ssl-serif" style={{ fontSize: "clamp(24px,3.2vw,34px)", fontWeight: 600, margin: "10px 0 26px", lineHeight: 1.25 }}>{question}</h2>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {CONFIDENCE_LEVELS.map((c) => (
          <button key={c.value} onClick={() => onPick(c.value)} className="ssl-card ssl-focusable"
            style={{ flex: "1 1 120px", maxWidth: 140, padding: "20px 12px", cursor: "pointer", background: SSL.creamCard,
              border: `1.5px solid ${initial === c.value ? SSL.copper : SSL.border}` }}>
            <div style={{ fontSize: 30 }}>{c.emoji}</div>
            <div style={{ fontWeight: 700, marginTop: 8, fontSize: 15 }}>{c.label}</div>
            <div style={{ fontSize: 11.5, color: SSL.textMuted, marginTop: 3 }}>{c.hint}</div>
          </button>
        ))}
      </div>
      <p style={{ fontSize: 13, color: SSL.textMuted, marginTop: 20 }}>There's no wrong answer — this just helps track your confidence.</p>
    </div>
  );
}

// ── HEAR ────────────────────────────────────────────────────────────────────
function Hear({ lesson, season, onNext }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(-1);
  const [slow, setSlow] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const [answered, setAnswered] = useState(null);
  const ctrl = useRef(null);

  const rate = slow ? 0.75 : 1;

  const playAll = () => {
    ctrl.current?.cancel();
    setPlaying(true);
    ctrl.current = playDialogue(lesson.dialogue, {
      rate, onLine: setCurrent,
      onDone: () => { setPlaying(false); setCurrent(-1); },
    });
  };
  const stop = () => { ctrl.current?.cancel(); setPlaying(false); setCurrent(-1); };
  const replayLine = (i) => { ctrl.current?.cancel(); setCurrent(i); setPlaying(false);
    speakLine(lesson.dialogue[i].line, { rate, onend: () => setCurrent(-1) }); };
  useEffect(() => () => ctrl.current?.cancel(), []);

  // Gist comprehension: which theme are they discussing?
  const options = useRef(shuffle([lesson.theme, ...otherThemes(lesson.theme, 2)])).current;

  return (
    <>
      <Stepper active="hear" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 600 }}>{lesson.theme}</h1>
          <div style={{ color: SSL.textMuted, fontSize: 14, marginTop: 2 }}>Lesson {lesson.n} · {season.name}</div>
        </div>
      </div>

      <div className="ssl-row" style={{ marginTop: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <div className="ssl-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: SSL.teal, fontWeight: 700, marginBottom: 14 }}>
              <span style={{ width: 20, height: 20 }}>{Icon.chat}</span> HEAR · Natural Dialogue
            </div>
            {lesson.dialogue.map((d, i) => (
              <div key={i} onClick={() => replayLine(i)} role="button" tabIndex={0}
                style={{ display: "flex", gap: 12, padding: "10px 12px", borderRadius: 12, cursor: "pointer", marginBottom: 4,
                  background: current === i ? `${season.accent}22` : "transparent",
                  borderLeft: current === i ? `3px solid ${SSL.teal}` : "3px solid transparent" }}>
                <div style={{ fontWeight: 700, color: SSL.teal, minWidth: 62, fontSize: 15 }}>{d.speaker}</div>
                <div style={{ fontSize: 15.5, color: SSL.ink, flex: 1, opacity: showTranscript ? 1 : 0.001 }}>
                  {showTranscript ? d.line : "•••••"}
                </div>
                <span style={{ width: 17, height: 17, color: SSL.textMuted, flexShrink: 0 }}>{Icon.play}</span>
              </div>
            ))}

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16, flexWrap: "wrap", paddingTop: 14, borderTop: `1px solid ${SSL.border}` }}>
              <button onClick={playing ? stop : playAll} className="ssl-focusable"
                style={{ width: 52, height: 52, borderRadius: "50%", border: "none", background: SSL.teal, color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: 22, height: 22 }}>{playing ? Icon.check : Icon.play}</span>
              </button>
              <button onClick={() => setSlow((s) => !s)} className="ssl-focusable"
                style={{ ...ctrlBtn, background: slow ? SSL.copper : "transparent", color: slow ? "#fff" : SSL.ink, borderColor: slow ? SSL.copper : SSL.border }}>
                0.8× Slow
              </button>
              <button onClick={() => setShowTranscript((s) => !s)} className="ssl-focusable"
                style={{ ...ctrlBtn }}>
                {showTranscript ? "Hide" : "Show"} Transcript
              </button>
              {!speechSupported && <span style={{ fontSize: 12.5, color: SSL.warning }}>Audio isn't supported in this browser — read along instead.</span>}
            </div>
          </div>

          {/* Comprehension */}
          <div className="ssl-card" style={{ padding: 22, marginTop: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copper, letterSpacing: ".08em", marginBottom: 12 }}>ONE QUICK CHECK</div>
            <div className="ssl-serif" style={{ fontSize: 19, marginBottom: 14 }}>What are the speakers mainly talking about?</div>
            {options.map((opt, i) => {
              const isCorrect = opt === lesson.theme;
              const chosen = answered === opt;
              const show = answered != null;
              return (
                <button key={i} disabled={show} onClick={() => setAnswered(opt)} className="ssl-focusable"
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "13px 16px", borderRadius: 12, marginBottom: 8, cursor: show ? "default" : "pointer",
                    fontSize: 15, fontWeight: 500,
                    border: `1.5px solid ${show && isCorrect ? SSL.success : chosen ? SSL.danger : SSL.border}`,
                    background: show && isCorrect ? "#e8f3ec" : chosen && !isCorrect ? "#f7e9eb" : "transparent",
                    color: SSL.ink }}>
                  {opt}{show && isCorrect ? "  ✓" : ""}
                </button>
              );
            })}
            {answered != null && (
              <p style={{ fontSize: 13.5, color: SSL.inkSoft, marginTop: 6 }}>
                {answered === lesson.theme ? "Exactly — you caught the gist. Nicely done." : "Close — listen once more and you'll hear it. No pressure."}
              </p>
            )}
          </div>
        </div>

        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 16 }}>
          <SceneVisual season={season} lesson={lesson} />
          <DrinksCard lesson={lesson} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Btn onClick={() => { cancelSpeech(); onNext(); }} style={{ width: "100%", maxWidth: 420 }}>
          Continue to SEE <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span>
        </Btn>
      </div>
    </>
  );
}
const ctrlBtn = { padding: "9px 16px", borderRadius: 10, border: `1px solid ${SSL.border}`, background: "transparent", cursor: "pointer", fontWeight: 600, fontSize: 14, color: SSL.ink };

// ── SEE ─────────────────────────────────────────────────────────────────────
function See({ lesson, season, uid, onNext }) {
  const [, force] = useState(0);
  const rerender = () => force((n) => n + 1);
  const [understood, setUnderstood] = useState({});

  return (
    <>
      <Stepper active="see" />
      <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,3.6vw,40px)", fontWeight: 600 }}>Key Expressions</h1>
      <p style={{ color: SSL.inkSoft, marginTop: 4, marginBottom: 20 }}>Six natural phrases from this conversation. Tap to hear, save the ones you like.</p>

      <div className="ssl-grid2">
        {lesson.keyPhrases.map((phrase, i) => {
          const { meaning, example } = describePhrase(phrase, lesson);
          const saved = isExpressionSaved(uid, phrase);
          const ok = understood[phrase];
          return (
            <div key={i} className="ssl-card" style={{ padding: 20, opacity: ok ? 0.78 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div className="ssl-serif" style={{ fontSize: 20, color: SSL.ink, lineHeight: 1.25 }}>{phrase}</div>
                <button onClick={() => speakLine(phrase)} className="ssl-focusable" aria-label="Play"
                  style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: "none", background: SSL.teal, color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 18, height: 18 }}>{Icon.play}</span>
                </button>
              </div>
              <div style={{ fontSize: 14, color: SSL.inkSoft, marginTop: 10, lineHeight: 1.5 }}>{meaning}</div>
              <div style={{ fontSize: 13.5, color: SSL.textMuted, marginTop: 8, fontStyle: "italic" }}>e.g. “{example}”</div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button onClick={() => { saved ? removeExpression(uid, phrase) : saveExpression(uid, { text: phrase, lessonId: lesson.id, season: season.id, theme: lesson.theme }); rerender(); }}
                  className="ssl-focusable"
                  style={{ ...ctrlBtn, display: "flex", alignItems: "center", gap: 6, background: saved ? SSL.copper : "transparent", color: saved ? "#fff" : SSL.ink, borderColor: saved ? SSL.copper : SSL.border }}>
                  <span style={{ width: 15, height: 15 }}>{Icon.bookmark}</span> {saved ? "Saved" : "Save"}
                </button>
                <button onClick={() => setUnderstood((u) => ({ ...u, [phrase]: !u[phrase] }))} className="ssl-focusable"
                  style={{ ...ctrlBtn, display: "flex", alignItems: "center", gap: 6, color: ok ? SSL.success : SSL.ink, borderColor: ok ? SSL.success : SSL.border }}>
                  <span style={{ width: 15, height: 15 }}>{Icon.check}</span> {ok ? "Understood" : "Mark understood"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <Btn onClick={() => { cancelSpeech(); onNext(); }} style={{ width: "100%", maxWidth: 420 }}>
          Continue to DO <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span>
        </Btn>
      </div>
    </>
  );
}

// ── DO (live AI voice conversation — Phase 3) ────────────────────────────────
const GOAL_STEPS = 5;

function Do({ lesson, season, user, difficulty, onFinish }) {
  const [secs, setSecs] = useState(0);
  const [messages, setMessages] = useState([]); // [{role:"assistant"|"user", text, expressionUsed?, pulse?}]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // { code, message }
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [hint, setHint] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [goalMet, setGoalMet] = useState(false);
  const [micState, setMicState] = useState(speechSupported && (window.webkitSpeechRecognition || window.SpeechRecognition) ? "ready" : "unsupported");
  const [textInput, setTextInput] = useState("");

  const timer = useRef(null);
  const recognitionRef = useRef(null);
  const startedRef = useRef(false);
  const turnCount = messages.filter((m) => m.role === "user").length;
  const goalStep = goalMet ? GOAL_STEPS : Math.min(GOAL_STEPS - 1, turnCount);

  useEffect(() => {
    timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(timer.current);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    openConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { recognitionRef.current?.stop(); cancelSpeech(); }, []);

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  function speakAI(text) {
    setSpeaking(true);
    speakLine(text, { onend: () => setSpeaking(false) });
  }

  async function openConversation() {
    setLoading(true); setError(null);
    try {
      const system = buildConversationSystemPrompt(lesson, difficulty);
      const raw = await converseWithAI(system, [{ role: "user", content: buildOpeningUserMessage(lesson) }], user);
      const p = parseAIReply(raw);
      setMessages([{ role: "assistant", text: p.reply, expressionUsed: p.expression_used }]);
      setHint(p.hint);
      if (p.goal_met) setGoalMet(true);
      speakAI(p.reply);
    } catch (e) {
      setError({ code: e.code || "unavailable", message: e.message });
    }
    setLoading(false);
  }

  async function sendTurn(transcript, { silent } = {}) {
    const trimmed = (transcript || "").trim();
    if (!trimmed || loading) return;
    setError(null);
    const next = silent ? messages : [...messages, { role: "user", text: trimmed }];
    if (!silent) setMessages(next);
    setLoading(true);
    try {
      const system = buildConversationSystemPrompt(lesson, difficulty);
      const history = next.map((m) => ({ role: m.role, content: m.text }));
      history.push({ role: "user", content: silent ? trimmed : buildTurnUserMessage(trimmed) });
      const raw = await converseWithAI(system, history, user);
      const p = parseAIReply(raw);
      setMessages([...next, { role: "assistant", text: p.reply, expressionUsed: p.expression_used }]);
      setHint(p.hint);
      setShowHint(false);
      if (p.goal_met) setGoalMet(true);
      speakAI(p.reply);
    } catch (e) {
      setError({ code: e.code || "unavailable", message: e.message });
    }
    setLoading(false);
  }

  function toggleListening() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) { setMicState("unsupported"); return; }
    cancelSpeech();
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setMicState("blocked");
    };
    r.onresult = (e) => sendTurn(e.results[0][0].transcript);
    recognitionRef.current = r;
    r.start();
  }

  function sayThatAgain() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) speakAI(last.text);
  }

  function whatDoesThatMean() {
    const last = [...messages].reverse().find((m) => m.role === "assistant");
    if (last) sendTurn(buildClarifyRequest(last.text), { silent: true });
  }

  function giveMeAHint() {
    if (hint) { setShowHint(true); return; }
    sendTurn(buildHintRequest(), { silent: true }).then(() => setShowHint(true));
  }

  function finish() {
    clearInterval(timer.current);
    recognitionRef.current?.stop();
    cancelSpeech();
    const expressionsUsed = [...new Set(messages.map((m) => m.expressionUsed).filter(Boolean))];
    const lastLearnerLine = [...messages].reverse().find((m) => m.role === "user")?.text || "";
    onFinish(secs, { messages, goalMet, turnCount, expressionsUsed, lastLearnerLine, aiUsed: messages.length > 0 });
  }

  const lastAI = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <>
      <Stepper active="do" />
      <div className="ssl-row" style={{ flexWrap: "wrap" }}>
        {/* Stage */}
        <div style={{ flex: "1 1 560px", minWidth: 0 }}>
          <div className="ssl-card" style={{ padding: 0, overflow: "hidden", background: SSL.navy, border: "none", color: SSL.onNavy }}>
            <div style={{ padding: "26px 26px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: SSL.copperLight, fontWeight: 700, fontSize: 13, letterSpacing: ".08em" }}>
                <span style={{ width: 16, height: 16 }}>{Icon.spark}</span> DO · LIVE CONVERSATION
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#fff", fontVariantNumeric: "tabular-nums", fontSize: 18 }}>
                <span style={{ width: 16, height: 16 }}>{Icon.clock}</span> {mmss}
              </div>
            </div>

            <div style={{ textAlign: "center", padding: "18px 26px 30px" }}>
              {lastAI && (
                <div className="ssl-card" style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${SSL.borderNavy}`,
                  padding: "16px 20px", maxWidth: 480, margin: "0 auto 8px", textAlign: "left", display: "flex", gap: 10 }}>
                  <span style={{ width: 18, height: 18, color: SSL.copperLight, flexShrink: 0, marginTop: 2 }}>{Icon.spark}</span>
                  <p style={{ fontSize: 16.5, color: "#fff", lineHeight: 1.4, margin: 0 }}>{lastAI.text}</p>
                </div>
              )}

              {error && (
                <ErrorBanner error={error} onRetry={() => (messages.length === 0 ? openConversation() : null)} />
              )}

              <button onClick={toggleListening} disabled={loading || micState !== "ready"} className="ssl-focusable"
                style={{ width: 108, height: 108, borderRadius: "50%", margin: "22px auto 10px", display: "flex", alignItems: "center", justifyContent: "center",
                  border: `3px solid ${listening ? SSL.copperLight : SSL.copper}`,
                  background: listening ? SSL.copper : speaking ? "rgba(212,162,78,.18)" : "rgba(255,255,255,.06)",
                  color: "#fff", cursor: loading || micState !== "ready" ? "default" : "pointer", opacity: micState !== "ready" ? 0.5 : 1 }}>
                <span style={{ width: 40, height: 40 }}>{Icon.mic}</span>
              </button>
              <div style={{ fontWeight: 600, color: listening ? SSL.copperLight : SSL.onNavyMuted }}>
                {loading ? "Thinking…" : listening ? "Listening…" : speaking ? "Speaking…" : micState === "ready" ? "Tap to speak" : "Type your reply below"}
              </div>

              {micState !== "ready" && (
                <TextFallback value={textInput} onChange={setTextInput}
                  onSend={() => { sendTurn(textInput); setTextInput(""); }} disabled={loading} />
              )}

              {showHint && hint && (
                <div style={{ marginTop: 16, fontSize: 13.5, color: SSL.copperLight, background: "rgba(212,162,78,.12)",
                  border: `1px solid rgba(212,162,78,.3)`, borderRadius: 10, padding: "10px 14px", maxWidth: 420, marginInline: "auto" }}>
                  💡 Try: “{hint}”
                </div>
              )}

              {showTranscript && messages.length > 0 && (
                <div style={{ marginTop: 18, textAlign: "left", maxWidth: 480, marginInline: "auto", maxHeight: 220, overflowY: "auto" }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ fontSize: 13.5, padding: "6px 0", color: m.role === "assistant" ? SSL.copperLight : "#fff" }}>
                      <strong>{m.role === "assistant" ? "Partner" : "You"}:</strong> {m.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Goal */}
          <div className="ssl-card" style={{ padding: 18, marginTop: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ width: 22, height: 22, color: SSL.copper, flexShrink: 0 }}>{Icon.spark}</span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12.5, color: SSL.textMuted, fontWeight: 700, letterSpacing: ".06em" }}>CONVERSATION GOAL</div>
              <div style={{ fontSize: 15.5, color: SSL.ink, marginTop: 2 }}>{lesson.objective}</div>
            </div>
            <div style={{ fontSize: 12.5, color: goalMet ? SSL.success : SSL.textMuted, fontWeight: 700 }}>
              {goalMet ? "Goal reached ✓" : `${goalStep} of ${GOAL_STEPS} steps`}
            </div>
          </div>
        </div>

        {/* Expressions panel */}
        <div style={{ flex: "0 0 300px" }}>
          <div className="ssl-card" style={{ padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copper, letterSpacing: ".08em", marginBottom: 12 }}>USEFUL EXPRESSIONS</div>
            {lesson.keyPhrases.slice(0, 4).map((p, i) => (
              <button key={i} onClick={() => speakLine(p)} className="ssl-focusable"
                style={{ display: "flex", width: "100%", textAlign: "left", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 10, marginBottom: 6,
                  border: `1px solid ${SSL.border}`, background: "transparent", cursor: "pointer", fontSize: 14, color: SSL.ink }}>
                <span style={{ width: 15, height: 15, color: SSL.teal, flexShrink: 0 }}>{Icon.play}</span> {p}
              </button>
            ))}

            <div style={{ height: 1, background: SSL.border, margin: "14px 0" }} />

            <QuickAction icon={Icon.repeat} label="Say That Again" onClick={sayThatAgain} disabled={!lastAI} />
            <QuickAction icon={Icon.help} label="What Does That Mean?" onClick={whatDoesThatMean} disabled={!lastAI || loading} />
            <QuickAction icon={Icon.bulb} label="Give Me a Hint" onClick={giveMeAHint} disabled={loading} />
            <QuickAction icon={Icon.transcript} label={showTranscript ? "Hide Transcript" : "Show Transcript"} onClick={() => setShowTranscript((s) => !s)} />

            <div style={{ fontWeight: 700, fontSize: 12.5, color: SSL.copper, letterSpacing: ".08em", margin: "14px 0 8px" }}>AT THE BAR</div>
            {lesson.mixAndSpeak.map((m, i) => (
              <div key={i} style={{ fontSize: 13.5, color: SSL.inkSoft, padding: "5px 0" }}>· {m}</div>
            ))}
          </div>

          <Btn onClick={finish} style={{ width: "100%", marginTop: 16 }}>
            Finish Conversation
          </Btn>
        </div>
      </div>
    </>
  );
}

function QuickAction({ icon, label, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="ssl-focusable"
      style={{ display: "flex", width: "100%", textAlign: "left", gap: 8, alignItems: "center", padding: "9px 10px", borderRadius: 10, marginBottom: 4,
        border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", fontSize: 13.5, fontWeight: 600,
        color: SSL.inkSoft, opacity: disabled ? 0.5 : 1 }}>
      <span style={{ width: 16, height: 16, flexShrink: 0 }}>{icon}</span> {label}
    </button>
  );
}

function TextFallback({ value, onChange, onSend, disabled }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, maxWidth: 420, marginInline: "auto" }}>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSend(); }}
        placeholder="Type your reply…" disabled={disabled}
        style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1px solid ${SSL.borderNavy}`,
          background: "rgba(255,255,255,.08)", color: "#fff", fontSize: 14 }} />
      <button onClick={onSend} disabled={disabled || !value.trim()} className="ssl-focusable"
        style={{ width: 42, borderRadius: 10, border: "none", background: SSL.copper, color: "#fff",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: disabled || !value.trim() ? 0.5 : 1 }}>
        <span style={{ width: 18, height: 18 }}>{Icon.send}</span>
      </button>
    </div>
  );
}

function ErrorBanner({ error, onRetry }) {
  const copy = {
    credit_limit: "You've used up this month's AI conversation practice — you can still practise using the expressions on the right.",
    unavailable: "Your conversation partner is unavailable right now. You can keep practising using the expressions on the right.",
  }[error.code] || error.message || "Something went wrong.";
  return (
    <div style={{ background: "rgba(168,50,68,.15)", border: `1px solid rgba(168,50,68,.4)`, borderRadius: 10,
      padding: "12px 16px", maxWidth: 460, margin: "0 auto 8px", textAlign: "left" }}>
      <div style={{ fontSize: 13.5, color: "#f3c6cc" }}>{copy}</div>
      {error.code === "unavailable" && onRetry && (
        <button onClick={onRetry} className="ssl-focusable"
          style={{ marginTop: 8, background: "none", border: "none", color: SSL.copperLight, fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }}>
          Try again
        </button>
      )}
    </div>
  );
}

// ── Feedback (confidence-first) ─────────────────────────────────────────────
function Feedback({ lesson, speakingSecs, pre, post, conversation, onPost, onNext }) {
  const mins = Math.max(1, Math.round(speakingSecs / 60));
  const aiUsed = conversation?.aiUsed;

  const usefulPhrase = conversation?.expressionsUsed?.[0] || lesson.keyPhrases[0];
  // Prefer a phrase that genuinely hands the conversation back (a question about "you").
  const followUp =
    lesson.keyPhrases.find((p) => /\?$/.test(p) && /\byou\b/i.test(p)) ||
    lesson.keyPhrases.find((p) => /\?$/.test(p)) ||
    "How about you?";

  const strongestMoment = aiUsed && conversation.lastLearnerLine
    ? `You kept the conversation going — saying “${conversation.lastLearnerLine.length > 90 ? conversation.lastLearnerLine.slice(0, 87) + "…" : conversation.lastLearnerLine}” is exactly the kind of natural response that builds real fluency.`
    : `You worked all the way through the “${lesson.theme}” conversation. Showing up and speaking is exactly how confidence grows.`;

  const goalLine = aiUsed
    ? (conversation.goalMet
        ? `${lesson.objective} — you got there! Well done.`
        : `${lesson.objective} — good progress, worth another go next time.`)
    : `${lesson.objective} — practised.`;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 40 }}>🥂</div>
        <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,3.6vw,38px)", fontWeight: 600, marginTop: 6 }}>Great conversation.</h1>
        <p style={{ color: SSL.inkSoft, marginTop: 6 }}>Here's what went well — remember, the goal is connection, not perfection.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FeedItem icon="💪" title="Your strongest moment" body={strongestMoment} />
        <FeedItem icon="💬" title="A useful expression to keep"
          body={`“${usefulPhrase}” is a natural way to sound fluent in this situation — save it and reuse it.`} />
        <FeedItem icon="🔄" title="Keep the conversation moving"
          body={`Asking “${followUp}” hands the conversation back — a strong communication skill that keeps things flowing.`} />
        <div className="ssl-grid2">
          <FeedItem icon="⏱️" title="Speaking time" body={`About ${mins} minute${mins === 1 ? "" : "s"} of practice. Every minute counts.`} compact />
          <FeedItem icon="🎯" title="Goal" body={goalLine} compact />
        </div>
        <FeedItem icon="🌱" title="One gentle next step"
          body={`Next time, try stretching one answer a little longer — add a reason or an example after your first sentence.`} />
      </div>

      <div className="ssl-card" style={{ padding: 20, marginTop: 18, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copper, letterSpacing: ".08em", marginBottom: 14 }}>HOW CONFIDENT DO YOU FEEL NOW?</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {CONFIDENCE_LEVELS.map((c) => (
            <button key={c.value} onClick={() => onPost(c.value)} className="ssl-focusable"
              style={{ padding: "12px 10px", borderRadius: 12, cursor: "pointer", minWidth: 92,
                border: `1.5px solid ${post === c.value ? SSL.copper : SSL.border}`,
                background: post === c.value ? SSL.copper : "transparent", color: post === c.value ? "#fff" : SSL.ink }}>
              <div style={{ fontSize: 22 }}>{c.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{c.label}</div>
            </button>
          ))}
        </div>
      </div>


      <Btn onClick={onNext} disabled={post == null} style={{ width: "100%", maxWidth: 420, margin: "18px auto 0", display: "flex" }}>
        Continue to Reflection <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span>
      </Btn>
    </div>
  );
}

function FeedItem({ icon, title, body, compact }) {
  return (
    <div className="ssl-card" style={{ padding: compact ? "14px 16px" : "16px 18px", display: "flex", gap: 12 }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: SSL.ink }}>{title}</div>
        <div style={{ fontSize: 14, color: SSL.inkSoft, marginTop: 3, lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

// ── Reflection ──────────────────────────────────────────────────────────────
function Reflection({ lesson, pre, post, onFinish }) {
  const delta = pre != null && post != null ? post - pre : null;
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
      <span className="ssl-eyebrow">Reflection</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(24px,3.4vw,36px)", fontWeight: 600, margin: "8px 0 20px" }}>{lesson.reflection}</h1>

      <div className="ssl-card" style={{ padding: 20, textAlign: "left" }}>
        <div style={{ fontSize: 14, color: SSL.inkSoft }}>{REFLECTION_ORDER}</div>
      </div>

      {delta != null && (
        <div className="ssl-card" style={{ padding: 22, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
          <ConfBubble label="Before" value={pre} />
          <span style={{ width: 22, height: 22, color: SSL.textMuted }}>{Icon.arrow}</span>
          <ConfBubble label="After" value={post} />
          <div style={{ textAlign: "left", maxWidth: 180 }}>
            <div className="ssl-serif" style={{ fontSize: 18, color: delta > 0 ? SSL.success : SSL.ink }}>
              {delta > 0 ? `Up ${delta} level${delta > 1 ? "s" : ""}!` : delta === 0 ? "Steady" : "Keep going"}
            </div>
            <div style={{ fontSize: 13, color: SSL.textMuted, marginTop: 2 }}>Your confidence journey is saved.</div>
          </div>
        </div>
      )}

      <Btn onClick={onFinish} style={{ width: "100%", maxWidth: 420, margin: "22px auto 0", display: "flex" }}>
        Finish Lesson <span style={{ width: 18, height: 18 }}>{Icon.check}</span>
      </Btn>
    </div>
  );
}

function ConfBubble({ label, value }) {
  const c = CONFIDENCE_LEVELS.find((x) => x.value === value);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 26 }}>{c?.emoji}</div>
      <div style={{ fontSize: 12, color: SSL.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────────────────
function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function otherThemes(theme, count) {
  const all = SEASONS.flatMap((s) => LESSONS_BY_SEASON[s.id]).map((l) => l.theme).filter((t) => t !== theme);
  return shuffle(all).slice(0, count);
}
