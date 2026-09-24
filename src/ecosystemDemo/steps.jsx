import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ECO, useJourney } from "./EcosystemDemoShell";
import { PATHWAYS_DEMO, JONA_HELP_SCRIPT, CONFIDENCE_EXAMPLE } from "./data";
import { ACTIVITY_SCRIPT } from "../familyDemo/data";
import GlobalJonaAssistant from "../jona/GlobalJonaAssistant";
import { speakWithBrowserTts } from "../lib/browserNarration";

function PageTitle({ eyebrow, title, subtitle }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {eyebrow && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: ECO.gold, marginBottom: 6 }}>{eyebrow}</div>}
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 8px" }}>{title}</h1>
      {subtitle && <p style={{ color: ECO.textMuted, fontSize: 14, lineHeight: 1.6, margin: 0, maxWidth: 600 }}>{subtitle}</p>}
    </div>
  );
}

// Narrates its own text via browser speechSynthesis when the demo's voice
// toggle is on (2026-09-24, "voice needs to follow through, each step") —
// same proven pattern as src/familyDemo/JonaBubble.jsx. Only handles a
// plain-string child (every real call site passes one); silently skips
// narration for anything else rather than risk reading raw JSX/markup aloud.
function JonaLine({ children }) {
  const { voiceOn } = useJourney();
  const spoken = useRef("");
  const text = typeof children === "string" ? children : null;

  useEffect(() => {
    if (!voiceOn || !text || spoken.current === text) return;
    spoken.current = text;
    speakWithBrowserTts(text);
  }, [voiceOn, text]);

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 24 }}>
      <img src="/assets/hsd/family/characters/family-jona.webp" alt="Jona" width={56} height={56} style={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0 }} />
      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: "4px 18px 18px 18px", padding: "14px 18px", maxWidth: 520 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 4 }}>Jona</div>
        <div style={{ fontSize: 14, color: ECO.text, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

// 1. Welcome ------------------------------------------------------------
export function Step1Welcome() {
  const navigate = useNavigate();
  return (
    <div>
      <PageTitle eyebrow="HSD OS AI" title="One journey. One platform. Confidence first." subtitle="HSD OS AI brings together learning experiences for children, students, adults, families, and educators — all guided by one companion." />
      <JonaLine>
        Hi, I'm Jona. I'm your guide, teacher, practice partner, and confidence coach — wherever you are in HSD OS AI, I'm with you. You are never learning alone.
      </JonaLine>
      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: ECO.textMuted, lineHeight: 1.7, margin: 0 }}>
          Over the next few minutes you'll choose a journey, see the real experiences inside it, watch Jona help someone who's stuck,
          and see how HSD OS AI puts confidence before correctness.
        </p>
      </div>
      <button onClick={() => navigate("/eco-demo/journey")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        Start →
      </button>
    </div>
  );
}

// 2. Choose Your Journey --------------------------------------------------
export function Step2Journey() {
  const { pathwayId, setPathwayId } = useJourney();
  const navigate = useNavigate();
  const active = PATHWAYS_DEMO.find((p) => p.id === pathwayId);

  return (
    <div>
      <PageTitle eyebrow="Step 2" title="Choose Your Journey" subtitle="HSD OS AI isn't one course — it's an ecosystem. Pick a pathway to preview it (you can explore all of them)." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {PATHWAYS_DEMO.map((p) => (
          <button key={p.id} onClick={() => setPathwayId(p.id)} style={{
            textAlign: "left", padding: "16px 14px", borderRadius: 16, cursor: "pointer",
            background: p.id === pathwayId ? `${p.accent}22` : ECO.card,
            border: `2px solid ${p.id === pathwayId ? p.accent : ECO.border}`, color: ECO.text,
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: p.id === pathwayId ? p.accent : ECO.text, marginBottom: 4 }}>{p.name}</div>
            <div style={{ fontSize: 12, color: ECO.textMuted, lineHeight: 1.4 }}>{p.tagline}</div>
          </button>
        ))}
      </div>
      {active && (
        <div style={{ background: ECO.card, border: `2px solid ${active.accent}55`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: active.accent, textTransform: "uppercase", marginBottom: 6 }}>Previewing</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{active.name}</div>
          <div style={{ fontSize: 13, color: ECO.textMuted }}>{active.apps.length} experiences inside — see them next.</div>
        </div>
      )}
      <button onClick={() => navigate("/eco-demo/discover")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        Discover the experiences →
      </button>
    </div>
  );
}

// 3. Discover the Experiences ---------------------------------------------
export function Step3Discover() {
  const { pathwayId } = useJourney();
  const navigate = useNavigate();
  const active = PATHWAYS_DEMO.find((p) => p.id === pathwayId) ?? PATHWAYS_DEMO[0];

  return (
    <div>
      <PageTitle eyebrow="Step 3" title={`Inside ${active.name}`} subtitle="HSD OS AI isn't one course. It's an expanding ecosystem of real learning experiences." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        {active.apps.map((app) => (
          <div key={app.name} style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 16, overflow: "hidden" }}>
            {app.image ? (
              <img src={app.image} alt="" style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
            ) : (
              <div style={{ width: "100%", height: 100, background: `${active.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>📘</div>
            )}
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {app.name}
                {app.comingSoon && <span style={{ fontSize: 9, fontWeight: 800, color: ECO.gold, border: `1px solid ${ECO.gold}`, borderRadius: 999, padding: "2px 6px" }}>SOON</span>}
                {app.badge && <span style={{ fontSize: 9, fontWeight: 800, color: active.accent, border: `1px solid ${active.accent}`, borderRadius: 999, padding: "2px 6px" }}>{app.badge}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: ECO.textMuted, lineHeight: 1.4 }}>{app.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => navigate("/eco-demo/meet-jona")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        Meet Jona →
      </button>
    </div>
  );
}

// 4. Meet Jona — the "aha" moment, inside a real lesson --------------------
export function Step4MeetJona() {
  const navigate = useNavigate();
  const [picked, setPicked] = useState(null);

  return (
    <div>
      <PageTitle eyebrow="Step 4 · The aha moment" title="Jona is available inside every experience" subtitle="Not just on a dashboard, not on a separate page — right here, while you're learning." />

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 24, textAlign: "center", marginBottom: 20, position: "relative" }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 8 }}>{ACTIVITY_SCRIPT.title}</div>
        <div style={{ fontSize: 13, color: ECO.textMuted, marginBottom: 8 }}>{ACTIVITY_SCRIPT.prompt}</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: "#2f8fed", marginBottom: 18 }}>{ACTIVITY_SCRIPT.word}</div>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {ACTIVITY_SCRIPT.options.map((opt) => (
            <button key={opt.id} onClick={() => setPicked(opt.id)} style={{ fontSize: 30, background: picked === opt.id ? "rgba(201,168,76,0.15)" : "#0d0d0d", border: `2px solid ${picked === opt.id ? ECO.gold : ECO.border}`, borderRadius: 14, padding: "12px 18px", cursor: "pointer" }}>
              <div>{opt.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ECO.textMuted, marginTop: 4 }}>{opt.label}</div>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: ECO.textMuted, marginTop: 18 }}>
          Stuck? Tap the Jona bubble in the corner — a real student never needs to leave this screen to get help.
        </p>
      </div>

      <GlobalJonaAssistant
        context={{ pathway: "family", appName: "Monkey Yoga Phonics", lesson: ACTIVITY_SCRIPT.title }}
        suggestedPrompts={["I don't understand this", "Can you give me a hint?", "Can we practise this together?", "Is my answer okay?"]}
        demoScript={JONA_HELP_SCRIPT}
        bottomOffset={88}
      />

      <button onClick={() => navigate("/eco-demo/confidence")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        See Confidence First →
      </button>
    </div>
  );
}

// 5. Confidence First -------------------------------------------------------
export function Step5Confidence() {
  const navigate = useNavigate();
  return (
    <div>
      <PageTitle eyebrow="Step 5" title="Confidence before correctness" subtitle="HSD OS AI isn't simply checking right and wrong answers." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: ECO.card, border: "2px solid rgba(224,16,16,0.4)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#ff5050", textTransform: "uppercase", marginBottom: 10 }}>The old way</div>
          <div style={{ fontSize: 13, color: ECO.textMuted, marginBottom: 10, fontStyle: "italic" }}>{CONFIDENCE_EXAMPLE.learnerAttempt}</div>
          <div style={{ fontSize: 13, color: "#ff8080" }}>✕ {CONFIDENCE_EXAMPLE.wrongWay}</div>
        </div>
        <div style={{ background: ECO.card, border: `2px solid ${ECO.gold}66`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 10 }}>Jona's way</div>
          <div style={{ fontSize: 13, color: ECO.textMuted, marginBottom: 10, fontStyle: "italic" }}>{CONFIDENCE_EXAMPLE.learnerAttempt}</div>
          <div style={{ fontSize: 13, color: "#e8d9a8" }}>✓ "{CONFIDENCE_EXAMPLE.jonaWay}"</div>
        </div>
      </div>

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: ECO.textMuted, lineHeight: 1.7, margin: 0 }}>
          A learner who feels safe will try. A learner who tries will communicate. A learner who communicates can then improve.
          Jona protects that first attempt — real speaking practice, not a red pen.
        </p>
      </div>

      <button onClick={() => navigate("/eco-demo/connected")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        Finish →
      </button>
    </div>
  );
}

// 6. One Connected Journey ---------------------------------------------------
export function Step6Connected() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: "center" }}>
      <PageTitle eyebrow="One HSD OS AI" title="One connected journey" subtitle="Progress, learning experiences, and Jona all belong to the same platform — wherever you go next." />
      <JonaLine>Learn. Practise. Ask. Grow. I'm with you along the way.</JonaLine>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={() => navigate("/eco-demo")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          Explore HSD OS AI again
        </button>
        <button onClick={() => navigate("/")} style={{ padding: "12px 22px", borderRadius: 14, border: `2px solid ${ECO.border}`, background: "transparent", color: ECO.text, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          Exit
        </button>
      </div>
    </div>
  );
}
