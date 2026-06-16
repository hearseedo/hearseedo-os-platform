import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";

const COMPANY = "Hear See Do™";
const EMAIL   = "hearseedo.english@gmail.com";
const ADDRESS = "Meieki 3-4-10 Ultimate Meieki 1st 2F, Nakamura-ku, Nagoya-shi, Aichi 450-0002, Japan";
const UPDATED = "15 June 2026";

export default function Privacy() {
  const navigate = useNavigate();
  return <LegalPage title="Privacy Policy" updated={UPDATED} onBack={() => navigate(-1)}>

    <Section title="1. Introduction">
      {COMPANY} ("we", "us", "our") is committed to protecting your personal information. This Privacy Policy explains what data we collect, how we use it, and your rights under applicable law — including Japan's Act on the Protection of Personal Information (APPI) and applicable international standards. Our address is: {ADDRESS}.
    </Section>

    <Section title="2. Data We Collect">
      <strong style={{ color: COLORS.text }}>Account data:</strong> Name, email address, password (hashed), profile information.<br /><br />
      <strong style={{ color: COLORS.text }}>Usage data:</strong> Learning activity, app usage, lesson completions, XP earned, streak data, confidence scores.<br /><br />
      <strong style={{ color: COLORS.text }}>AI conversation data:</strong> Messages sent to the HSD AI assistant. These are used to generate responses and are not stored permanently on our servers beyond what Firestore logging requires for rate limiting (daily message counts only).<br /><br />
      <strong style={{ color: COLORS.text }}>Payment data:</strong> Processed entirely by Stripe. We do not store card numbers or full payment details. We receive subscription status and plan type only.<br /><br />
      <strong style={{ color: COLORS.text }}>Device and technical data:</strong> Browser type, IP address, device type, and session data collected automatically via Firebase.
    </Section>

    <Section title="3. How We Use Your Data">
      <ul>
        <li>To provide and operate the Platform and its features</li>
        <li>To personalise your learning experience and AI coaching</li>
        <li>To track progress, streaks, XP, and confidence scores</li>
        <li>To enforce daily AI message limits based on your plan</li>
        <li>To manage your subscription and process payments via Stripe</li>
        <li>To send service communications (account updates, plan changes)</li>
        <li>To improve Platform features and AI response quality</li>
        <li>To detect and prevent abuse, fraud, or ToS violations</li>
      </ul>
      We do not sell your personal data to third parties. We do not use your data for advertising.
    </Section>

    <Section title="4. Children's Data">
      Some features of the Platform (Kids apps) are designed for children. We do not knowingly collect data from children under 13 without verifiable parental consent. Parents or guardians who set up children's accounts are responsible for providing accurate consent and supervising usage. If you believe a child under 13 has created an account without consent, contact us immediately at {EMAIL}.
    </Section>

    <Section title="5. Third-Party Services">
      We use the following third-party services which may process your data:
      <ul>
        <li><strong style={{ color: COLORS.text }}>Firebase (Google)</strong> — authentication, database, and hosting. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noreferrer" style={{ color: COLORS.red }}>Privacy Policy</a></li>
        <li><strong style={{ color: COLORS.text }}>Stripe</strong> — payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer" style={{ color: COLORS.red }}>Privacy Policy</a></li>
        <li><strong style={{ color: COLORS.text }}>Anthropic</strong> — AI language model powering HSD AI. Messages are processed on their servers. <a href="https://www.anthropic.com/privacy" target="_blank" rel="noreferrer" style={{ color: COLORS.red }}>Privacy Policy</a></li>
        <li><strong style={{ color: COLORS.text }}>ElevenLabs</strong> — voice synthesis (when enabled). <a href="https://elevenlabs.io/privacy" target="_blank" rel="noreferrer" style={{ color: COLORS.red }}>Privacy Policy</a></li>
        <li><strong style={{ color: COLORS.text }}>Netlify</strong> — platform hosting and serverless functions. <a href="https://www.netlify.com/privacy/" target="_blank" rel="noreferrer" style={{ color: COLORS.red }}>Privacy Policy</a></li>
      </ul>
    </Section>

    <Section title="6. AI Conversations">
      When you use the HSD AI chat feature, your messages are sent to Anthropic's API to generate responses. We only store your daily message count in Firestore (a number, not the content) for the purpose of enforcing plan limits. Anthropic may retain message data in accordance with their own privacy policy. Do not share sensitive personal information (financial details, passwords, medical information) in chat.
    </Section>

    <Section title="7. Data Retention">
      <ul>
        <li>Account data is retained for as long as your account is active.</li>
        <li>Daily AI usage counts are automatically deleted after 30 days.</li>
        <li>Payment records are retained as required by Japanese tax law (7 years).</li>
        <li>You may request deletion of your account and data at any time (see Section 9).</li>
      </ul>
    </Section>

    <Section title="8. Data Security">
      We use industry-standard security measures including Firebase Authentication, HTTPS encryption, and server-side API key management. No method of transmission over the internet is 100% secure. In the event of a data breach affecting your information, we will notify you as required by law.
    </Section>

    <Section title="9. Your Rights">
      Under APPI and applicable law, you have the right to:
      <ul>
        <li><strong style={{ color: COLORS.text }}>Access</strong> — request a copy of the personal data we hold about you</li>
        <li><strong style={{ color: COLORS.text }}>Correction</strong> — request correction of inaccurate data</li>
        <li><strong style={{ color: COLORS.text }}>Deletion</strong> — request deletion of your account and personal data</li>
        <li><strong style={{ color: COLORS.text }}>Portability</strong> — request your data in a portable format</li>
        <li><strong style={{ color: COLORS.text }}>Objection</strong> — object to certain types of data processing</li>
      </ul>
      To exercise any of these rights, contact us at <a href={`mailto:${EMAIL}`} style={{ color: COLORS.red }}>{EMAIL}</a>. We will respond within 30 days.
    </Section>

    <Section title="10. Referral Program Data">
      If you participate in the Referral Program, we collect and store: your unique referral code, the UIDs of users who signed up using your code, your active referral count, your current badge tier (Member / Founder / Ambassador / Pioneer / Visionary / Legacy Founder), your commission rate, lifetime referral totals, and the timestamp of your last badge update. This data is stored in our Firestore database under your user account and is only accessible to you and our server-side systems.<br /><br />
      We do not share individual referral statistics with third parties. Aggregate referral data (e.g. total programme participants) may be used for internal analytics. Referral records are retained for the duration of your account and for 3 years after account closure to support commission dispute resolution.
    </Section>

    <Section title="11. Cookies and Tracking">
      The Platform uses Firebase Authentication session cookies to keep you logged in. We do not use advertising cookies or third-party tracking pixels. You can clear cookies through your browser settings, which will log you out of the Platform.
    </Section>

    <Section title="12. International Transfers">
      Your data may be processed in the United States and other countries by our third-party service providers (Google, Anthropic, Stripe). We ensure these transfers are made in compliance with applicable data protection law.
    </Section>

    <Section title="13. Changes to This Policy">
      We may update this Privacy Policy from time to time. We will notify you by email at least 14 days before material changes take effect. The "Last updated" date at the top of this page reflects the most recent version.
    </Section>

    <Section title="14. Contact Us">
      For any privacy-related questions, requests, or concerns:<br /><br />
      {COMPANY}<br />
      {ADDRESS}<br />
      <a href={`mailto:${EMAIL}`} style={{ color: COLORS.red }}>{EMAIL}</a>
    </Section>

  </LegalPage>;
}

function LegalPage({ title, updated, onBack, children }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ height: 56, background: "#0d0000", borderBottom: "1px solid rgba(224,16,16,0.2)", display: "flex", alignItems: "center", padding: "0 24px", gap: 16, position: "sticky", top: 0, zIndex: 50 }}>
        <img src="/assets/logo.png" alt="HSD" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover" }} />
        <span style={{ fontSize: 11, color: COLORS.red, letterSpacing: 3, fontWeight: 700 }}>HEAR SEE DO™</span>
        <div style={{ flex: 1 }} />
        <button onClick={onBack} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 12, padding: "5px 14px", cursor: "pointer" }}>← Back</button>
      </header>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px 80px" }}>
        <div style={{ marginBottom: 8, fontSize: 10, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase" }}>Legal</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px", color: COLORS.text }}>{title}</h1>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 48 }}>Last updated: {updated}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.red, marginBottom: 10 }}>{title}</h2>
      <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.8 }}>{children}</div>
    </div>
  );
}
