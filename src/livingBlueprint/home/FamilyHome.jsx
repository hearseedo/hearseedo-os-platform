import { useState } from "react";
import { TOKENS } from "../../constants/tokens";
import { useMobile } from "../../hooks/useMobile";
import { confidenceLabel } from "../../lib/confidenceEngine";
import { getTodaysRecommendation } from "./recommendation";

function timeAwareGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Rebuild prompt section 7 — Family Home: a shared constellation, not a
// leaderboard. Reads the real (denormalized) users/{uid}.familyMembers
// array — same data Achievements.jsx and claude.js already rely on.
export default function FamilyHome({ user }) {
  const isMobile = useMobile();
  const members = user?.familyMembers ?? [];
  const [selectedId, setSelectedId] = useState(members[0]?.id ?? null);
  const selected = members.find(m => m.id === selectedId) ?? null;

  const avgConfidence = members.length
    ? Math.round(members.reduce((sum, m) => sum + (m.confidenceScore ?? 0), 0) / members.length)
    : 0;

  const radius = 140;
  const angleFor = (i, n) => (2 * Math.PI * i) / n - Math.PI / 2;

  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textMuted }}>{timeAwareGreeting()}</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>{user?.name ? `${user.name}'s Family` : "Your Family"}</h1>
      </div>

      {members.length === 0 ? (
        <div style={{
          padding: 32, borderRadius: TOKENS.radius.lg, border: `1px dashed ${TOKENS.color.border}`,
          color: TOKENS.color.textMuted, textAlign: "center",
        }}>
          No family members yet. Add one from onboarding or Family Setup.
        </div>
      ) : isMobile ? (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, marginBottom: TOKENS.space[4] }}>
          {members.map(m => <MemberOrb key={m.id} member={m} selected={m.id === selectedId} onClick={() => setSelectedId(m.id)} />)}
        </div>
      ) : (
        <div style={{ position: "relative", height: 320, marginBottom: TOKENS.space[4] }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            <div style={{
              width: 70, height: 70, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              background: `radial-gradient(circle, ${TOKENS.color.goldGlow} 0%, ${TOKENS.color.surfaceRaised} 70%)`,
              border: `2px solid ${TOKENS.color.gold}`, boxShadow: TOKENS.shadow.glow, fontSize: 24,
            }}>
              ⌂
            </div>
          </div>
          {members.map((m, i) => {
            const angle = angleFor(i, members.length);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div key={m.id} style={{ position: "absolute", top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: "translate(-50%,-50%)" }}>
                <svg width={360} height={360} style={{ position: "absolute", top: -180, left: -180, pointerEvents: "none" }}>
                  <line x1={180} y1={180} x2={180 - x} y2={180 - y} stroke="rgba(201,168,76,0.2)" strokeWidth={1} />
                </svg>
                <MemberOrb member={m} selected={m.id === selectedId} onClick={() => setSelectedId(m.id)} />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", gap: TOKENS.space[3], marginBottom: TOKENS.space[5], flexWrap: "wrap" }}>
        <SummaryTile label="Family Progress" value={`${avgConfidence}%`} sub={confidenceLabel(avgConfidence)} />
        <SummaryTile label="Weekly Goal" value="3 sessions" sub="Not tracked yet" />
        <SummaryTile label="Family Streak" value={`${user?.streak ?? 0} days`} />
      </div>

      {selected && <MemberDetail member={selected} />}

      <FamilyChallengeCard />
    </div>
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
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 84, flexShrink: 0,
        background: "transparent", border: "none", cursor: "pointer", zIndex: 1, position: "relative",
      }}
    >
      <div style={{
        width: 54, height: 54, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: TOKENS.color.surfaceRaised, border: `2px solid ${selected ? TOKENS.color.gold : TOKENS.color.border}`,
        fontWeight: 700, boxShadow: selected ? TOKENS.shadow.glow : "none",
      }}>
        {member.name?.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ fontSize: TOKENS.font.size.xs, fontWeight: 600 }}>{member.name}</div>
      <div style={{ fontSize: 10, color: TOKENS.color.textDim }}>{member.confidenceScore ?? 0}% confidence</div>
    </button>
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
