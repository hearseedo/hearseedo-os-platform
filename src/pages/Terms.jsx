import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";

const COMPANY = "Hear See Do™";
const EMAIL   = "hearseedo.english@gmail.com";
const ADDRESS = "Meieki 3-4-10 Ultimate Meieki 1st 2F, Nakamura-ku, Nagoya-shi, Aichi 450-0002, Japan";
const UPDATED = "22 July 2026";

export default function Terms() {
  const navigate = useNavigate();
  return <LegalPage title="Terms of Service" updated={UPDATED} onBack={() => navigate(-1)}>

    <Section title="1. Acceptance of Terms">
      By accessing or using the HSD OS AI Platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Platform. These Terms apply to all users including subscribers, trial users, and visitors.
    </Section>

    <Section title="2. About the Platform">
      The Platform is operated by {COMPANY}, a language education service based at {ADDRESS}. The Platform provides English language learning tools, AI-assisted coaching, and access to educational applications for both children and adults.
    </Section>

    <Section title="3. Eligibility">
      <ul>
        <li>Users must be 13 years of age or older to create an account.</li>
        <li>Users under 18 must have parental or guardian consent.</li>
        <li>Children's accounts (Kids apps) must be set up and supervised by a parent or guardian.</li>
        <li>By using the Platform you confirm that all information you provide is accurate and complete.</li>
      </ul>
    </Section>

    <Section title="4. Subscriptions and Payment">
      <ul>
        <li>Access to apps and features requires an active subscription purchased on our landing page.</li>
        <li>Subscriptions are billed monthly in Japanese Yen (¥) via Stripe.</li>
        <li>All sales are final. Refunds are at our discretion and handled case-by-case.</li>
        <li>We reserve the right to change pricing with 30 days' notice to existing subscribers.</li>
        <li>Cancellation takes effect at the end of the current billing period.</li>
      </ul>
    </Section>

    <Section title="5. AI Features and Limitations">
      <ul>
        <li>The HSD AI assistant ("Jona") is powered by a third-party large language model. Responses are generated automatically and may occasionally be inaccurate or incomplete.</li>
        <li>AI-generated content is for educational support only and does not constitute professional advice.</li>
        <li>Daily message limits apply based on your subscription plan and reset at midnight Japan Standard Time (JST).</li>
        <li>We reserve the right to adjust AI usage limits to maintain service quality and manage operational costs.</li>
        <li>Users must not attempt to circumvent, abuse, or automate AI chat features.</li>
      </ul>
    </Section>

    <Section title="6. Acceptable Use">
      You agree not to:
      <ul>
        <li>Use the Platform for any unlawful purpose</li>
        <li>Share account credentials with others</li>
        <li>Attempt to reverse-engineer, scrape, or extract data from the Platform</li>
        <li>Upload or transmit harmful, offensive, or infringing content</li>
        <li>Use automated tools, bots, or scripts to interact with the AI or Platform</li>
        <li>Resell or redistribute Platform content without written permission</li>
      </ul>
    </Section>

    <Section title="7. Intellectual Property">
      All content on the Platform — including app names, branding, course materials, AI personas, and design — is the property of {COMPANY} or its licensors. You may not copy, reproduce, or redistribute any content without prior written consent. "Hear See Do™", "HSD OS AI™", "Monkey Yoga Phonics™", "Sip & Switch™", "The Inner Key Blueprint™", and all related marks are trademarks of {COMPANY}.
    </Section>

    <Section title="8. Third-Party Services">
      The Platform integrates with third-party services including Firebase (Google), Stripe, Anthropic, and ElevenLabs. Your use of these services is also subject to their respective terms and privacy policies. We are not responsible for the practices or content of third-party services.
    </Section>

    <Section title="9. Data and Privacy">
      We collect and process personal data as described in our Privacy Policy. By using the Platform you consent to this processing. We comply with applicable Japanese privacy law (Act on the Protection of Personal Information — APPI).
    </Section>

    <Section title="10. Disclaimer of Warranties">
      The Platform is provided "as is" without warranties of any kind. We do not guarantee that the Platform will be uninterrupted, error-free, or that AI responses will always be accurate. Educational outcomes are not guaranteed.
    </Section>

    <Section title="11. Limitation of Liability">
      To the maximum extent permitted by law, {COMPANY} shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Platform. Our total liability to you shall not exceed the amount you paid us in the three months preceding the claim.
    </Section>

    <Section title="12. Termination">
      We reserve the right to suspend or terminate your account at any time for violation of these Terms, fraudulent activity, or abuse of the AI features. You may cancel your account at any time by contacting us at {EMAIL}.
    </Section>

    <Section title="13. Referral Program">
      <strong style={{ color: COLORS.text }}>Eligibility:</strong> The Referral Program is available to registered members with an active paid subscription. Participation is optional.<br /><br />
      <strong style={{ color: COLORS.text }}>Active Paying Referral definition:</strong> A referred user counts as an "active paying referral" only when they have completed registration, hold an active paid subscription, and are not in a cancelled, refunded, or suspended state. Free-plan users and trial users do not count toward referral totals.<br /><br />
      <strong style={{ color: COLORS.text }}>Tier structure:</strong> Commission rates are determined by your current active paying referral count: Member (0–24) — no commission; Founder (25–49) — 5% recurring; Ambassador (50–99) — 6% recurring; Pioneer (100–199) — 7% recurring; Visionary (200+) — custom partnership terms. Legacy Founder is a manually assigned recognition status.<br /><br />
      <strong style={{ color: COLORS.text }}>Dynamic status:</strong> Your badge and commission rate update automatically. If your active referral count falls below a tier threshold (e.g. due to cancellations or refunds), your status and commission rate are reduced accordingly. There is no grace period.<br /><br />
      <strong style={{ color: COLORS.text }}>Commission calculation:</strong> Recurring commissions are calculated as a percentage of the referred subscriber's monthly subscription payment (excluding taxes, fees, and chargebacks) at the rate corresponding to your tier at the time of each payment.<br /><br />
      <strong style={{ color: COLORS.text }}>Payout:</strong> Commission payouts begin after public launch (July 1, 2026). Minimum payout threshold and payment method will be communicated prior to launch. {COMPANY} reserves the right to withhold commissions for accounts under review for fraud or policy violations.<br /><br />
      <strong style={{ color: COLORS.text }}>Prohibited conduct:</strong> Self-referrals, incentivised sign-ups using misleading claims, purchasing fake subscribers, or any attempt to artificially inflate your referral count are prohibited and will result in immediate account suspension and commission forfeiture.<br /><br />
      <strong style={{ color: COLORS.text }}>No cash value:</strong> Referral badges and tier status have no cash value and are not transferable. Only the commission rate associated with your active tier at payout time is redeemable.<br /><br />
      <strong style={{ color: COLORS.text }}>Modifications:</strong> {COMPANY} reserves the right to modify or terminate the Referral Program at any time with 30 days' notice to active participants. Changes to tier thresholds or commission rates will apply prospectively from the notice date.<br /><br />
      <strong style={{ color: COLORS.text }}>B2B exclusion:</strong> Students or organisations onboarded under a B2B institutional contract are not eligible referrals for the purposes of this program.
    </Section>

    <Section title="14. Educational Use, User Responsibility, and Disclaimer">
      <p style={{ marginBottom: 12 }}>HSDOS.AI is intended solely for educational and informational purposes. All lessons, courses, activities, exercises, AI-generated responses, feedback, suggestions, instructions, recommendations, assessments, and other content made available through the Platform are designed to support learning, communication, confidence, self-reflection, and personal development.</p>

      <p style={{ marginBottom: 12 }}>The Platform does not provide medical, psychological, mental-health, therapeutic, legal, financial, safety, or other professional advice. Platform content must not be treated as a substitute for advice from a qualified professional or used to make emergency, medical, legal, financial, mental-health, or other safety-critical decisions.</p>

      <p style={{ marginBottom: 12 }}>Users are responsible for evaluating, interpreting, and applying information provided through the Platform. Any decision, action, omission, or consequence resulting from a user's personal interpretation, modification, misuse, or real-world application of Platform content is undertaken at the user's own discretion and risk.</p>

      <p style={{ marginBottom: 12 }}>Actions taken by users based on their personal interpretation of Platform content do not constitute instructions, actions, representations, guarantees, or endorsements by {COMPANY}, its owners, employees, contractors, affiliates, partners, or subsidiaries.</p>

      <p style={{ marginBottom: 12 }}>AI-generated content may occasionally be incomplete, inaccurate, outdated, misleading, or inappropriate for a user's particular circumstances. Users should use reasonable judgement and independently verify important information before relying on or acting upon it.</p>

      <p style={{ marginBottom: 12 }}>{COMPANY} does not guarantee any specific educational, personal, professional, emotional, academic, examination, language-learning, confidence-building, or self-development result.</p>

      <p style={{ marginBottom: 12 }}>To the maximum extent permitted by applicable law, {COMPANY} and its related entities are not responsible for losses, injuries, damages, decisions, or other consequences caused by a user's independent decisions, personal interpretations, misuse, or real-world application of Platform content.</p>

      <p>Nothing in these Terms excludes or limits any responsibility, liability, or consumer right that cannot legally be excluded or limited under applicable law.</p>
    </Section>

    <Section title="15. Parents, Guardians, and Minors">
      <ul>
        <li>Parents and legal guardians are responsible for supervising minors' use of HSDOS.AI and its applications.</li>
        <li>Parents and guardians must determine whether lessons, AI interactions, self-reflection questions, physical activities, movement exercises, games, and other Platform content are appropriate for the child's age, maturity, abilities, circumstances, and environment.</li>
        <li>HSDOS.AI should not be treated as a replacement for appropriate adult supervision, professional teaching, medical care, psychological support, or other services provided by qualified professionals.</li>
        <li>Parents and guardians remain responsible for decisions or actions taken by a minor as a result of using or personally interpreting Platform content.</li>
      </ul>
    </Section>

    <Section title="16. Physical and Movement-Based Activities">
      <p style={{ marginBottom: 12 }}>Some HSDOS.AI applications, including Monkey Yoga Phonics and other movement-based learning experiences, may invite users to perform yoga-inspired poses, gestures, exercises, or physical movements.</p>

      <p style={{ marginBottom: 12 }}>These activities are provided for educational and recreational purposes and are not medical treatment, physical therapy, professional fitness instruction, or medical advice.</p>

      <p style={{ marginBottom: 12 }}>Users should consider their individual health, mobility, physical abilities, surroundings, and limitations before participating. Children should perform physical activities with appropriate adult supervision and in a safe, suitable space.</p>

      <p>Users should stop an activity immediately if they experience pain, dizziness, discomfort, breathing difficulty, or any other concerning symptom. Anyone with a medical condition, injury, disability, or health concern should consult an appropriately qualified healthcare professional before participating.</p>
    </Section>

    <Section title="17. The Inner Key Blueprint — Self-Reflection Disclaimer">
      <p style={{ marginBottom: 12 }}>The Inner Key Blueprint™ is an educational and personal-development application designed to encourage self-reflection and help users explore their values, confidence, goals, direction, and sense of purpose. Its purpose is to support users who may feel uncertain about their direction or who may struggle with understanding what gives their lives meaning or purpose.</p>

      <p style={{ marginBottom: 12 }}>The Inner Key Blueprint™ provides questions, exercises, prompts, educational content, and AI-supported reflection tools to help users think more deeply about themselves and their goals. It does not promise that a user will discover their purpose, resolve personal difficulties, improve their mental health, or achieve any particular result.</p>

      <p style={{ marginBottom: 12 }}>The content is informed by selected research, educational concepts, and the creator's own experiences, opinions, and personal interpretations. References to research do not mean that The Inner Key Blueprint™ is a clinically tested, medically approved, or scientifically validated treatment programme.</p>

      <p style={{ marginBottom: 12 }}>The creator of The Inner Key Blueprint™ is not a doctor, psychologist, psychiatrist, therapist, counsellor, or licensed mental-health professional. Neither the creator nor the application provides medical, psychological, psychiatric, diagnostic, therapeutic, or other professional healthcare advice.</p>

      <p style={{ marginBottom: 8 }}>Nothing within The Inner Key Blueprint™ should be interpreted as:</p>
      <ul style={{ marginBottom: 12 }}>
        <li>A medical or mental-health diagnosis</li>
        <li>Psychological or psychiatric treatment</li>
        <li>Therapy or professional counselling</li>
        <li>Medical advice</li>
        <li>Crisis intervention</li>
        <li>A substitute for a qualified healthcare or mental-health professional</li>
      </ul>

      <p style={{ marginBottom: 12 }}>The Inner Key Blueprint™ is not intended to diagnose, treat, cure, manage, or prevent any medical or mental-health condition.</p>

      <p style={{ marginBottom: 12 }}>Users are responsible for determining how they interpret and apply the application's questions, exercises, suggestions, AI-generated responses, and other content. Any decisions, conclusions, lifestyle changes, or actions resulting from a user's personal interpretation of the content are undertaken at the user's own discretion and risk. Such decisions or actions do not represent medical advice, professional instructions, guaranteed conclusions, or direct actions of {COMPANY}, The Inner Key Blueprint™, their creator, owners, employees, contractors, affiliates, partners, or subsidiaries.</p>

      <p style={{ marginBottom: 12 }}>AI-generated responses within The Inner Key Blueprint™ may not fully understand a user's personal circumstances, history, emotional condition, cultural background, or immediate needs. Users should not rely on these responses for medical, psychological, emergency, or safety-critical decisions.</p>

      <p style={{ marginBottom: 12, fontWeight: 600, color: "#e01010" }}>Users experiencing serious emotional distress, a mental-health crisis, thoughts of self-harm, thoughts of harming another person, or an immediate danger should not rely on The Inner Key Blueprint™ or its AI features for assistance. They should immediately contact local emergency services, an appropriate crisis-support service, or a qualified healthcare or mental-health professional.</p>

      <p style={{ marginBottom: 12 }}>Parents and legal guardians are responsible for supervising minors who use The Inner Key Blueprint™ and for determining whether its self-reflection activities, questions, and AI interactions are appropriate for the minor.</p>

      <p>Nothing in this section excludes or limits any responsibility, liability, or legal right that cannot be excluded or limited under applicable law.</p>
    </Section>

    <Section title="18. Changes to Terms">
      We may update these Terms from time to time. We will notify registered users by email at least 14 days before material changes take effect. Continued use of the Platform after that date constitutes acceptance.
    </Section>

    <Section title="19. Governing Law">
      These Terms are governed by the laws of Japan. Any disputes shall be resolved in the courts of Nagoya, Aichi Prefecture, Japan.
    </Section>

    <Section title="20. Contact">
      For any questions regarding these Terms, contact us at: <a href={`mailto:${EMAIL}`} style={{ color: COLORS.red }}>{EMAIL}</a>
    </Section>

  </LegalPage>;
}

// ── Shared layout ─────────────────────────────────────────────────────────────

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
      <h2 style={{ fontSize: 16, fontWeight: 700, color: COLORS.red, marginBottom: 10, letterSpacing: 0.5 }}>{title}</h2>
      <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.8 }}>
        {children}
      </div>
    </div>
  );
}
