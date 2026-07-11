import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLORS } from "../constants/colors";

const CEFR_COLOR = { A1:"#64748b", A2:"#3b82f6", B1:"#8b5cf6", B2:"#f59e0b", C1:"#e01010", C2:"#C9A84C" };
const CEFR_LABEL = { A1:"Starter", A2:"Elementary", B1:"Intermediate", B2:"Upper-Inter.", C1:"Advanced", C2:"Mastery" };

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{
      background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12,
      padding: "16px 14px", textAlign: "center", flex: 1,
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.text }}>{value}</div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ParentView() {
  const { uid } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) { setNotFound(true); setLoading(false); return; }
    getDoc(doc(db, "learnerProfiles", uid))
      .then(snap => {
        if (!snap.exists()) { setNotFound(true); }
        else { setProfile(snap.data()); }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [uid]);

  const base = {
    minHeight: "100vh",
    background: COLORS.bg,
    color: COLORS.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: "24px 16px",
    maxWidth: 480,
    margin: "0 auto",
  };

  if (loading) return (
    <div style={{ ...base, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 13, color: COLORS.textMuted }}>Loading…</div>
    </div>
  );

  if (notFound) return (
    <div style={{ ...base, textAlign: "center", paddingTop: 80 }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Report not found</div>
      <div style={{ fontSize: 13, color: COLORS.textMuted }}>This link may have expired or is invalid.</div>
    </div>
  );

  const name          = profile.name || "Your learner";
  const confidence    = profile.confidenceScore ?? 0;
  const cefr          = profile.cefr ?? null;
  const streak        = profile.streak ?? 0;
  const stars         = profile.stars ?? 0;
  const baselineScore = profile.baselineScore ?? null;
  const baselineCefr  = profile.baselineCefr ?? null;
  const todayXP       = profile.todayXP ?? profile.engagementScore ?? 0;
  const recentLessons = profile.recentLessons ?? [];
  const growth        = baselineScore != null ? confidence - baselineScore : null;
  const cefrColor     = CEFR_COLOR[cefr] ?? COLORS.textMuted;

  return (
    <div style={base}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          HearSeeDo OS
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{name}'s Progress</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>
          {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}
        </div>
      </div>

      {/* CEFR badge */}
      {cefr && (
        <div style={{
          textAlign: "center", marginBottom: 20,
          padding: "12px 20px", borderRadius: 12,
          background: `${cefrColor}18`, border: `1px solid ${cefrColor}44`,
        }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: cefrColor }}>{cefr}</div>
          <div style={{ fontSize: 12, color: cefrColor, marginTop: 2 }}>{CEFR_LABEL[cefr] ?? "English Level"}</div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <StatCard icon="💪" label="Confidence" value={confidence} sub="out of 100" />
        <StatCard icon="🔥" label="Streak" value={`${streak}d`} sub="days in a row" />
        <StatCard icon="⭐" label="Stars" value={stars} sub="earned total" />
      </div>

      {/* Today's activity */}
      <div style={{
        background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12,
        padding: "16px 18px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          Today's Practice
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: todayXP > 0 ? "#22c55e" : COLORS.textDim }}>
            {todayXP > 0 ? `+${todayXP}` : "—"}
          </div>
          <div>
            <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>
              {todayXP > 0 ? "XP earned today" : "No activity yet today"}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>
              {todayXP > 50 ? "Excellent session!" : todayXP > 0 ? "Good effort!" : "Encourage them to practise"}
            </div>
          </div>
        </div>
      </div>

      {/* Progress vs baseline */}
      {baselineScore != null && growth != null && (
        <div style={{
          background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12,
          padding: "16px 18px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            Overall Growth
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.textMuted }}>{baselineScore}</div>
              <div style={{ fontSize: 9, color: COLORS.textDim }}>START</div>
              {baselineCefr && <div style={{ fontSize: 9, color: CEFR_COLOR[baselineCefr] ?? COLORS.textDim }}>{baselineCefr}</div>}
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 16, marginBottom: 4 }}>→</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: growth >= 0 ? "#22c55e" : "#ef4444" }}>
                {growth >= 0 ? "+" : ""}{growth} pts
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: growth >= 0 ? "#22c55e" : COLORS.text }}>{confidence}</div>
              <div style={{ fontSize: 9, color: COLORS.textDim }}>NOW</div>
              {cefr && <div style={{ fontSize: 9, color: cefrColor }}>{cefr}</div>}
            </div>
          </div>
        </div>
      )}

      {/* Recent lessons */}
      {recentLessons.length > 0 && (
        <div style={{
          background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 12,
          padding: "16px 18px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
            Recent Lessons
          </div>
          {recentLessons.slice(0, 5).map((l, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 0", borderBottom: i < recentLessons.length - 1 ? "1px solid #1a1a1a" : "none",
            }}>
              <div style={{ fontSize: 12, color: COLORS.text }}>{l.app || "Practice"}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {l.xp && <div style={{ fontSize: 11, color: "#22c55e" }}>+{l.xp} XP</div>}
                <div style={{ fontSize: 10, color: COLORS.textDim }}>
                  {l.date ? new Date(l.date).toLocaleDateString("en-GB", { day:"numeric", month:"short" }) : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: "center", paddingTop: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 4 }}>
          Powered by HearSeeDo OS AI
        </div>
        <div style={{ fontSize: 10, color: "#333" }}>
          This is a private progress report. Please don't share this link.
        </div>
      </div>
    </div>
  );
}
