import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { NAV_ITEMS } from "../constants/nav";
import { logout, awardXP } from "../lib/firebase";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { getLearnerProfile } from "../lib/learnerProfile";
import { generateRecommendations } from "../lib/recommendationEngine";
import { useSubscription } from "../hooks/useSubscription";
import AppOrbit from "../components/AppOrbit";
import AppModal from "../components/AppModal";
import AIChat from "../components/AIChat";
import WelcomeSequence from "../components/WelcomeSequence";
import ProgressBar from "../components/ProgressBar";
import ConfidenceRing from "../components/ConfidenceRing";
import LearningPath from "../components/LearningPath";
import Subscriptions from "../components/Subscriptions";
import AICoach from "../components/AICoach";
import Achievements from "../components/Achievements";
import Events from "../components/Events";

export default function Dashboard() {
  const { user }           = useAuth();
  const { defaultView }    = useSubscription();
  const navigate           = useNavigate();
  const [showWelcome, setShowWelcome] = useState(true);
  const [orbitView, setOrbitView]     = useState(defaultView());
  const [selectedApp, setSelectedApp] = useState(null);
  const [activeNav, setActiveNav]     = useState("home");

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <>
      {showWelcome && (
        <WelcomeSequence user={user} onComplete={() => setShowWelcome(false)} />
      )}

      <div style={{
        minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", color: COLORS.text,
        animation: showWelcome ? "none" : "dashZoomIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
      }}>
        <style>{`@keyframes dashZoomIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>

        {/* TOP NAV */}
        <header style={{
          height: 60, background: COLORS.surface,
          borderBottom: "1px solid #1e1e1e",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 16,
          position: "sticky", top: 0, zIndex: 50, flexShrink: 0,
        }}>
          <BrandMark />
          <div style={{ flex: 1, paddingLeft: 8 }}>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{greeting},</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{firstName}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Stat emoji="🔥" value={user?.streak ?? 0} label="Day Streak" />
            <Divider />
            <Stat emoji="💎" value={(user?.xpEarned ?? 0).toLocaleString()} label="HSD Points" />
            <Divider />
            <NotificationBell count={0} />
            <UserAvatar name={firstName} />
            <button
              onClick={logout}
              style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#e01010"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2a2a2a"}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* BODY */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* SIDEBAR */}
          <aside style={{ width: 220, background: COLORS.surface, borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ padding: "14px 16px 8px", fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>
              Quick Launch
            </div>
            <nav style={{ flex: 1, padding: "4px 8px" }}>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "community") {
                      window.open("https://discord.gg/bXTF9B4X", "_blank", "noreferrer");
                      return;
                    }
                    if (item.id === "upgrade") {
                      navigate("/plans");
                      return;
                    }
                    setActiveNav(item.id);
                  }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 8px",
                    background: item.highlight ? "rgba(224,16,16,0.12)" : activeNav === item.id ? "rgba(224,16,16,0.15)" : "none",
                    border: item.highlight ? "1px solid rgba(224,16,16,0.3)" : "none",
                    borderRadius: 8,
                    color: item.highlight ? COLORS.red : activeNav === item.id ? COLORS.red : COLORS.textMuted,
                    fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                    textAlign: "left", marginBottom: 2,
                    fontWeight: item.highlight ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (activeNav !== item.id) e.currentTarget.style.background = "#1a1a1a"; }}
                  onMouseLeave={(e) => { if (activeNav !== item.id) e.currentTarget.style.background = "none"; }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontWeight: activeNav === item.id ? 600 : 400 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ marginLeft: "auto", background: COLORS.red, color: "#fff", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Founding member block */}
            <div style={{ margin: 8, padding: 14, background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.gold, letterSpacing: 1, marginBottom: 6 }}>👑 FOUNDING MEMBER</div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                Share your link and grow your community. <span style={{ color: COLORS.gold, fontWeight: 600 }}>Commission unlocks at Founder status</span> (25 active paying referrals).
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>Referral Tiers</div>
              {[
                { n: "0–24",  label: "Member",     pct: null,    icon: "⬜" },
                { n: "25–49", label: "Founder",    pct: "5%",    icon: "🥉" },
                { n: "50–99", label: "Ambassador", pct: "6%",    icon: "🥈" },
                { n: "100–199", label: "Pioneer",  pct: "7%",    icon: "🥇" },
                { n: "200+",  label: "Visionary",  pct: "Custom",icon: "👑" },
              ].map((t) => (
                <div key={t.n} style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{t.icon}</span>
                  <span style={{ flex: 1 }}>{t.n} → <span style={{ color: COLORS.text }}>{t.label}</span></span>
                  {t.pct && <span style={{ color: COLORS.gold, fontWeight: 600 }}>{t.pct}</span>}
                </div>
              ))}
              <ReferralButton user={user} />
            </div>
          </aside>

          {/* MAIN */}
          <main style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {activeNav === "subscriptions" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                  <button onClick={() => setActiveNav("home")} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>← Back</button>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>My Subscriptions</div>
                </div>
                <Subscriptions user={user} />
              </div>
            ) : activeNav === "learning" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title="Learning Path" onBack={() => setActiveNav("home")} />
                <LearningPath user={user} />
              </div>
            ) : activeNav === "coach" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title="AI Coach" onBack={() => setActiveNav("home")} />
                <AICoach user={user} />
              </div>
            ) : activeNav === "achievements" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title="Achievements" onBack={() => setActiveNav("home")} />
                <Achievements user={user} />
              </div>
            ) : activeNav === "events" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title="Events" onBack={() => setActiveNav("home")} />
                <Events user={user} />
              </div>
            ) : activeNav === "settings" ? (
              <SettingsView user={user} onBack={() => setActiveNav("home")} />
            ) : (
              <>
                {/* Orbit card */}
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 50% 50%, rgba(224,16,16,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
                  <AppOrbit view={orbitView} onViewChange={setOrbitView} onAppClick={setSelectedApp} />
                </div>

                {/* HSD AI Chat */}
                <AIChat />
              </>
            )}
          </main>

          {/* RIGHT PANEL */}
          <aside style={{ width: 280, background: COLORS.surface, borderLeft: "1px solid #1e1e1e", padding: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flexShrink: 0 }}>
            <MissionsCard user={user} />
            <RecommendationsCard user={user} />
            <ConfidenceCard user={user} />
            <ProgressCard user={user} />
            <FamilyCard user={user} />
          </aside>
        </div>
      </div>

      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} />
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 190 }}>
      <img
        src="/assets/logo.png"
        alt="HSD OS AI"
        style={{
          width: 36, height: 36, borderRadius: 8, objectFit: "cover",
          filter: "drop-shadow(0 0 6px rgba(224,16,16,0.5))",
        }}
      />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e01010", letterSpacing: 2 }}>HEAR SEE DO™</div>
        <div style={{ fontSize: 9, color: "#888", letterSpacing: 2 }}>OS AI</div>
      </div>
    </div>
  );
}

function Stat({ emoji, value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#e01010" }}>{emoji} {value}</div>
      <div style={{ fontSize: 10, color: "#888" }}>{label}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 30, background: "#2a2a2a" }} />;
}

function NotificationBell({ count }) {
  return (
    <div style={{ position: "relative", cursor: "pointer" }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      {count > 0 && (
        <div style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#e01010", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          {count}
        </div>
      )}
    </div>
  );
}

function UserAvatar({ name }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #8b0000, #e01010)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "2px solid #e01010" }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{children}</div>;
}

const DAILY_MISSIONS = [
  { id: "chat",    label: "Send 3 AI messages",  icon: "🤖", total: 3,  xp: 30  },
  { id: "streak",  label: "Maintain your streak", icon: "🔥", total: 1,  xp: 20  },
  { id: "lesson",  label: "Complete 1 lesson",    icon: "📖", total: 1,  xp: 50  },
];

function MissionsCard({ user }) {
  const todayJST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const [missions, setMissions] = useState(null);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        setMissions(snap.data().missions);
      } else {
        const initial = DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false }));
        setMissions(initial);
        setDoc(ref, { missions: initial, date: todayJST, createdAt: serverTimestamp() }).catch(() => {});
      }
    }).catch(() => {
      setMissions(DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false })));
    });
  }, [user?.uid]);

  async function completeMission(idx) {
    if (!user?.uid || missions[idx].done) return;
    setCompleting(idx);
    const updated = missions.map((m, i) => i === idx ? { ...m, current: m.total, done: true } : m);
    setMissions(updated);
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    await setDoc(ref, { missions: updated, date: todayJST }, { merge: true });
    await awardXP(user.uid, missions[idx].xp);
    setCompleting(null);
  }

  const display = missions ?? DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false }));
  const streakMission = display.find(m => m.id === "streak");
  if (streakMission && !streakMission.done && (user?.streak ?? 0) > 0) {
    // Auto-complete streak mission if user has a streak
    const idx = display.findIndex(m => m.id === "streak");
    if (idx >= 0 && !display[idx].done && missions) {
      completeMission(idx);
    }
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>Today's Missions</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {display.map((m, i) => (
          <div key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ fontSize: 12, color: m.done ? COLORS.success : COLORS.text, textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
              </div>
              {m.done
                ? <span style={{ fontSize: 10, color: COLORS.success, fontWeight: 700 }}>+{m.xp} XP ✓</span>
                : <button onClick={() => completeMission(i)} disabled={completing === i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "transparent", border: `1px solid #2a2a2a`, color: COLORS.textMuted, cursor: "pointer" }}>
                    {completing === i ? "…" : "Done"}
                  </button>
              }
            </div>
            <ProgressBar current={m.done ? m.total : m.current} total={m.total} color={m.done ? COLORS.success : COLORS.red} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsCard({ user }) {
  const [recs, setRecs] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    getLearnerProfile(user.uid).then(profile => {
      const r = generateRecommendations(user, profile);
      setRecs(r);
    }).catch(() => {});
  }, [user?.uid]);

  if (!recs) return null;

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>Jona Recommends</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <RecItem icon="📚" label="Today's Lesson" text={recs.lesson} />
        <RecItem icon="⚡" label="Challenge" text={recs.challenge} />
        <RecItem icon="💬" label="Conversation Topic" text={recs.topic} />
      </div>
    </div>
  );
}

function RecItem({ icon, label, text }) {
  return (
    <div style={{ padding: "10px 12px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a" }}>
      <div style={{ fontSize: 10, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function ConfidenceCard({ user }) {
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>Confidence Score</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ConfidenceRing score={user?.confidenceScore ?? 0} />
        <div>
          <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>Keep it up!</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.4 }}>You're improving every day.</div>
          <button style={{ marginTop: 10, padding: "7px 12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}>
            View Insights
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ user }) {
  const stats = [
    { label: "Hours Learned",   value: user?.hoursLearned ?? 0,   icon: "⏰" },
    { label: "Lessons Done",    value: user?.lessonsCompleted ?? 0, icon: "✅" },
    { label: "XP Earned",      value: (user?.xpEarned ?? 0).toLocaleString(), icon: "⭐" },
  ];
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>Your Progress</SectionTitle>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilyCard({ user }) {
  const members = user?.familyMembers ?? [];
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>Family Progress</SectionTitle>
      {members.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", padding: "12px 0" }}>No family members added yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {members.map((m) => (
            <div key={m.name}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#4a0000,#8b0000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {m.name?.[0]}
                  </div>
                  <span style={{ fontSize: 13 }}>{m.name}</span>
                </div>
                <span style={{ fontSize: 12, color: COLORS.textMuted }}>{m.progress ?? 0}%</span>
              </div>
              <ProgressBar current={m.progress ?? 0} total={100} />
            </div>
          ))}
        </div>
      )}
      <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.red, fontSize: 12, cursor: "pointer", padding: "10px 0 0" }}>
        👤 + Add Family Member
      </button>
    </div>
  );
}

function ReferralButton({ user }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const base = window.location.origin;
    const code = user?.uid?.slice(0, 8) ?? "hsd";
    const link = `${base}/?ref=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy your referral link:", link);
    }
  }

  return (
    <button
      onClick={copyLink}
      style={{ width: "100%", padding: 8, background: copied ? "rgba(34,197,94,0.1)" : "transparent", border: `1px solid ${copied ? "#22c55e" : "#e01010"}`, borderRadius: 6, color: copied ? "#22c55e" : COLORS.red, fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 8, transition: "all 0.2s" }}
    >
      {copied ? "✓ Copied!" : "🔗 Copy Referral Link"}
    </button>
  );
}

function BackBar({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>← Back</button>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

function SettingsView({ user, onBack }) {
  const [name, setName]         = useState(user?.name ?? "");
  const [saved, setSaved]       = useState(false);
  const [saving, setSaving]     = useState(false);

  async function saveProfile() {
    if (!user?.uid || !name.trim()) return;
    setSaving(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc((await import("../lib/firebase")).db, "users", user.uid), { name: name.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 28 }}>
      <BackBar title="Settings" onBack={onBack} />

      <Section label="Profile">
        <Field label="Display Name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }}
          />
        </Field>
        <Field label="Email">
          <div style={{ padding: "10px 14px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, color: COLORS.textMuted, fontSize: 14 }}>{user?.email}</div>
        </Field>
        <button onClick={saveProfile} disabled={saving} style={{ marginTop: 8, padding: "10px 24px", background: COLORS.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {saved ? "✓ Saved" : saving ? "Saving…" : "Save Changes"}
        </button>
      </Section>

      <Section label="Your Referral Link">
        <div style={{ padding: "12px 16px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 13, color: COLORS.textMuted, fontFamily: "monospace", wordBreak: "break-all" }}>
          {`${window.location.origin}/?ref=${user?.uid?.slice(0, 8) ?? "hsd"}`}
        </div>
        <ReferralButton user={user} />
        <div style={{ marginTop: 16, padding: 14, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.textDim, marginBottom: 10, textTransform: "uppercase" }}>Commission Tiers — Active Paying Referrals</div>
          {[
            { range: "0–24",   badge: "Member",     pct: "No commission yet" },
            { range: "25–49",  badge: "Founder",    pct: "5% recurring" },
            { range: "50–99",  badge: "Ambassador", pct: "6% recurring" },
            { range: "100–199",badge: "Pioneer",    pct: "7% recurring" },
            { range: "200+",   badge: "Visionary",  pct: "Custom partnership" },
          ].map((t) => (
            <div key={t.range} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.textDim, marginBottom: 5 }}>
              <span><span style={{ color: COLORS.text, fontWeight: 600 }}>{t.badge}</span> ({t.range} refs)</span>
              <span style={{ color: COLORS.gold }}>{t.pct}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, borderTop: "1px solid #1e1e1e", paddingTop: 10 }}>
            "Active paying referrals" = registered + active paid subscription + not cancelled, refunded, or suspended. Free and trial users do not count. Your badge and commission rate update automatically as your active count changes.
          </div>
        </div>
      </Section>

      <Section label="Account">
        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
          <div>Plan: <strong style={{ color: COLORS.text }}>{user?.plan ?? "Free"}</strong></div>
          <div>Member since: <strong style={{ color: COLORS.text }}>{user?.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString("en-GB") : "—"}</strong></div>
          <div>Streak: <strong style={{ color: COLORS.text }}>🔥 {user?.streak ?? 0} days</strong></div>
          <div>Total XP: <strong style={{ color: COLORS.gold }}>⭐ {(user?.xpEarned ?? 0).toLocaleString()}</strong></div>
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
