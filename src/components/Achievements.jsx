import { useState } from "react";
import { COLORS } from "../constants/colors";

const ACHIEVEMENTS = [
  { id: "streak_3",   category: "streak",     title: "On a Roll",          desc: "3-day streak",           icon: "🔥", xp: 50,   check: (u) => (u.streak ?? 0) >= 3   },
  { id: "streak_7",   category: "streak",     title: "Week Warrior",       desc: "7-day streak",           icon: "🔥", xp: 150,  check: (u) => (u.streak ?? 0) >= 7   },
  { id: "streak_30",  category: "streak",     title: "Monthly Master",     desc: "30-day streak",          icon: "🔥", xp: 500,  check: (u) => (u.streak ?? 0) >= 30  },
  { id: "streak_100", category: "streak",     title: "Legend",             desc: "100-day streak",         icon: "🔥", xp: 2000, check: (u) => (u.streak ?? 0) >= 100 },
  { id: "xp_100",     category: "xp",         title: "First Steps",        desc: "Earn 100 XP",            icon: "⭐", xp: 25,   check: (u) => (u.xpEarned ?? 0) >= 100   },
  { id: "xp_500",     category: "xp",         title: "Getting Serious",    desc: "Earn 500 XP",            icon: "⭐", xp: 75,   check: (u) => (u.xpEarned ?? 0) >= 500   },
  { id: "xp_1000",    category: "xp",         title: "Power Learner",      desc: "Earn 1,000 XP",          icon: "⭐", xp: 200,  check: (u) => (u.xpEarned ?? 0) >= 1000  },
  { id: "xp_5000",    category: "xp",         title: "XP Champion",        desc: "Earn 5,000 XP",          icon: "⭐", xp: 750,  check: (u) => (u.xpEarned ?? 0) >= 5000  },
  { id: "conf_25",    category: "confidence", title: "Building Up",        desc: "Reach 25% confidence",   icon: "💪", xp: 50,   check: (u) => (u.confidenceScore ?? 0) >= 25  },
  { id: "conf_50",    category: "confidence", title: "Half Way There",     desc: "Reach 50% confidence",   icon: "💪", xp: 150,  check: (u) => (u.confidenceScore ?? 0) >= 50  },
  { id: "conf_75",    category: "confidence", title: "Highly Confident",   desc: "Reach 75% confidence",   icon: "💪", xp: 300,  check: (u) => (u.confidenceScore ?? 0) >= 75  },
  { id: "conf_100",   category: "confidence", title: "Unstoppable",        desc: "Reach 100% confidence",  icon: "💪", xp: 1000, check: (u) => (u.confidenceScore ?? 0) >= 100 },
  { id: "app_first",  category: "apps",       title: "First Launch",       desc: "Unlock your first app",  icon: "📱", xp: 50,   check: (u) => (u.subscriptions ?? []).length >= 1 },
  { id: "app_three",  category: "apps",       title: "App Explorer",       desc: "Unlock 3 apps",          icon: "📱", xp: 200,  check: (u) => (u.subscriptions ?? []).length >= 3 },
  { id: "app_all",    category: "apps",       title: "Full Access",        desc: "Unlock all 7 apps",      icon: "📱", xp: 1000, check: (u) => (u.subscriptions ?? []).length >= 7 },
  { id: "lesson_1",   category: "lessons",    title: "First Lesson",       desc: "Complete 1 lesson",      icon: "📖", xp: 25,   check: (u) => (u.lessonsCompleted ?? 0) >= 1   },
  { id: "lesson_10",  category: "lessons",    title: "Study Habit",        desc: "Complete 10 lessons",    icon: "📖", xp: 100,  check: (u) => (u.lessonsCompleted ?? 0) >= 10  },
  { id: "lesson_50",  category: "lessons",    title: "Dedicated Learner",  desc: "Complete 50 lessons",    icon: "📖", xp: 400,  check: (u) => (u.lessonsCompleted ?? 0) >= 50  },
  { id: "lesson_100", category: "lessons",    title: "100 Club",           desc: "Complete 100 lessons",   icon: "📖", xp: 1000, check: (u) => (u.lessonsCompleted ?? 0) >= 100 },
  { id: "family_add", category: "special",    title: "Family First",       desc: "Add a family member",    icon: "👨‍👩‍👧", xp: 100,  check: (u) => (u.familyMembers ?? []).length >= 1 },
  { id: "all_access", category: "special",    title: "All Access Member",  desc: "Upgrade to All Access",  icon: "👑", xp: 500,  check: (u) => u.plan === "all_access"   },
  { id: "founding",   category: "special",    title: "Founding Member",    desc: "Joined in the first wave", icon: "🌟", xp: 2000, check: (u) => !!u.isFoundingMember  },
];

const CATEGORIES = [
  { id: "all",        label: "All"        },
  { id: "streak",     label: "Streaks"    },
  { id: "xp",         label: "XP"         },
  { id: "confidence", label: "Confidence" },
  { id: "apps",       label: "Apps"       },
  { id: "lessons",    label: "Lessons"    },
  { id: "special",    label: "Special"    },
];

const CAT_COLOR = {
  streak: COLORS.red, xp: COLORS.gold, confidence: "#4488ff",
  apps: COLORS.success, lessons: "#7B5EA7", special: "#ff6b35",
};

export default function Achievements({ user }) {
  const [filter, setFilter] = useState("all");
  const u = user ?? {};

  const earned = ACHIEVEMENTS.filter((a) => a.check(u));
  const locked = ACHIEVEMENTS.filter((a) => !a.check(u));
  const visible = (list) => filter === "all" ? list : list.filter((a) => a.category === filter);
  const totalXP = earned.reduce((s, a) => s + a.xp, 0);
  const pct     = Math.round((earned.length / ACHIEVEMENTS.length) * 100);

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Badges Earned" value={`${earned.length} / ${ACHIEVEMENTS.length}`} color={COLORS.gold}    />
        <StatCard label="Bonus XP"      value={`+${totalXP.toLocaleString()}`}              color={COLORS.red}     />
        <StatCard label="Completion"    value={`${pct}%`}                                   color={COLORS.success} />
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${COLORS.red}, ${COLORS.gold})`, borderRadius: 3, transition: "width 1s ease" }} />
        </div>
        <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 4 }}>{earned.length} of {ACHIEVEMENTS.length} achievements unlocked</div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {CATEGORIES.map((c) => {
          const active = filter === c.id;
          const color  = CAT_COLOR[c.id] ?? COLORS.red;
          return (
            <button key={c.id} onClick={() => setFilter(c.id)} style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: active ? 700 : 400,
              background: active ? color : "transparent",
              border: `1px solid ${active ? color : "#2a2a2a"}`,
              color: active ? "#fff" : COLORS.textMuted,
              cursor: "pointer", transition: "all 0.15s",
            }}>{c.label}</button>
          );
        })}
      </div>

      {/* Earned */}
      {visible(earned).length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.success, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            ✓ Earned ({visible(earned).length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 10 }}>
            {visible(earned).map((a) => <Badge key={a.id} a={a} earned />)}
          </div>
        </div>
      )}

      {/* Locked */}
      {visible(locked).length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>
            Locked ({visible(locked).length})
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px,1fr))", gap: 10 }}>
            {visible(locked).map((a) => <Badge key={a.id} a={a} earned={false} />)}
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function Badge({ a, earned }) {
  const color = CAT_COLOR[a.category] ?? COLORS.red;
  return (
    <div style={{
      background: earned ? `${color}0d` : COLORS.card,
      border: `1px solid ${earned ? color + "44" : "#1e1e1e"}`,
      borderRadius: 12, padding: "14px 16px",
      opacity: earned ? 1 : 0.45, transition: "all 0.2s",
    }}>
      <div style={{ fontSize: 30, marginBottom: 8, filter: earned ? "none" : "grayscale(1) brightness(0.5)" }}>{a.icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: earned ? COLORS.text : COLORS.textMuted, marginBottom: 3 }}>{a.title}</div>
      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 8, lineHeight: 1.4 }}>{a.desc}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: earned ? color : "#333" }}>+{a.xp} XP</div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 3 }}>{label}</div>
    </div>
  );
}
