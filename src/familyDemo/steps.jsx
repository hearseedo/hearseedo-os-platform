// Step screens for the HSD Family demo. Every value rendered here comes
// from src/familyDemo/data.js — fixed, scripted data. Nothing on this page
// makes a live call to Gemini, Firestore, Stripe, or ElevenLabs — Jona's
// audio is pre-rendered (see JonaBubble.jsx).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FAMILY_COLORS, CATEGORY_STYLE } from "../family/theme";
import { useVoice } from "./FamilyDemoShell";
import JonaBubble from "./JonaBubble";
import {
  DEMO_CHILD, DEMO_PARENT, MAIN_CATEGORIES, CONTINUE_JOURNEY, ASK_JONA,
  ACTIVITY_SCRIPT, CONFIDENCE_MOODS, PROGRESS_STATS, PROGRAMS, JONA_LINES,
} from "./data";

function PageTitle({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {eyebrow && (
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: FAMILY_COLORS.pink, marginBottom: 6 }}>
          {eyebrow}
        </div>
      )}
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 6px", color: FAMILY_COLORS.text }}>{title}</h1>
      {subtitle && <p style={{ color: FAMILY_COLORS.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 22px", borderRadius: 14, border: "none",
        background: disabled ? FAMILY_COLORS.border : FAMILY_COLORS.pink,
        color: disabled ? FAMILY_COLORS.textMuted : "#fff", fontWeight: 800, fontSize: 14,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

// 1. Welcome ----------------------------------------------------------
export function StepWelcome() {
  const navigate = useNavigate();
  const { voiceOn } = useVoice();
  return (
    <div>
      <PageTitle eyebrow="HSD Family" title="Welcome to the HSD Family Demo" subtitle="A guided, pre-scripted walkthrough using a sample family. Nothing here calls a live AI model or database, so the experience is identical every time." />
      <JonaBubble text={JONA_LINES.welcome} audioKey="welcome" voiceOn={voiceOn} />
      <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 20, marginBottom: 20, display: "flex", gap: 16, alignItems: "center" }}>
        <div style={{ fontSize: 40 }}>👩‍👦</div>
        <div>
          <div style={{ fontWeight: 800, color: FAMILY_COLORS.text }}>{DEMO_PARENT.name} &amp; {DEMO_CHILD.name}, {DEMO_CHILD.age}</div>
          <div style={{ fontSize: 13, color: FAMILY_COLORS.textMuted }}>Currently on {DEMO_CHILD.curriculum} — Book {DEMO_CHILD.book}, {DEMO_CHILD.lessonBefore.id}</div>
        </div>
      </div>
      <p style={{ fontSize: 13, color: FAMILY_COLORS.textMuted, lineHeight: 1.7 }}>
        You'll follow {DEMO_CHILD.name} through: Family Home, asking Jona what to do next, completing a lesson,
        a quick confidence check-in, seeing progress update, and the wider HSD Family toolkit.
      </p>
      <PrimaryButton onClick={() => navigate("/family-demo/home")}>Start Demo →</PrimaryButton>
    </div>
  );
}

// 2. Family Home --------------------------------------------------------
export function StepFamilyHome() {
  const { voiceOn } = useVoice();
  return (
    <div>
      {/* The full-viewport photo backdrop lives in FamilyDemoShell now,
          applied to every step — this step just floats its content on
          top of it, same as the rest of the demo. */}
      <PageTitle eyebrow="Step 2" title="Family Home" subtitle={`What ${DEMO_CHILD.name} sees when they sign in.`} />
      <JonaBubble text={JONA_LINES.home} audioKey="home" voiceOn={voiceOn} />

      <div style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(6px)", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 4 }}>
          Continue Your Journey
        </div>
        <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, marginBottom: 4 }}>
          Last activity: {CONTINUE_JOURNEY.lastActivity.icon} {CONTINUE_JOURNEY.lastActivity.title}
        </div>
        <div style={{ fontSize: 17, fontWeight: 800, color: FAMILY_COLORS.text }}>
            {CONTINUE_JOURNEY.recommended.icon} {CONTINUE_JOURNEY.recommended.title}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14 }}>
          {MAIN_CATEGORIES.map((cat) => {
            const style = CATEGORY_STYLE[cat];
            return (
              <div key={cat} style={{ background: style.soft, border: `2px solid ${style.color}33`, borderRadius: 18, padding: "16px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{style.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: style.color, textTransform: "capitalize" }}>{cat}</div>
              </div>
            );
          })}
        </div>
    </div>
  );
}

// 3. Ask Jona -----------------------------------------------------------
export function StepAskJona() {
  const { voiceOn } = useVoice();
  const [asked, setAsked] = useState(false);
  const [thinking, setThinking] = useState(false);

  function ask() {
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setAsked(true);
    }, ASK_JONA.thinkingMs);
  }

  return (
    <div>
      <PageTitle eyebrow="Step 3" title="Parent View — Ask Jona" subtitle={`${DEMO_PARENT.name} wants to know what ${DEMO_CHILD.name} should do today.`} />
      <JonaBubble text={JONA_LINES.askJona} audioKey="askJona" voiceOn={voiceOn} />

      <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 20 }}>
        {!asked && !thinking && (
          <PrimaryButton onClick={ask}>{`"${ASK_JONA.question}"`}</PrimaryButton>
        )}
        {thinking && <div style={{ fontSize: 13, color: FAMILY_COLORS.textMuted, fontStyle: "italic" }}>Jona is thinking…</div>}
        {asked && (
          <div>
            <div style={{ fontSize: 14, color: FAMILY_COLORS.text, lineHeight: 1.7, marginBottom: 14 }}>{ASK_JONA.answer}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 8 }}>Grounded in</div>
            {ASK_JONA.evidence.map((e) => (
              <div key={e.source} style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, padding: "4px 0" }}>
                <span style={{ fontWeight: 700, color: FAMILY_COLORS.text }}>{e.source}</span> — {e.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 4. Activity -------------------------------------------------------------
export function StepActivity() {
  const { voiceOn } = useVoice();
  const [picked, setPicked] = useState(null);

  return (
    <div>
      <PageTitle eyebrow="Step 4" title={ACTIVITY_SCRIPT.title} subtitle={ACTIVITY_SCRIPT.subtitle} />
      <JonaBubble text={JONA_LINES.activity} audioKey="activity" voiceOn={voiceOn} />

      <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: FAMILY_COLORS.textMuted, marginBottom: 8 }}>{ACTIVITY_SCRIPT.prompt}</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: FAMILY_COLORS.blue, marginBottom: 20 }}>{ACTIVITY_SCRIPT.word}</div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {ACTIVITY_SCRIPT.options.map((opt) => {
            const isPicked = picked === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPicked(opt.id)}
                style={{
                  fontSize: 34, background: isPicked ? FAMILY_COLORS.pinkSoft : "#fff",
                  border: `2px solid ${isPicked ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
                  borderRadius: 16, padding: "14px 20px", cursor: "pointer", minWidth: 90,
                }}
              >
                <div>{opt.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: FAMILY_COLORS.textMuted, marginTop: 4 }}>{opt.label}</div>
              </button>
            );
          })}
        </div>
        {picked && (
          <div style={{ marginTop: 18, fontSize: 14, fontWeight: 700, color: picked === "frog" ? FAMILY_COLORS.green : FAMILY_COLORS.textMuted }}>
            {picked === "frog" ? `✅ ${ACTIVITY_SCRIPT.successLine}` : "Try again — listen for the “fr” sound."}
          </div>
        )}
      </div>
    </div>
  );
}

// 5. Confidence check-in ---------------------------------------------------
export function StepConfidence() {
  const { voiceOn } = useVoice();
  const [picked, setPicked] = useState(null);

  return (
    <div>
      <PageTitle eyebrow="Step 5" title="Confidence Check-in" subtitle={`A quick, child-friendly check — not a test score.`} />
      <JonaBubble text={JONA_LINES.confidence} audioKey="confidence" voiceOn={voiceOn} />

      <div style={{ background: FAMILY_COLORS.pinkSoft, border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 20, textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: FAMILY_COLORS.text, marginBottom: 14 }}>How did that feel, {DEMO_CHILD.name}?</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {CONFIDENCE_MOODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPicked(m.id)}
              style={{
                fontSize: 32, background: picked === m.id ? "#fff" : "#fff",
                border: `2px solid ${picked === m.id ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
                borderRadius: 16, padding: "12px 18px", cursor: "pointer",
              }}
            >
              <div>{m.emoji}</div>
            </button>
          ))}
        </div>
        {picked && (
          <div style={{ marginTop: 16, fontSize: 13, color: FAMILY_COLORS.textMuted }}>
            Recorded as a labeled confidence signal — visible to {DEMO_PARENT.name} in Parent View, never shown as a score.
          </div>
        )}
      </div>
    </div>
  );
}

// 6. Progress ---------------------------------------------------------------
export function StepProgress() {
  const { voiceOn } = useVoice();
  return (
    <div>
      <PageTitle eyebrow="Step 6" title="Progress Updates" subtitle="Parent View, right after the lesson and check-in above." />
      <JonaBubble text={JONA_LINES.progress} audioKey="progress" voiceOn={voiceOn} />

      <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 10 }}>This Week</div>
        <div style={{ fontSize: 13, color: FAMILY_COLORS.text }}>{PROGRESS_STATS.weeklyLine}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 20 }}>
        {MAIN_CATEGORIES.map((cat) => {
          const style = CATEGORY_STYLE[cat];
          const before = PROGRESS_STATS.before[cat];
          const after = PROGRESS_STATS.after[cat];
          const changed = after.done !== before.done;
          return (
            <div key={cat} style={{ background: style.soft, border: `2px solid ${style.color}33`, borderRadius: 14, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 16 }}>{style.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: FAMILY_COLORS.text }}>
                {after.done}/{after.total}
              </div>
              {changed && <div style={{ fontSize: 10, color: FAMILY_COLORS.green, fontWeight: 700 }}>+1 today</div>}
            </div>
          );
        })}
      </div>

      <div style={{ background: FAMILY_COLORS.pinkSoft, border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 6 }}>Recommended Next Step</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: FAMILY_COLORS.text }}>
          🎧 {DEMO_CHILD.curriculum} — {DEMO_CHILD.lessonAfter.id}: {DEMO_CHILD.lessonAfter.title}
        </div>
        <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, marginTop: 4 }}>
          The system adapted the moment the lesson and check-in above were completed.
        </div>
      </div>
    </div>
  );
}

// 7. Programs ----------------------------------------------------------------
export function StepPrograms() {
  const { voiceOn } = useVoice();
  return (
    <div>
      <PageTitle eyebrow="Step 7" title="The HSD Family Toolkit" subtitle="Five ways to practice, all guided by Jona." />
      <JonaBubble text={JONA_LINES.programs} audioKey="programs" voiceOn={voiceOn} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {PROGRAMS.map((p) => {
          const style = CATEGORY_STYLE[p.id];
          return (
            <div key={p.id} style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{p.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: style.color, marginBottom: 4 }}>{p.title}</div>
              <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, lineHeight: 1.5 }}>{p.body}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 8. Complete ------------------------------------------------------------------
export function StepComplete() {
  const navigate = useNavigate();
  const { voiceOn } = useVoice();
  return (
    <div style={{ textAlign: "center" }}>
      <PageTitle eyebrow="Demo Complete" title="That's HSD Family" subtitle="Every step you just saw was scripted demo data." />
      <JonaBubble text={JONA_LINES.complete} audioKey="complete" voiceOn={voiceOn} />
      <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10 }}>
        <PrimaryButton onClick={() => navigate("/family-demo")}>Restart Demo</PrimaryButton>
        <button
          onClick={() => navigate("/")}
          style={{ padding: "12px 22px", borderRadius: 14, border: `2px solid ${FAMILY_COLORS.border}`, background: "#fff", color: FAMILY_COLORS.text, fontWeight: 800, fontSize: 14, cursor: "pointer" }}
        >
          Exit to HSD OS
        </button>
      </div>
    </div>
  );
}
