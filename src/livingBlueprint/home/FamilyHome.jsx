import { useState } from "react";
import { TOKENS } from "../../constants/tokens";
import { confidenceLabel } from "../../lib/confidenceEngine";
import { getTodaysRecommendation } from "./recommendation";
import Leaderboard from "../../components/Leaderboard";

// Confidence color scale — reused for both the ring around each member's
// orb and their badge, so the color always means the same thing.
function confidenceColor(score) {
  if (score >= 70) return TOKENS.color.gold;
  if (score >= 40) return TOKENS.worldAccent["global-ready"];
  return TOKENS.color.textMuted;
}

function timeAwareGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Rebuild prompt section 7 — Family Home: a shared constellation, not a
// competitive ranking. Reads the real (denormalized) users/{uid}.familyMembers
// array — same data Achievements.jsx and claude.js already rely on. The
// site-wide Leaderboard lives at the bottom of this page (see below).
export default function FamilyHome({ user }) {
  const members = user?.familyMembers ?? [];
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? null);
  const selected = members.find(m => m.id === selectedId) ?? null;

  const avgConfidence = members.length
    ? Math.round(members.reduce((sum, m) => sum + (m.confidenceScore ?? 0), 0) / members.length)
    : 0;

  return (
    <div>
      <JonaFamilyBanner greeting={timeAwareGreeting()} familyName={user?.name ? `${user.name}'s Family` : "Your Family"} />

      {members.length === 0 ? (
        <div style={{
          padding: 32, borderRadius: TOKENS.radius.lg, border: `1px dashed ${TOKENS.color.border}`,
          color: TOKENS.color.textMuted, textAlign: "center",
        }}>
          No family members yet. Add one from onboarding or Family Setup.
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", paddingBottom: 8 }}>
            <HouseholdNode />
            {members.map(m => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                <PathSegment />
                <MemberOrb member={m} selected={m.id === selectedId} onClick={() => setSelectedId(m.id)} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: TOKENS.color.textDim, marginBottom: TOKENS.space[4] }}>
            The path connects your household to each family member — click a member to see their details below.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <SummaryTile label="Family Progress" value={`${avgConfidence}%`} sub={confidenceLabel(avgConfidence)} />
        <SummaryTile label="Weekly Goal" value="3 sessions" sub="Not tracked yet" />
        <SummaryTile label="Family Streak" value={`${user?.streak ?? 0} days`} />
      </div>

      {selected && <MemberDetail member={selected} />}

      <FamilyChallengeCard />

      <div style={{ marginTop: TOKENS.space[5] }}>
        {/* Was only reachable from the old Dashboard.jsx — became unreachable
            once /dashboard started rendering this Living Blueprint experience
            instead. Reused as-is (real Firestore XP rankings), not restyled. */}
        <Leaderboard currentUid={user?.uid} />
      </div>
    </div>
  );
}

// Large torso-up Jona over the family-hero art, with a slight talking bob —
// CSS animation on the already-transparent pose-talking.png, not a
// composited/layered mouth swap (no alignment data for that). Respects
// prefers-reduced-motion.
function JonaFamilyBanner({ greeting, familyName }) {
  return (
    <div style={{
      position: "relative", borderRadius: TOKENS.radius.xl, overflow: "hidden",
      border: `1px solid ${TOKENS.color.border}`, marginBottom: TOKENS.space[5],
      minHeight: 240, display: "flex", alignItems: "flex-end",
    }}>
      <style>{`
        @keyframes jonaTalkBob {
          0%,100% { transform: translateX(-50%) translateY(0) scale(1); }
          50%     { transform: translateX(-50%) translateY(-4px) scale(1.015); }
        }
        .jona-family-talk { animation: jonaTalkBob 2.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .jona-family-talk { animation: none; } }
      `}</style>
      <img src="/assets/worlds/family-hero.jpg" alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(5,6,8,0.92) 0%, rgba(5,6,8,0.55) 45%, rgba(5,6,8,0.15) 100%)" }} />

      <div style={{ position: "relative", padding: TOKENS.space[5], display: "flex", alignItems: "flex-end", justifyContent: "space-between", width: "100%", gap: TOKENS.space[4] }}>
        <div>
          <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, marginBottom: 4 }}>{greeting}</div>
          <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800, marginBottom: 6 }}>{familyName}</h1>
          <div style={{ fontSize: TOKENS.font.size.sm, color: TOKENS.color.textMuted, maxWidth: 320 }}>
            "Hi, I'm Jona — here's how everyone's doing today."
          </div>
        </div>

        <div style={{ width: 260, height: 320, overflow: "hidden", position: "relative", flexShrink: 0, marginBottom: -32 }}>
          <img
            src="/assets/jona/pose-talking.png"
            alt="Jona"
            className="jona-family-talk"
            style={{
              position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
              width: 388, height: "auto",
              filter: "drop-shadow(0 12px 24px rgba(0,0,0,0.5))",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Horizontal path layout — was a radial constellation, which read as "two
// unclear circles with a faint unlabeled line" per user feedback. A single
// household-to-member path, left to right, is simpler to read and scrolls
// naturally on mobile without a separate layout.
function HouseholdNode() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
      <div style={{
        width: 70, height: 70, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle, ${TOKENS.color.goldGlow} 0%, ${TOKENS.color.surfaceRaised} 70%)`,
        border: `2px solid ${TOKENS.color.gold}`, boxShadow: TOKENS.shadow.glow, fontSize: 24,
      }}>
        ⌂
      </div>
      <div style={{ fontSize: 10, color: TOKENS.color.gold, fontWeight: 700, letterSpacing: 0.5 }}>HOUSEHOLD</div>
    </div>
  );
}

function PathSegment() {
  return (
    <div style={{ width: 40, height: 0, borderTop: `2px dashed ${TOKENS.color.gold}`, opacity: 0.35, flexShrink: 0, marginBottom: 20 }} />
  );
}

function SummaryTile({ label, value, sub }) {
  return (
    <div style={{ flex: 1, minWidth: 140, padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: TOKENS.font.size.xl, fontWeight: 800 }}>{value}</div>
      {sub && <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MemberOrb({ member, selected, onClick }) {
  const score = member.confidenceScore ?? 0;
  const color = confidenceColor(score);
  const r = 27, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 84, flexShrink: 0,
        background: "transparent", border: "none", cursor: "pointer", zIndex: 1, position: "relative",
      }}
    >
      <div style={{ position: "relative", width: 60, height: 60 }}>
        <svg width={60} height={60} viewBox="0 0 60 60" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={30} cy={30} r={r} fill="none" stroke={TOKENS.color.border} strokeWidth={3} />
          <circle
            cx={30} cy={30} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 3, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: TOKENS.color.surfaceRaised, border: `1px solid ${selected ? TOKENS.color.gold : "transparent"}`,
          fontWeight: 700, boxShadow: selected ? TOKENS.shadow.glow : "none",
        }}>
          {member.name?.slice(0, 1).toUpperCase()}
        </div>
      </div>
      <div style={{ fontSize: TOKENS.font.size.xs, fontWeight: 600 }}>{member.name}</div>
      <ConfidenceBadge score={score} color={color} />
    </button>
  );
}

// The "confidence badge" — a compact chip, not a fabricated icon asset (no
// dedicated confidence-badge art exists anywhere in the visuals folder).
// Color + label are real, derived from the same confidenceScore/
// confidenceLabel used throughout the rest of the app.
function ConfidenceBadge({ score, color }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: `${color}18`,
      border: `1px solid ${color}40`, borderRadius: TOKENS.radius.pill, padding: "2px 8px",
    }}>
      {confidenceLabel(score)}
    </span>
  );
}

function MemberDetail({ member }) {
  const { world, lesson } = getTodaysRecommendation({ confidenceScore: member.confidenceScore ?? 50 });
  return (
    <div style={{
      padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`,
      background: TOKENS.color.surfaceRaised, marginBottom: TOKENS.space[5],
    }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 8 }}>{member.name?.toUpperCase()}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <DetailField label="Today's Mission" value={lesson} />
        <DetailField label="Current World" value={world.name} />
        <DetailField label="Confidence" value={`${member.confidenceScore ?? 0}%`} />
        <DetailField label="Recent Activity" value="No recent activity yet." />
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: TOKENS.color.textDim, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: TOKENS.font.size.sm, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function FamilyChallengeCard() {
  return (
    <div style={{
      padding: TOKENS.space[4], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.goldDim}`,
      background: "rgba(201,168,76,0.06)",
    }}>
      <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 6 }}>FAMILY CHALLENGE · SAMPLE</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>7-Day Speaking Streak</div>
      <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted, marginBottom: 10 }}>
        Everyone in the family completes one speaking session each day this week.
      </div>
      <div style={{ height: 4, borderRadius: TOKENS.radius.pill, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: "0%", background: TOKENS.color.gold }} />
      </div>
      <div style={{ fontSize: 10, color: TOKENS.color.textDim, marginTop: 6 }}>
        Not started — real family-challenge tracking isn't wired up yet.
      </div>
    </div>
  );
}
