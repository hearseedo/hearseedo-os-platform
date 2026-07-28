import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";

const COMPANY = "Hear See Do™";
const EMAIL   = "hearseedo.english@gmail.com";
const UPDATED = "22 July 2026";

export default function Disclaimer() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ height: 56, background: "#0d0000", borderBottom: "1px solid rgba(224,16,16,0.2)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, position: "sticky", top: 0, zIndex: 50 }}>
        <img src="/assets/logo.png" alt="HSD" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
        <span style={{ fontSize: 11, color: "#e01010", letterSpacing: 3, fontWeight: 700 }}>HEAR SEE DO™</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 12, padding: "5px 14px", cursor: "pointer" }}>← Back</button>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 8, fontSize: 10, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase" }}>Legal</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px", color: COLORS.text }}>Educational Disclaimer</h1>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 48 }}>Last updated: {UPDATED}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          <Block title="Educational Purpose Only">
            <p>HSDOS.AI is an educational platform. All content — including lessons, exercises, AI responses, and application experiences — is provided for informational and educational purposes only. It is not a substitute for professional medical, psychological, legal, financial, or safety advice.</p>
          </Block>

          <Block title="Your Responsibility">
            <p style={{ marginBottom: 12 }}>You are responsible for evaluating and applying Platform content based on your own circumstances, knowledge, and judgement. Any decision, action, or consequence resulting from your personal use or interpretation of Platform content is your own responsibility.</p>
            <p>Actions taken based on your interpretation of Platform content do not constitute instructions, advice, guarantees, or endorsements by {COMPANY}.</p>
          </Block>

          <Block title="AI Content Limitations">
            <p>AI-generated responses from Jona and other AI features within the Platform may occasionally be incomplete, inaccurate, outdated, or not suited to your particular situation. Always use reasonable judgement and verify important information independently before acting on it. Do not rely on AI responses for emergency, medical, psychological, or other safety-critical decisions.</p>
          </Block>

          <Block title="Parents and Guardians">
            <p>Parents and legal guardians are responsible for supervising minors' use of the Platform and for deciding whether any lesson, activity, AI interaction, or self-reflection exercise is appropriate for the child's age, maturity, and circumstances.</p>
          </Block>

          <Block title="Physical Activities">
            <p style={{ marginBottom: 12 }}>Some apps — including Monkey Yoga Phonics — may include yoga-inspired poses or movement exercises. These are provided for educational and recreational purposes only and are not medical treatment, physical therapy, or professional fitness instruction.</p>
            <p>Stop any activity immediately if you experience pain, dizziness, or discomfort. Consult a qualified healthcare professional before participating if you have any health concern, injury, or medical condition. Children should always be supervised by a responsible adult during physical activities.</p>
          </Block>

          <Block title="The Inner Key Blueprint™ — Self-Reflection">
            <p style={{ marginBottom: 12 }}>The Inner Key Blueprint™ is an educational and personal-development application. It is not therapy, counselling, psychiatric treatment, or medical advice. The creator is not a doctor, psychologist, therapist, or licensed mental-health professional.</p>
            <p style={{ marginBottom: 12 }}>Nothing within The Inner Key Blueprint™ should be treated as a medical or mental-health diagnosis, psychological treatment, crisis intervention, or a substitute for a qualified healthcare professional.</p>
            <p style={{ marginBottom: 12, fontWeight: 600, color: "#e01010" }}>If you are experiencing serious emotional distress, a mental-health crisis, thoughts of self-harm, or any immediate danger — stop using the app and immediately contact local emergency services, a crisis-support line, or a qualified healthcare or mental-health professional.</p>
            <p>Your decisions, conclusions, or actions based on your personal interpretation of The Inner Key Blueprint™ content are your own responsibility and do not represent advice, instructions, or endorsements by {COMPANY} or the application's creator.</p>
          </Block>

          <Block title="No Guaranteed Outcomes">
            <p>{COMPANY} does not guarantee any specific educational, language-learning, confidence-building, personal-development, or self-discovery outcome from using the Platform or any of its applications.</p>
          </Block>

          <Block title="Full Legal Terms">
            <p>This page is a concise summary. The full legal Terms of Service — including the complete educational disclaimer, parents and guardians provisions, physical activities disclaimer, and The Inner Key Blueprint™ self-reflection disclaimer — are available at <a href="/terms" style={{ color: "#e01010" }}>Terms of Service</a>. In the event of any inconsistency between this summary and the full Terms, the full Terms prevail.</p>
          </Block>

          <Block title="Contact">
            <p>Questions? Contact us at <a href={`mailto:${EMAIL}`} style={{ color: "#e01010" }}>{EMAIL}</a>.</p>
          </Block>

        </div>
      </div>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e01010", marginBottom: 10, letterSpacing: 0.5 }}>{title}</h2>
      <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}
