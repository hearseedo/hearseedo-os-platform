import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ECO, useJourney } from "./EcosystemDemoShell";
import { PATHWAYS_DEMO, CONFIDENCE_EXAMPLE } from "./data";
import { speakWithBrowserTts } from "../lib/browserNarration";
import { useLang } from "../hooks/useLang";
import StudentsPractice from "./students/StudentsPractice";
import FamilyPractice from "./family/FamilyPractice";
import AdultsPractice from "./adults/AdultsPractice";
import EducatorsPractice from "./educators/EducatorsPractice";

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
  // lang (2026-09-27 fix): narration previously always called
  // speakWithBrowserTts(text) with no lang argument, so it silently spoke
  // every line in English even with the JP toggle on and JP text passed in
  // — speakWithBrowserTts's own EN/JP voice selection was simply never
  // reached. Passing lang here is the actual fix; the text itself was
  // already correctly localized via t() at each call site.
  const { lang } = useLang();
  const spoken = useRef("");
  const text = typeof children === "string" ? children : null;

  useEffect(() => {
    if (!voiceOn || !text || spoken.current === text) return;
    spoken.current = text;
    speakWithBrowserTts(text, lang);
  }, [voiceOn, text, lang]);

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

// Points at the floating Jona launcher bubble (rendered by whichever
// PATHWAY_PRACTICE component is active — see below; always bottomOffset=88,
// size=84, right=20) so a first-time visitor on Step 4 actually notices
// it's there and clickable, rather than discovering it by accident.
// pointerEvents:none so it never blocks the real bubble underneath it.
function JonaPointer({ label }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed", bottom: 88 + 84 + 14, right: 26, zIndex: 998,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
        pointerEvents: "none", animation: "eco-jona-pointer-fade-in 0.6s ease-out",
      }}
    >
      <style>{`
        @keyframes eco-jona-pointer-bounce { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(6px, 6px); } }
        @keyframes eco-jona-pointer-fade-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div style={{
        background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 12,
        padding: "8px 14px", borderRadius: 12, boxShadow: "0 6px 18px rgba(201,168,76,0.45)",
        maxWidth: 170, textAlign: "center", lineHeight: 1.35,
      }}>
        {label}
      </div>
      <div style={{ fontSize: 30, lineHeight: 1, color: ECO.gold, animation: "eco-jona-pointer-bounce 1.3s ease-in-out infinite" }}>↘</div>
    </div>
  );
}

// 1. Welcome ------------------------------------------------------------
export function Step1Welcome() {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <div>
      <PageTitle eyebrow={t("eco_step1_eyebrow")} title={t("eco_step1_title")} subtitle={t("eco_step1_subtitle")} />
      <JonaLine>{t("eco_step1_jona_line")}</JonaLine>
      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: ECO.textMuted, lineHeight: 1.7, margin: 0 }}>
          {t("eco_step1_body")}
        </p>
      </div>
      <button onClick={() => navigate("/eco-demo/journey")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        {t("eco_step1_start")}
      </button>
    </div>
  );
}

// 2. Choose Your Journey --------------------------------------------------
export function Step2Journey() {
  const { pathwayId, setPathwayId } = useJourney();
  const navigate = useNavigate();
  const { t } = useLang();
  const active = PATHWAYS_DEMO.find((p) => p.id === pathwayId);

  return (
    <div>
      <PageTitle eyebrow={t("eco_step2_eyebrow")} title={t("eco_step2_title")} subtitle={t("eco_step2_subtitle")} />
      <JonaLine>{t("eco_step2_jona_line")}</JonaLine>
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
          <div style={{ fontSize: 11, fontWeight: 800, color: active.accent, textTransform: "uppercase", marginBottom: 6 }}>{t("eco_step2_previewing")}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{active.name}</div>
          <div style={{ fontSize: 13, color: ECO.textMuted }}>{t("eco_step2_experiences_inside").replace("{count}", String(active.apps.length))}</div>
        </div>
      )}
      <button onClick={() => navigate("/eco-demo/discover")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        {t("eco_step2_discover")}
      </button>
    </div>
  );
}

// 3. Discover the Experiences ---------------------------------------------
export function Step3Discover() {
  const { pathwayId } = useJourney();
  const navigate = useNavigate();
  const { t } = useLang();
  const active = PATHWAYS_DEMO.find((p) => p.id === pathwayId) ?? PATHWAYS_DEMO[0];

  return (
    <div>
      <PageTitle eyebrow={t("eco_step3_eyebrow")} title={t("eco_step3_title").replace("{name}", active.name)} subtitle={t("eco_step3_subtitle")} />
      <JonaLine>{t("eco_step3_jona_line").replace("{name}", active.name)}</JonaLine>
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
                {app.comingSoon && <span style={{ fontSize: 9, fontWeight: 800, color: ECO.gold, border: `1px solid ${ECO.gold}`, borderRadius: 999, padding: "2px 6px" }}>{t("eco_step3_soon")}</span>}
                {app.badge && <span style={{ fontSize: 9, fontWeight: 800, color: active.accent, border: `1px solid ${active.accent}`, borderRadius: 999, padding: "2px 6px" }}>{app.badge}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: ECO.textMuted, lineHeight: 1.4 }}>{app.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => navigate("/eco-demo/meet-jona")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        {t("eco_step3_meet_jona")}
      </button>
    </div>
  );
}

// 4. Meet Jona — the "aha" moment, inside a real lesson --------------------
// Branches on the pathway actually selected in Step 2 (2026-09-26 fix —
// this previously always rendered the Family/Monkey-Yoga-Phonics activity
// regardless of pathwayId). Only "student" has its own rebuilt experience
// so far (Phase 1); every other pathway keeps today's Family block exactly
// as it was, unchanged, until its own phase.
const PATHWAY_PRACTICE = {
  family: FamilyPractice,
  student: StudentsPractice,
  adult: AdultsPractice,
  educator: EducatorsPractice,
};

export function Step4MeetJona() {
  const navigate = useNavigate();
  const { pathwayId } = useJourney();
  const { t } = useLang();
  const Practice = PATHWAY_PRACTICE[pathwayId] ?? FamilyPractice;

  return (
    <div>
      <PageTitle eyebrow={t("eco_step4_eyebrow")} title={t("eco_step4_title")} subtitle={t("eco_step4_subtitle")} />
      <JonaLine>{t("eco_step4_jona_line")}</JonaLine>
      <JonaPointer label={t("eco_step4_pointer")} />

      <Practice />

      <button onClick={() => navigate("/eco-demo/confidence")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer", marginTop: 8 }}>
        {t("eco_demo_see_confidence")}
      </button>
    </div>
  );
}

// 5. Confidence First -------------------------------------------------------
export function Step5Confidence() {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <div>
      <PageTitle eyebrow={t("eco_step5_eyebrow")} title={t("eco_step5_title")} subtitle={t("eco_step5_subtitle")} />
      <JonaLine>{t("eco_step5_jona_line")}</JonaLine>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
        <div style={{ background: ECO.card, border: "2px solid rgba(224,16,16,0.4)", borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#ff5050", textTransform: "uppercase", marginBottom: 10 }}>{t("eco_step5_old_way")}</div>
          <div style={{ fontSize: 13, color: ECO.textMuted, marginBottom: 10, fontStyle: "italic" }}>{CONFIDENCE_EXAMPLE.learnerAttempt}</div>
          <div style={{ fontSize: 13, color: "#ff8080" }}>✕ {CONFIDENCE_EXAMPLE.wrongWay}</div>
        </div>
        <div style={{ background: ECO.card, border: `2px solid ${ECO.gold}66`, borderRadius: 16, padding: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ECO.gold, textTransform: "uppercase", marginBottom: 10 }}>{t("eco_step5_jona_way")}</div>
          <div style={{ fontSize: 13, color: ECO.textMuted, marginBottom: 10, fontStyle: "italic" }}>{CONFIDENCE_EXAMPLE.learnerAttempt}</div>
          <div style={{ fontSize: 13, color: "#e8d9a8" }}>✓ "{CONFIDENCE_EXAMPLE.jonaWay}"</div>
        </div>
      </div>

      <div style={{ background: ECO.card, border: `2px solid ${ECO.border}`, borderRadius: 16, padding: 18, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: ECO.textMuted, lineHeight: 1.7, margin: 0 }}>
          {t("eco_step5_body")}
        </p>
      </div>

      <button onClick={() => navigate("/eco-demo/connected")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
        {t("eco_step5_finish")}
      </button>
    </div>
  );
}

// 6. One Connected Journey ---------------------------------------------------
export function Step6Connected() {
  const navigate = useNavigate();
  const { t } = useLang();
  return (
    <div style={{ textAlign: "center" }}>
      <PageTitle eyebrow={t("eco_step6_eyebrow")} title={t("eco_step6_title")} subtitle={t("eco_step6_subtitle")} />
      <JonaLine>{t("eco_step6_jona_line")}</JonaLine>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
        <button onClick={() => navigate("/eco-demo")} style={{ padding: "12px 22px", borderRadius: 14, border: "none", background: ECO.gold, color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          {t("eco_step6_explore_again")}
        </button>
        <button onClick={() => navigate("/")} style={{ padding: "12px 22px", borderRadius: 14, border: `2px solid ${ECO.border}`, background: "transparent", color: ECO.text, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          {t("eco_demo_exit")}
        </button>
      </div>
    </div>
  );
}
