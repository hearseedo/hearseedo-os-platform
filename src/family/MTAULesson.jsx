// Monkeys Talk & Unlock — Book 1 Lesson 1 player (Summit Readiness Sprint,
// 2026-09-17). Preserves the real 14-step lesson design audited from the
// reference product — this is deliberately NOT a generic Hear/See/Do card
// grid; the step sequence itself is part of the product.
//
// Audio: browser speechSynthesis, tested live and confirmed reliable in
// this environment (Chrome/Chromium on macOS — genuine speech, distinct
// voices, ~2-3s realistic duration per line). This is honestly device/
// browser voice playback, not recorded character voices and not
// ElevenLabs — labelled as such in the UI. Safari reliability could not be
// verified in this environment; the implementation follows Safari-safe
// patterns (speak() called synchronously inside the click handler, voices
// re-queried on click rather than cached at mount) but this is unverified,
// not confirmed.
//
// Speaking checks: a participation/attempt counter only, exactly like the
// reference product's own honest "VOICE ATTEMPTS" counter — never
// evaluated, never scored. No fake pronunciation percentages, AI grading,
// or EIKEN scores anywhere in this file.
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { auth } from "../lib/firebase";
import { FAMILY_COLORS } from "./theme";
import { getMTAULesson, getMTAUBook } from "./mtauContent";
import { getMTAULessonProgress, recordMTAUStep, recordMTAULessonCompleted, recordMTAUConfidence, mtauDocId } from "./mtauProgress";
import { buildMTAUJonaPrompt, buildMTAUOpeningMessage } from "./mtauJona";
import { SELF_PROFILE_ID } from "../lib/profiles";
import FamilyLoading from "./FamilyLoading";

// Distinguishable device voices per character — assigned once voices load.
// Honest fallback: if a named voice isn't available on this device, falls
// back to any English voice rather than failing silently.
function pickVoice(preferredNames) {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  for (const name of preferredNames) {
    const v = voices.find(v => v.name === name);
    if (v) return v;
  }
  return voices.find(v => v.lang?.startsWith("en")) ?? voices[0] ?? null;
}
const CHARACTER_VOICES = {
  Milo: ["Daniel", "Alex", "Fred"],
  Lola: ["Samantha", "Victoria", "Karen"],
  Kiko: ["Samantha", "Victoria"],
  Momo: ["Alex", "Fred"],
  Jona: ["Samantha", "Victoria"],
};
function speak(text, speaker = "Milo") {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve({ ok: false, reason: "unsupported" }); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice(CHARACTER_VOICES[speaker] ?? ["Samantha"]);
    u.onend = () => resolve({ ok: true });
    u.onerror = (e) => resolve({ ok: false, reason: e.error });
    window.speechSynthesis.speak(u);
  });
}

export default function MTAULesson() {
  const { bookId: bookIdParam, lessonId: lessonIdParam } = useParams();
  const bookId = parseInt(bookIdParam, 10);
  const lessonId = parseInt(lessonIdParam, 10);
  const { user, currentProfile } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;

  const lesson = getMTAULesson(bookId, lessonId);
  const book = getMTAUBook(bookId);

  const [progress, setProgress] = useState(null); // null = loading
  const [stepIndex, setStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [confidenceBefore, setConfidenceBefore] = useState(null);
  const [confidenceAfter, setConfidenceAfter] = useState(null);
  const [voiceAttempts, setVoiceAttempts] = useState(0);
  // Quick Start's name input — deliberately LOCAL STATE ONLY. Never written
  // to Firestore, never passed to Jona. See mtauContent.js's privacyNote.
  const [practiceName, setPracticeName] = useState("");

  // Resume: load existing progress once, then start at the saved step.
  useEffect(() => {
    if (!user?.uid || !lesson) { setProgress({}); return; }
    getMTAULessonProgress(user.uid, profileId, bookId, lessonId).then(p => {
      setProgress(p ?? {});
      if (p) {
        setStepIndex(p.completed ? lesson.steps.length - 1 : (p.currentStep ?? 0));
        setCompletedSteps(p.completedSteps ?? []);
        setConfidenceBefore(p.confidenceBefore ?? null);
        setConfidenceAfter(p.confidenceAfter ?? null);
      }
    }).catch(() => setProgress({}));
  }, [user?.uid, profileId, bookId, lessonId, lesson]);

  if (!currentProfile || progress === null) return <FamilyLoading />;
  if (!lesson || !book) {
    return (
      <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, padding: 40, textAlign: "center" }}>
        <p>This lesson isn't available yet.</p>
        <button onClick={() => navigate("/family/mtau")} style={secondaryBtn}>← Back to Monkeys Talk &amp; Unlock</button>
      </div>
    );
  }

  const step = lesson.steps[stepIndex];
  const isLastStep = stepIndex === lesson.steps.length - 1;

  async function goToStep(nextIndex, markCurrentComplete = true) {
    const newCompleted = markCurrentComplete && !completedSteps.includes(stepIndex)
      ? [...completedSteps, stepIndex]
      : completedSteps;
    setCompletedSteps(newCompleted);
    setStepIndex(nextIndex);
    if (user?.uid) await recordMTAUStep(user.uid, profileId, bookId, lessonId, nextIndex, newCompleted);
  }

  async function completeLesson() {
    const newCompleted = completedSteps.includes(stepIndex) ? completedSteps : [...completedSteps, stepIndex];
    if (user?.uid) await recordMTAULessonCompleted(user.uid, profileId, bookId, lessonId, newCompleted);
    navigate("/family/mtau");
  }

  function recordVoiceAttempt() {
    setVoiceAttempts(a => a + 1);
  }

  // Persists the 1-5 self-rating onto the same progress doc as steps do —
  // written immediately (not deferred to lesson completion) so it survives
  // refresh/resume just like currentStep already does.
  async function recordConfidence(phase, value) {
    if (phase === "before") setConfidenceBefore(value); else setConfidenceAfter(value);
    if (user?.uid) await recordMTAUConfidence(user.uid, profileId, bookId, lessonId, phase, value);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b12", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #222" }}>
        <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.5 }}>MONKEYS TALK &amp; UNLOCK</div>
        <div style={{ fontSize: 12, color: "#aaa" }}>BOOK {bookId} &nbsp;Lesson {lessonId} &nbsp;|&nbsp; {lesson.title}</div>
        <button onClick={() => navigate("/family/mtau")} style={{ background: "none", border: "1px solid #333", borderRadius: 8, color: "#ccc", fontSize: 12, padding: "6px 10px", cursor: "pointer" }}>
          Book {bookId} map
        </button>
      </header>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 20px 60px", display: "flex", gap: 24 }}>
        <nav style={{ width: 200, flexShrink: 0 }} aria-label="Lesson steps">
          {lesson.steps.map((s, i) => (
            <div key={s.kind} style={{
              padding: "8px 10px", borderRadius: 8, marginBottom: 4,
              background: i === stepIndex ? "#e0559c22" : "transparent",
              border: i === stepIndex ? "1px solid #e0559c" : "1px solid transparent",
              opacity: i > stepIndex && !completedSteps.includes(i) ? 0.4 : 1,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: completedSteps.includes(i) ? "#8ee6a8" : "#fff" }}>
                {completedSteps.includes(i) ? "✓ " : `${i + 1}. `}{s.title}
              </div>
              <div style={{ fontSize: 10, color: "#888" }}>{s.subtitle}</div>
            </div>
          ))}
        </nav>

        <main style={{ flex: 1, background: "#15151f", border: "1px solid #2a2a3a", borderRadius: 20, padding: 28, position: "relative" }}>
          <div style={{ position: "absolute", top: 20, right: 20, fontSize: 11, color: "#888" }}>
            VOICE ATTEMPTS {voiceAttempts}
          </div>

          <StepBody
            step={step}
            stepIndex={stepIndex}
            lesson={lesson}
            bookId={bookId}
            lessonId={lessonId}
            ageBand={currentProfile.ageBand}
            practiceName={practiceName}
            setPracticeName={setPracticeName}
            confidenceBefore={confidenceBefore}
            confidenceAfter={confidenceAfter}
            onConfidenceChange={recordConfidence}
            onVoiceAttempt={recordVoiceAttempt}
            lang={lang}
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28 }}>
            <button onClick={() => stepIndex > 0 && goToStep(stepIndex - 1, false)} disabled={stepIndex === 0} style={{ ...secondaryBtn, opacity: stepIndex === 0 ? 0.3 : 1 }}>
              ← Back
            </button>
            <div style={{ fontSize: 12, color: "#888", alignSelf: "center" }}>{stepIndex + 1} of {lesson.steps.length}</div>
            {!isLastStep ? (
              <button onClick={() => goToStep(stepIndex + 1)} style={primaryBtn}>Continue →</button>
            ) : (
              <button onClick={completeLesson} style={primaryBtn}>Complete Lesson →</button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StepBody({ step, stepIndex, lesson, bookId, lessonId, ageBand, practiceName, setPracticeName, confidenceBefore, confidenceAfter, onConfidenceChange, onVoiceAttempt, lang }) {
  switch (step.kind) {
    case "arrive":
      return (
        <Centered>
          <Eyebrow>BOOK {bookId} · {lesson.location}</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <p style={bodyStyle}>{step.body}</p>
          <ListenButton onClick={() => speak(step.heading, "Milo")} />
        </Centered>
      );

    case "confidence":
      return (
        <Centered>
          <Eyebrow>{step.phase === "before" ? "CONFIDENCE CHECK" : "CONFIDENCE AFTER"}</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <ScaleRow
            value={step.phase === "before" ? confidenceBefore : confidenceAfter}
            onChange={value => onConfidenceChange(step.phase, value)}
            labels={step.scaleLabels}
          />
          {step.note && <p style={noteStyle}>{step.note}</p>}
        </Centered>
      );

    case "quickstart":
      return (
        <Centered>
          <ListenButton onClick={() => speak(step.heading, "Milo")} />
          <h1 style={headingStyle}>{step.heading}</h1>
          <input
            value={practiceName}
            onChange={e => setPracticeName(e.target.value)}
            placeholder={step.placeholder}
            style={inputStyle}
          />
          <p style={{ ...noteStyle, fontSize: 11 }}>Practice only — not saved to your profile, not shared with Jona.</p>
        </Centered>
      );

    case "hear":
      return (
        <div>
          <Eyebrow>HEAR FOR MEANING</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          {step.dialogue.map((d, i) => (
            <div key={i} style={dialogueLineStyle}>
              <strong>{d.speaker}</strong>
              <span style={{ flex: 1 }}>{d.line}</span>
              <ListenButton small onClick={() => speak(d.line, d.speaker)} />
            </div>
          ))}
          <button onClick={async () => { for (const d of step.dialogue) await speak(d.line, d.speaker); }} style={secondaryBtn}>
            🔊 Play full conversation
          </button>
          <div style={{ marginTop: 16 }}>
            {step.choices.map((c, i) => (
              <button key={i} style={choiceBtn} onClick={onVoiceAttempt}>{c.text}</button>
            ))}
          </div>
        </div>
      );

    case "respond":
    case "review":
      // Shared render: some lessons' respond/review steps show a character
      // + speech bubble prompting the learner (Lesson 2/3); Lesson 1's
      // respond step has neither field, so this degrades gracefully to the
      // original plain layout — no lesson-specific branching, just optional
      // fields.
      return (
        <Centered>
          <Eyebrow>{step.kind === "review" ? "QUICK REVIEW" : "RESPOND"}</Eyebrow>
          {step.character && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>{step.character}</div>
              {step.bubble && <div style={bubbleStyle}>{step.bubble}</div>}
            </div>
          )}
          {!step.character && <h1 style={headingStyle}>{step.heading}</h1>}
          <MicButton onClick={onVoiceAttempt} />
          {step.note && <p style={noteStyle}>{step.note}</p>}
          {step.successNote && <p style={{ ...noteStyle, color: "#8ee6a8" }}>{step.successNote}</p>}
        </Centered>
      );

    case "shadow":
      return (
        <div>
          <Eyebrow>SHADOW</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          {step.lines.map((l, i) => (
            <div key={i} style={dialogueLineStyle}>
              <ListenButton small onClick={() => speak(l, "Milo")} />
              <span style={{ flex: 1 }}>{l}</span>
              <MicButton small onClick={onVoiceAttempt} />
            </div>
          ))}
          <p style={noteStyle}>{step.note}</p>
        </div>
      );

    case "see":
      return (
        <Centered>
          <Eyebrow>SEE THE PATTERN</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <p style={bodyStyle}>{step.instruction}</p>
          {/* Two real shapes seen in the source: a sentence-builder word
              bank (Lesson 1/3, `tiles`) and pronoun-matching cards
              (Lesson 2, `pronounCards`) — both generic, neither lesson-specific. */}
          {step.tiles && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {step.tiles.map((tile, i) => <span key={i} style={tileStyle}>{tile}</span>)}
            </div>
          )}
          {step.pronounCards && (
            <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {step.pronounCards.map(card => (
                <div key={card.character} style={{ background: "#1e1e2a", borderRadius: 12, padding: 14, textAlign: "center" }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{card.character}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {card.options.map(opt => (
                      <button key={opt} onClick={onVoiceAttempt} style={{ ...choiceBtn, marginBottom: 0, display: "inline-block", width: "auto" }}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Centered>
      );

    case "meet_team":
      return (
        <div>
          <Eyebrow>{step.title?.toUpperCase() ?? "MEET THE TEAM"}</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {step.characters.map(c => (
              <div key={c.name} style={{ ...dialogueLineStyle, justifyContent: "space-between" }}>
                {/* Two real shapes: a fixed greeting line (Lesson 1, `line`)
                    and a pronoun+detail pair used to build "This is X. Y is
                    Z." (Lesson 2, `pronoun`/`detail`) — both generic. */}
                <div>
                  <strong>{c.name}</strong>
                  <div style={{ fontSize: 13, color: "#ccc" }}>
                    {c.line ?? (c.pronoun && c.detail ? `This is ${c.name}. ${c.pronoun} is ${c.detail}.` : "")}
                  </div>
                </div>
                <MicButton small onClick={onVoiceAttempt} />
              </div>
            ))}
          </div>
          <p style={noteStyle}>{step.note}</p>
        </div>
      );

    case "number_hunt":
      return (
        <div>
          <Eyebrow>NUMBER HUNT</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {step.items.map(item => (
              <button key={item.label} onClick={onVoiceAttempt} style={{ ...choiceBtn, textAlign: "center" }}>
                {item.n} {item.label}
              </button>
            ))}
          </div>
        </div>
      );

    case "repair":
      return (
        <Centered>
          <Eyebrow>REPAIR</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <ListenButton onClick={() => speak(step.heading, "Momo")} />
            <MicButton onClick={onVoiceAttempt} />
          </div>
          <p style={noteStyle}>{step.note}</p>
        </Centered>
      );

    case "ask_switch":
      return (
        <Centered>
          <Eyebrow>ASK &amp; SWITCH</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          {step.characterPair && (
            <p style={{ fontWeight: 800, marginBottom: 8 }}>{step.characterPair[0]} ⇄ {step.characterPair[1]}</p>
          )}
          {step.exchange?.map((line, i) => <p key={i} style={bodyStyle}>{line}</p>)}
          <MicButton onClick={onVoiceAttempt} />
        </Centered>
      );

    case "workbook":
      return <WorkbookStep step={step} />;

    case "create":
      return <CreateStep step={step} onAttempt={onVoiceAttempt} />;

    case "jona":
      return <JonaStep step={step} bookId={bookId} lessonId={lessonId} ageBand={ageBand} lang={lang} onAttempt={onVoiceAttempt} />;

    case "unlock":
      return (
        <Centered>
          <Eyebrow>{lesson.location.toUpperCase()}</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <p style={bodyStyle}>{step.instruction}</p>
          <MicButton onClick={onVoiceAttempt} label={step.cta} />
        </Centered>
      );

    case "reflect":
      return (
        <Centered>
          <Eyebrow>CONFIDENCE AFTER</Eyebrow>
          <h1 style={headingStyle}>{step.heading}</h1>
          <div style={{ display: "flex", gap: 24, justifyContent: "center", marginBottom: 16 }}>
            <div><div style={{ fontSize: 11, color: "#888" }}>BEFORE</div><div style={{ fontSize: 22, fontWeight: 800 }}>{confidenceBefore ?? "–"}</div></div>
            <div><div style={{ fontSize: 11, color: "#888" }}>AFTER</div><div style={{ fontSize: 22, fontWeight: 800 }}>{confidenceAfter ?? "–"}</div></div>
          </div>
          <ScaleRow value={confidenceAfter} onChange={value => onConfidenceChange("after", value)} labels={[null, null, null, null, null]} />
          {lesson.nextDestination && (
            <p style={{ ...noteStyle, marginTop: 20 }}>
              NEXT DESTINATION: {lesson.nextDestination} (Lesson {lessonId + 1}
              {getMTAULesson(bookId, lessonId + 1) ? "" : " — coming soon"})
            </p>
          )}
        </Centered>
      );

    default:
      return null;
  }
}

function WorkbookStep({ step }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div>
      <Eyebrow>WORKBOOK BRIDGE</Eyebrow>
      <h1 style={headingStyle}>{step.heading}</h1>
      <div style={{ display: "flex", gap: 12, margin: "16px 0" }}>
        {step.bridge.map(b => (
          <div key={b.stage} style={{ flex: 1, background: "#1e1e2a", borderRadius: 10, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#e0559c", fontWeight: 800 }}>{b.stage}</div>
            <div style={{ fontSize: 12, color: "#ccc" }}>{b.detail}</div>
          </div>
        ))}
      </div>
      {/* Optional reading passage + its own audio control — present on
          Lesson 2/3, absent on Lesson 1's simpler workbook step. */}
      {step.readingText && (
        <div style={{ background: "#1e1e2a", borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <p style={{ ...bodyStyle, marginBottom: 8 }}>{step.readingText}</p>
          <ListenButton small onClick={() => speak(step.readingText, "Milo")} />
        </div>
      )}
      <button onClick={() => setConfirmed(c => !c)} style={{ ...choiceBtn, borderColor: confirmed ? "#8ee6a8" : "#333" }}>
        {confirmed ? "✓ " : ""}{step.confirmLabel}
      </button>
      {step.note && <p style={noteStyle}>{step.note}</p>}
      <p style={{ ...noteStyle, fontSize: 11 }}>This is a self-check — completing the actual workbook pages happens outside the app; nothing here is auto-graded or synced.</p>
    </div>
  );
}

function CreateStep({ step, onAttempt }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef(null);
  function toggle() {
    if (recording) {
      clearInterval(intervalRef.current);
      setRecording(false);
      onAttempt();
    } else {
      setRecording(true);
      setSeconds(0);
      intervalRef.current = setInterval(() => setSeconds(s => Math.min(s + 1, step.maxSeconds)), 1000);
    }
  }
  useEffect(() => () => clearInterval(intervalRef.current), []);
  return (
    <Centered>
      <Eyebrow>CREATE</Eyebrow>
      <h1 style={headingStyle}>{step.heading}</h1>
      <p style={bodyStyle}>{step.instruction}</p>
      {/* Optional sentence-starter prompts — present on Lesson 2/3, absent
          on Lesson 1's simpler create step. */}
      {step.prompts && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
          {step.prompts.map((p, i) => <span key={i} style={{ ...tileStyle, textAlign: "center" }}>{p}</span>)}
        </div>
      )}
      <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>0:{String(seconds).padStart(2, "0")} / 0:{step.maxSeconds}</div>
      <MicButton active={recording} onClick={toggle} label={recording ? "Stop" : "Record"} />
      <p style={{ ...noteStyle, fontSize: 11 }}>Practice recording only — not uploaded, scored, or evaluated.</p>
    </Centered>
  );
}

function JonaStep({ step, bookId, lessonId, ageBand, lang, onAttempt }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [objectiveIndex, setObjectiveIndex] = useState(0);

  useEffect(() => {
    sendToJona([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendToJona(history) {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      // PRIVACY: no name, no identity field of any kind is passed here —
      // only lesson/objective context. See mtauJona.js.
      const system = buildMTAUJonaPrompt({ bookId, lessonId, ageBand, currentObjectiveIndex: objectiveIndex });
      const userMsg = history.length === 0 ? buildMTAUOpeningMessage({ bookId, lessonId }) : history[history.length - 1].text;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [...history.map(h => ({ role: h.role, content: h.text })), ...(history.length === 0 ? [{ role: "user", content: userMsg }] : [])],
          idToken,
        }),
      });
      if (!res.ok) { setMessages(m => [...m, { role: "assistant", text: "Jona is taking a quick break. Please try again in a moment." }]); setLoading(false); return; }
      const data = await res.json();
      const replyEn = (data.content?.match(/REPLY_EN:\s*(.+)/)?.[1] ?? data.content ?? "").trim();
      const replyJp = (data.content?.match(/REPLY_JP:\s*(.+)/)?.[1] ?? "").trim();
      setMessages(m => [...m, { role: "assistant", text: lang === "jp" && replyJp ? replyJp : replyEn }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "Jona is taking a quick break. Please try again in a moment." }]);
    }
    setLoading(false);
  }

  function handleSend() {
    if (!input.trim()) return;
    const next = [...messages, { role: "user", text: input.trim() }];
    setMessages(next);
    setInput("");
    onAttempt();
    if (objectiveIndex < step.objectives.length - 1) setObjectiveIndex(i => i + 1);
    sendToJona(next);
  }

  return (
    <div>
      <Eyebrow>JONA AI COACH</Eyebrow>
      <h1 style={headingStyle}>{step.heading}</h1>
      <p style={bodyStyle}>{step.subheading}</p>
      <div style={{ background: "#1e1e2a", borderRadius: 14, padding: 14, minHeight: 200, marginBottom: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", background: m.role === "user" ? "#e0559c33" : "#2a2a3a", padding: "8px 14px", borderRadius: 12, maxWidth: "80%", fontSize: 13 }}>
            {m.text}
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: "#888" }}>Jona 🐵…</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSend()} placeholder="Type your reply..." style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
        <button onClick={handleSend} disabled={loading} style={{ ...primaryBtn, width: "auto", padding: "10px 18px" }}>→</button>
      </div>
    </div>
  );
}

// ── Small shared UI primitives ────────────────────────────────────────────
function Centered({ children }) { return <div style={{ textAlign: "center" }}>{children}</div>; }
function Eyebrow({ children }) { return <div style={{ fontSize: 11, fontWeight: 800, color: "#e0559c", letterSpacing: 1, marginBottom: 8 }}>{children}</div>; }
function ListenButton({ onClick, small, label = "Listen" }) {
  return <button onClick={onClick} style={{ ...secondaryBtn, padding: small ? "4px 10px" : "8px 16px", fontSize: small ? 11 : 13 }}>🔊 {label}</button>;
}
function MicButton({ onClick, small, active, label = "Tap or say it" }) {
  return (
    <button onClick={onClick} style={{
      width: small ? 32 : 64, height: small ? 32 : 64, borderRadius: "50%", border: "none",
      background: active ? "#3ecf6e" : "#e0559c", color: "#fff", fontSize: small ? 14 : 22, cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center", margin: "12px auto",
    }} aria-label={label}>🎤</button>
  );
}
function ScaleRow({ value, onChange, labels }) {
  return (
    <div style={{ margin: "16px 0" }}>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            width: 40, height: 40, borderRadius: "50%", border: value === n ? "2px solid #e0559c" : "1px solid #333",
            background: value === n ? "#e0559c" : "#1e1e2a", color: "#fff", fontWeight: 700, cursor: "pointer",
          }}>{n}</button>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#888", marginTop: 6 }}>
        <span>{labels?.[0] ?? ""}</span><span>{labels?.[4] ?? ""}</span>
      </div>
    </div>
  );
}

const headingStyle = { fontSize: 26, fontWeight: 900, marginBottom: 10 };
const bodyStyle = { fontSize: 14, color: "#ccc", marginBottom: 16 };
const noteStyle = { fontSize: 12, color: "#8ee6a8", marginTop: 12 };
const inputStyle = { width: "100%", maxWidth: 320, padding: "12px 16px", borderRadius: 12, border: "1px solid #333", background: "#1e1e2a", color: "#fff", fontSize: 15, marginBottom: 12 };
const dialogueLineStyle = { display: "flex", alignItems: "center", gap: 10, background: "#1e1e2a", borderRadius: 10, padding: "10px 14px", marginBottom: 8 };
const tileStyle = { padding: "10px 16px", borderRadius: 10, background: "#2a2a3a", fontWeight: 700 };
const bubbleStyle = { display: "inline-block", background: "#2a2a3a", borderRadius: 14, padding: "10px 16px", fontSize: 15, fontWeight: 700 };
const choiceBtn = { display: "block", width: "100%", textAlign: "left", padding: "12px 16px", borderRadius: 10, border: "1px solid #333", background: "#1e1e2a", color: "#fff", marginBottom: 8, cursor: "pointer" };
const primaryBtn = { padding: "12px 24px", borderRadius: 12, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, cursor: "pointer" };
const secondaryBtn = { padding: "10px 18px", borderRadius: 12, border: "1px solid #333", background: "transparent", color: "#fff", fontWeight: 700, cursor: "pointer" };
