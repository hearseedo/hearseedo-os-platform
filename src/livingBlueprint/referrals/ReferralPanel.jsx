import { useState } from "react";
import { TOKENS } from "../../constants/tokens";
import { getReferralLink, getReferralTierConfig } from "../../lib/referral";

// Rebuild prompt section 4 — Referral Center. Real referral data already
// lives on the profile (useAuth.jsx reads referrals/{uid}) — referralCount,
// referralBadge, referralCommission, isLegacyFounder.
export default function ReferralPanel({ user }) {
  const [copied, setCopied] = useState(false);
  if (!user) return <div style={{ color: TOKENS.color.textMuted }}>Sign in to see your referral center.</div>;

  const link = getReferralLink(user.uid);
  const tier = user.referralBadge ? getReferralTierConfig(user.referralBadge) : null;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>REFERRAL CENTER</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>Invite & Earn</h1>
      </div>

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <Tile label="Active Referrals" value={user.referralCount ?? 0} />
        <Tile label="Commission Rate" value={`${Math.round((user.referralCommission ?? 0) * 100)}%`} />
        <Tile label="Badge" value={tier?.label ?? "None yet"} sub={tier?.subtitle} />
        {user.isLegacyFounder && <Tile label="Status" value="Legacy Founder" />}
      </div>

      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 10 }}>YOUR LINK</div>
      <div style={{ display: "flex", gap: 8 }}>
        <input readOnly value={link} style={{
          flex: 1, padding: "12px 14px", borderRadius: TOKENS.radius.pill, border: `1px solid ${TOKENS.color.border}`,
          background: TOKENS.color.surfaceRaised, color: TOKENS.color.starlight, fontSize: TOKENS.font.size.sm,
        }} />
        <button onClick={copyLink} style={{
          padding: "12px 24px", borderRadius: TOKENS.radius.pill, border: "none",
          background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, cursor: "pointer",
        }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 150, padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: TOKENS.font.size.xl, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
