import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";

const COMPANY = "Hear See Do™";
const EMAIL   = "hearseedo.english@gmail.com";
const ADDRESS = "Meieki 3-4-10 Ultimate Meieki 1st 2F, Nakamura-ku, Nagoya-shi, Aichi 450-0002, Japan";
const UPDATED = "15 June 2026";

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

    <Section title="15. Changes to Terms">
      We may update these Terms from time to time. We will notify registered users by email at least 14 days before material changes take effect. Continued use of the Platform after that date constitutes acceptance.
    </Section>

    <Section title="16. Governing Law">
      These Terms are governed by the laws of Japan. Any disputes shall be resolved in the courts of Nagoya, Aichi Prefecture, Japan.
    </Section>

    <Section title="17. Contact">
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
