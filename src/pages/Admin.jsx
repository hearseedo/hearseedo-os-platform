import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db, logout } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { COLORS } from "../constants/colors";
import { APPS } from "../constants/apps";
import { PLANS } from "../constants/plans";
import { APP_REGISTRY } from "../constants/appRegistry";
import { confidenceLabel, trendIcon } from "../lib/confidenceEngine";

const TABS = [
  { id: "overview",      label: "Overview",       icon: "📊" },
  { id: "intelligence",  label: "Intelligence",   icon: "🧠" },
  { id: "users",         label: "Users",          icon: "👥" },
  { id: "apps",          label: "App Registry",   icon: "📱" },
  { id: "revenue",       label: "Revenue",        icon: "💳" },
  { id: "settings",      label: "Settings",       icon: "⚙️" },
];

const MRR_MAP = {
  phonics: 833, eiken: 1258, sipswitch: 1088, speak: 1020, innerkey: 1258,
  kids_starter: 2480, english_boost: 2108, adult_growth: 1853,
  family_full: 2858, adult_complete: 2873, all_access: 4680,
};

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate          = useNavigate();
  const [tab, setTab]     = useState("overview");
  const [users, setUsers] = useState([]);
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (user === null || (user && !isAdmin)) navigate("/", { replace: true });
  }, [user, isAdmin]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [userSnap, platformSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDoc(doc(db, "analytics", "platform")),
        ]);
        setUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        if (platformSnap.exists()) setPlatform(platformSnap.data());
      } catch (e) { console.error("Admin fetch:", e); }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleLogout = async () => { await logout(); navigate("/", { replace: true }); };

  if (!user || !isAdmin) return null;

  const totalUsers     = users.length;
  const paidUsers      = users.filter(u => u.plan && u.plan !== "free" && u.planStatus === "active").length;
  const freeUsers      = users.filter(u => !u.plan || u.plan === "free").length;
  const allAccessUsers = users.filter(u => u.plan === "all_access").length;
  const mrr            = users.reduce((s, u) => s + (MRR_MAP[u.plan] ?? 0), 0);
  const planCounts     = users.reduce((acc, u) => { acc[u.plan ?? "free"] = (acc[u.plan ?? "free"] || 0) + 1; return acc; }, {});
  const avgConfidence  = users.length ? Math.round(users.reduce((s, u) => s + (u.confidenceScore ?? 50), 0) / users.length) : 0;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      <header style={{ height: 56, background: "#0d0000", borderBottom: "1px solid rgba(224,16,16,0.25)", display: "flex", alignItems: "center", padding: "0 24px", gap: 14, position: "sticky", top: 0, zIndex: 50, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.red, boxShadow: "0 0 8px #e01010", animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 3, textTransform: "uppercase" }}>HSD OS Command Center</span>
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>{user.email}</span>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "5px 14px", background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}>
          ← Dashboard
        </button>
        <button onClick={handleLogout} style={{ padding: "5px 14px", background: "none", border: `1px solid rgba(224,16,16,0.4)`, borderRadius: 6, color: COLORS.red, fontSize: 12, cursor: "pointer" }}>
          Sign out
        </button>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        <aside style={{ width: 210, background: COLORS.surface, borderRight: "1px solid #1e1e1e", padding: "16px 8px", flexShrink: 0, overflowY: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, marginBottom: 2,
              background: tab === t.id ? "rgba(224,16,16,0.15)" : "none", border: "none",
              color: tab === t.id ? COLORS.red : COLORS.textMuted,
              fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}

          <div style={{ margin: "20px 8px 0", padding: 12, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 8, letterSpacing: 1 }}>LIVE STATS</div>
            <Stat label="Users"        value={loading ? "…" : totalUsers} />
            <Stat label="Paid"         value={loading ? "…" : paidUsers} color={COLORS.success} />
            <Stat label="All Access"   value={loading ? "…" : allAccessUsers} color={COLORS.gold} />
            <Stat label="Est. MRR"     value={loading ? "…" : `¥${mrr.toLocaleString()}`} color={COLORS.red} />
            <Stat label="AI Msgs"      value={loading ? "…" : (platform?.totalAIMessages ?? 0).toLocaleString()} color="#4488ff" />
            <Stat label="Avg Confidence" value={loading ? "…" : `${avgConfidence}%`} color="#a855f7" />
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {tab === "overview"     && <OverviewTab     users={users} planCounts={planCounts} platform={platform} loading={loading} mrr={mrr} paidUsers={paidUsers} avgConfidence={avgConfidence} />}
          {tab === "intelligence" && <IntelligenceTab users={users} platform={platform} loading={loading} avgConfidence={avgConfidence} />}
          {tab === "users"        && <UsersTab        users={users} loading={loading} setUsers={setUsers} />}
          {tab === "apps"         && <AppsTab         users={users} />}
          {tab === "revenue"      && <RevenueTab      users={users} planCounts={planCounts} mrr={mrr} />}
          {tab === "settings"     && <SettingsTab />}
        </main>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 8px rgba(224,16,16,0.6)} 50%{opacity:0.7;box-shadow:0 0 16px rgba(224,16,16,0.9)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────────

function OverviewTab({ users, planCounts, platform, loading, mrr, paidUsers, avgConfidence }) {
  const freeUsers  = users.filter(u => !u.plan || u.plan === "free").length;
  const avgStreak  = users.length ? Math.round(users.reduce((s, u) => s + (u.streak ?? 0), 0) / users.length) : 0;
  const totalAI    = platform?.totalAIMessages ?? 0;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Platform Overview</PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Users"    value={loading ? "—" : users.length}       color={COLORS.red} />
        <StatCard label="Paid Users"     value={loading ? "—" : paidUsers}           color={COLORS.success} sub="active subscriptions" />
        <StatCard label="Est. MRR"       value={loading ? "—" : `¥${mrr.toLocaleString()}`} color={COLORS.gold} sub="monthly recurring" />
        <StatCard label="AI Messages"    value={loading ? "—" : totalAI.toLocaleString()} color="#4488ff" sub="total conversations" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Free Users"     value={loading ? "—" : freeUsers}           color={COLORS.textMuted} />
        <StatCard label="Avg Confidence" value={loading ? "—" : `${avgConfidence}%`} color="#a855f7" />
        <StatCard label="Avg Streak"     value={loading ? "—" : `${avgStreak}d`}     color="#06b6d4" sub="days consistent" />
        <StatCard label="App Registry"   value={APP_REGISTRY.length}                 color={COLORS.red} sub="registered apps" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        <Card title="Subscription Breakdown">
          {loading ? <Skeleton /> : Object.entries(planCounts).length === 0
            ? <Empty>No subscribers yet</Empty>
            : Object.entries(planCounts).sort((a,b) => b[1]-a[1]).map(([plan, count]) => (
              <div key={plan} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
                <span style={{ fontSize: 13, color: COLORS.textMuted, textTransform: "capitalize" }}>{plan.replace(/_/g, " ")}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 60, height: 4, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, (count / users.length) * 100)}%`, background: COLORS.red, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, minWidth: 20, textAlign: "right" }}>{count}</span>
                </div>
              </div>
            ))
          }
        </Card>

        <Card title="Platform Health">
          {[
            { label: "Firebase Auth",          done: true  },
            { label: "Firestore + Rules",       done: true  },
            { label: "Stripe Webhook",          done: true  },
            { label: "Gemini AI connected",     done: true  },
            { label: "Claude AI fallback",      done: true  },
            { label: "Customer Portal",         done: true  },
            { label: "Learner Intelligence",    done: true  },
            { label: "App iframe URLs",         done: false },
            { label: "ElevenLabs voice",        done: false },
            { label: "Custom domain",           done: false },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: 12, color: item.done ? COLORS.success : COLORS.textDim }}>{item.done ? "✓" : "○"}</span>
              <span style={{ fontSize: 12, color: item.done ? COLORS.text : COLORS.textMuted }}>{item.label}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card title="Recent Sign-ups">
        {loading ? <Skeleton /> : users.length === 0
          ? <Empty>No users yet</Empty>
          : <UserTable users={users.slice(0, 10)} />
        }
      </Card>
    </div>
  );
}

// ── INTELLIGENCE ──────────────────────────────────────────────────────────────

function IntelligenceTab({ users, platform, loading, avgConfidence }) {
  const confidenceDistribution = {
    "Beginning (0-25)":   users.filter(u => (u.confidenceScore ?? 50) < 25).length,
    "Building (25-40)":   users.filter(u => { const s = u.confidenceScore ?? 50; return s >= 25 && s < 40; }).length,
    "Growing (40-55)":    users.filter(u => { const s = u.confidenceScore ?? 50; return s >= 40 && s < 55; }).length,
    "Confident (55-70)":  users.filter(u => { const s = u.confidenceScore ?? 50; return s >= 55 && s < 70; }).length,
    "Breakthrough (70+)": users.filter(u => (u.confidenceScore ?? 50) >= 70).length,
  };

  const totalAI    = platform?.totalAIMessages ?? 0;
  const totalEvents = platform?.totalEvents ?? 0;
  const avgLessons = users.length ? Math.round(users.reduce((s, u) => s + (u.lessonsCompleted ?? 0), 0) / users.length) : 0;
  const avgXP      = users.length ? Math.round(users.reduce((s, u) => s + (u.xpEarned ?? 0), 0) / users.length) : 0;
  const avgHours   = users.length ? Math.round(users.reduce((s, u) => s + (u.hoursLearned ?? 0), 0) / users.length) : 0;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Learner Intelligence Engine</PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Avg Confidence"  value={loading ? "—" : `${avgConfidence}%`} color="#a855f7" sub={confidenceLabel(avgConfidence)} />
        <StatCard label="Total AI Msgs"   value={loading ? "—" : totalAI.toLocaleString()} color="#4488ff" sub="total interactions" />
        <StatCard label="Avg Lessons"     value={loading ? "—" : avgLessons} color={COLORS.success} sub="per user" />
        <StatCard label="Avg Study Hours" value={loading ? "—" : avgHours} color={COLORS.gold} sub="per user" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        <Card title="Confidence Distribution">
          {loading ? <Skeleton /> : Object.entries(confidenceDistribution).map(([label, count]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 80, height: 4, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: users.length ? `${(count / users.length) * 100}%` : "0%", background: "#a855f7", borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, minWidth: 20, textAlign: "right" }}>{count}</span>
              </div>
            </div>
          ))}
        </Card>

        <Card title="Learning Engagement">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Total XP Awarded",   value: users.reduce((s,u) => s + (u.xpEarned ?? 0), 0).toLocaleString(), color: COLORS.gold },
              { label: "Avg XP / User",      value: avgXP.toLocaleString(),   color: COLORS.gold },
              { label: "Streak Leaders (7d+)", value: users.filter(u => (u.streak ?? 0) >= 7).length, color: COLORS.success },
              { label: "Active (1d+ streak)", value: users.filter(u => (u.streak ?? 0) >= 1).length, color: "#4488ff" },
              { label: "App Events Logged",  value: totalEvents.toLocaleString(), color: COLORS.red },
              { label: "Founding Members",   value: users.filter(u => u.isFoundingMember).length, color: COLORS.red },
            ].map(item => (
              <div key={item.label} style={{ background: "#111", borderRadius: 8, padding: "10px 12px" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{loading ? "—" : item.value}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Confidence Engine — User Intelligence">
        {loading ? <Skeleton /> : users.length === 0 ? <Empty>No users yet</Empty> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["User", "Confidence", "Level", "Streak", "XP", "Lessons", "Plan"].map(h => (
                <th key={h} style={{ textAlign: "left", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", padding: "0 0 10px", borderBottom: "1px solid #2a2a2a" }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {[...users].sort((a,b) => (b.confidenceScore ?? 50) - (a.confidenceScore ?? 50)).slice(0, 20).map(u => {
                const score = u.confidenceScore ?? 50;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "9px 0", fontSize: 12 }}>{u.name ?? u.email?.split("@")[0] ?? "—"}</td>
                    <td style={{ padding: "9px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 50, height: 4, background: "#1e1e1e", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${score}%`, background: score >= 70 ? COLORS.success : score >= 40 ? "#a855f7" : COLORS.red, borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 11, color: COLORS.textMuted }}>{score}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "9px 0", fontSize: 11, color: "#a855f7" }}>{confidenceLabel(score)}</td>
                    <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textMuted }}>🔥 {u.streak ?? 0}</td>
                    <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.gold }}>{(u.xpEarned ?? 0).toLocaleString()}</td>
                    <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textMuted }}>{u.lessonsCompleted ?? 0}</td>
                    <td style={{ padding: "9px 0" }}><PlanBadge plan={u.plan} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ── USERS ──────────────────────────────────────────────────────────────────────

function UsersTab({ users, loading, setUsers }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = users.filter(u => {
    const matchSearch = !search || u.email?.includes(search) || u.name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all"
      || (filter === "paid" && u.plan && u.plan !== "free")
      || (filter === "free" && (!u.plan || u.plan === "free"))
      || u.plan === filter;
    return matchSearch && matchFilter;
  });

  const toggleApp = async (uid, appId, has) => {
    const userRef = doc(db, "users", uid);
    const u       = users.find(x => x.id === uid);
    const subs    = u.subscriptions ?? [];
    const updated = has ? subs.filter(s => s !== appId) : [...subs, appId];
    await updateDoc(userRef, { subscriptions: updated });
    setUsers(prev => prev.map(x => x.id === uid ? { ...x, subscriptions: updated } : x));
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>User Management</PageTitle>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
          style={{ flex: 1, padding: "10px 14px", background: COLORS.card, border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 13 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: "10px 14px", background: COLORS.card, border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
          <option value="all">All users</option>
          <option value="paid">Paid subscribers</option>
          <option value="free">Free users</option>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? <Skeleton /> : filtered.length === 0 ? <Empty>No users match</Empty> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(u => (
            <div key={u.id} style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#4a0000,#8b0000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {u.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name ?? "—"}</span>
                    <PlanBadge plan={u.plan} />
                    {u.planStatus === "past_due" && <span style={{ fontSize: 10, color: "#f59e0b", border: "1px solid #f59e0b44", padding: "1px 6px", borderRadius: 8 }}>PAST DUE</span>}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>{u.email}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {APPS.map(app => {
                      const has = u.subscriptions?.includes(app.id);
                      return (
                        <button key={app.id} onClick={() => toggleApp(u.id, app.id, has)}
                          style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer",
                            background: has ? `${app.accent}22` : "transparent",
                            border: `1px solid ${has ? app.accent : "#2a2a2a"}`,
                            color: has ? app.accent : COLORS.textDim }}>
                          {app.id}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: COLORS.textMuted, flexShrink: 0 }}>
                  <div style={{ color: "#a855f7", fontWeight: 600 }}>{confidenceLabel(u.confidenceScore ?? 50)}</div>
                  <div style={{ marginTop: 3 }}>🔥 {u.streak ?? 0}d streak</div>
                  <div style={{ marginTop: 3 }}>⭐ {(u.xpEarned ?? 0).toLocaleString()} XP</div>
                  <div style={{ marginTop: 3, color: COLORS.textDim }}>
                    {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("en-GB") : "—"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── APP REGISTRY ──────────────────────────────────────────────────────────────

function AppsTab({ users }) {
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>App Registry</PageTitle>
      <div style={{ marginBottom: 20, padding: 14, background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 10, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7 }}>
        The App Registry is the OS integration layer. Each registered app can push learning events to the OS via <code style={{ color: COLORS.red }}>POST /api/intelligence</code> and receive learner profile data in return. Future third-party apps register here to connect.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {APP_REGISTRY.map(app => {
          const subscribers = users.filter(u => u.subscriptions?.includes(app.appId)).length;
          const appDef      = APPS.find(a => a.id === app.appId);
          return (
            <div key={app.appId} style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "#1a1a1a", border: "1px solid #2a2a2a", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {appDef?.image ? <img src={appDef.image} alt={app.appName} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 22 }}>{appDef?.icon ?? "📱"}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{app.appName}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: app.status === "active" ? "rgba(34,197,94,0.15)" : "#1a1a1a", color: app.status === "active" ? COLORS.success : COLORS.textDim, border: `1px solid ${app.status === "active" ? "rgba(34,197,94,0.3)" : "#2a2a2a"}`, textTransform: "uppercase", letterSpacing: 1 }}>
                      {app.status}
                    </span>
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: "#1a1a1a", color: COLORS.textDim, border: "1px solid #2a2a2a", textTransform: "uppercase", letterSpacing: 1 }}>
                      {app.category}
                    </span>
                    <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 20, background: app.analyticsEnabled ? "rgba(168,85,247,0.1)" : "#1a1a1a", color: app.analyticsEnabled ? "#a855f7" : COLORS.textDim, border: "1px solid #2a2a2a" }}>
                      {app.analyticsEnabled ? "🧠 Intelligence ON" : "Intelligence OFF"}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>{app.description}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>
                    Skills: {app.skillsTargeted.join(", ")} · Vendor: {app.vendor}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 3 }}>
                    Integration: <code style={{ color: COLORS.red, fontSize: 10 }}>POST /api/intelligence → appId: "{app.appId}"</code>
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.red }}>{subscribers}</div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>subscribers</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── REVENUE ────────────────────────────────────────────────────────────────────

function RevenueTab({ users, planCounts, mrr }) {
  const arr          = mrr * 12;
  const paidUsers    = users.filter(u => MRR_MAP[u.plan]);
  const arpu         = paidUsers.length ? Math.round(mrr / paidUsers.length) : 0;
  const churnedUsers = users.filter(u => u.planStatus === "cancelled").length;
  const churnRate    = users.length ? ((churnedUsers / users.length) * 100).toFixed(1) : "0.0";

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Revenue & Subscriptions</PageTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Est. MRR"     value={`¥${mrr.toLocaleString()}`}  color={COLORS.success} sub="monthly recurring" />
        <StatCard label="Est. ARR"     value={`¥${arr.toLocaleString()}`}  color={COLORS.gold}    sub="annual run rate" />
        <StatCard label="ARPU"         value={`¥${arpu.toLocaleString()}`} color="#4488ff"        sub="avg revenue/user" />
        <StatCard label="Churn"        value={`${churnRate}%`}             color={churnedUsers > 0 ? "#f59e0b" : COLORS.success} sub={`${churnedUsers} cancelled`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="Revenue by Plan">
          {PLANS.map(p => {
            const count   = planCounts[p.id] ?? 0;
            const revenue = count * p.price_monthly;
            return (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #1e1e1e" }}>
                <div>
                  <div style={{ fontSize: 12, color: COLORS.text }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>¥{p.price_monthly.toLocaleString()}/mo × {count}</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: revenue > 0 ? COLORS.success : COLORS.textDim }}>
                  {revenue > 0 ? `¥${revenue.toLocaleString()}` : "—"}
                </div>
              </div>
            );
          })}
        </Card>

        <Card title="Plan Status Breakdown">
          {["active","past_due","cancelled","—"].map(status => {
            const count = users.filter(u => (u.planStatus ?? "—") === status).length;
            const colors = { active: COLORS.success, past_due: "#f59e0b", cancelled: COLORS.red, "—": COLORS.textDim };
            return (
              <div key={status} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1e1e1e" }}>
                <span style={{ fontSize: 12, color: colors[status], textTransform: "capitalize" }}>{status === "—" ? "Free / No plan" : status.replace(/_/g, " ")}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>{count}</span>
              </div>
            );
          })}
          <div style={{ marginTop: 14, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6 }}>
            Revenue figures are estimates based on plan prices.<br />
            Connect Stripe Dashboard for live payment data.
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────

function SettingsTab() {
  const envVars = [
    { key: "VITE_FIREBASE_API_KEY",          status: "set",     note: "Firebase project API key" },
    { key: "VITE_FIREBASE_AUTH_DOMAIN",      status: "set",     note: "Firebase auth domain" },
    { key: "VITE_FIREBASE_PROJECT_ID",       status: "set",     note: "Firebase project ID" },
    { key: "VITE_ADMIN_EMAIL",               status: "set",     note: "Admin backdoor email" },
    { key: "ANTHROPIC_API_KEY",              status: "set",     note: "Claude AI fallback" },
    { key: "GEMINI_API_KEY",                 status: "set",     note: "Primary AI — Gemini 2.5 Flash" },
    { key: "STRIPE_SECRET_KEY",              status: "set",     note: "Stripe server-side key" },
    { key: "STRIPE_WEBHOOK_SECRET",          status: "set",     note: "Webhook HMAC verification" },
    { key: "FIREBASE_API_KEY",               status: "set",     note: "Server-side Firestore key" },
    { key: "VITE_ELEVENLABS_API_KEY",        status: "pending", note: "Voice narration — activates automatically when set" },
    { key: "VITE_APP_URL_PHONICS",           status: "pending", note: "Monkey Yoga Phonics iframe URL" },
    { key: "VITE_APP_URL_EIKEN",             status: "pending", note: "EIKEN AI Monkey iframe URL" },
    { key: "VITE_APP_URL_SPEAK",             status: "pending", note: "Speak & Sweat iframe URL" },
    { key: "VITE_APP_URL_WONDERCAMP",        status: "pending", note: "Wondercamp iframe URL" },
    { key: "VITE_APP_URL_FAMILY",            status: "pending", note: "HSD Family iframe URL" },
    { key: "VITE_APP_URL_SIPSWITCH",         status: "pending", note: "Sip & Switch iframe URL" },
    { key: "VITE_APP_URL_INNERKEY",          status: "pending", note: "The Inner Key Blueprint iframe URL" },
  ];

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Platform Settings</PageTitle>

      <div style={{ marginBottom: 20, padding: 14, background: "#0a0a0a", border: "1px solid rgba(224,16,16,0.2)", borderRadius: 10, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7 }}>
        All secrets are stored in Cloudflare Pages environment variables.<br />
        To update: <code style={{ color: COLORS.red }}>echo "value" | npx wrangler pages secret put KEY_NAME --project-name hearseedo-app</code>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {envVars.map(v => (
          <div key={v.key} style={{ background: COLORS.card, border: `1px solid ${v.status === "set" ? "rgba(34,197,94,0.2)" : "#1e1e1e"}`, borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: v.status === "set" ? COLORS.success : "#333" }} />
            <div style={{ flex: 1 }}>
              <code style={{ fontSize: 12, color: v.status === "set" ? COLORS.red : COLORS.textMuted }}>{v.key}</code>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{v.note}</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: v.status === "set" ? COLORS.success : COLORS.textDim, letterSpacing: 1, textTransform: "uppercase" }}>
              {v.status === "set" ? "✓ Set" : "Pending"}
            </span>
          </div>
        ))}
      </div>

      <Card title="Intelligence API — App Integration">
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.8 }}>
          <div style={{ marginBottom: 10 }}>Apps push learning events to the OS via:</div>
          <pre style={{ background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8, padding: 14, fontSize: 11, color: "#4488ff", overflowX: "auto" }}>{`POST https://hearseedo-app.pages.dev/api/intelligence

{
  "idToken": "firebase-id-token",
  "appId": "phonics",
  "event": "lesson_completed",
  "data": {
    "lessonId": "phonics-001",
    "score": 85,
    "skills": { "pronunciation": 5, "listening": 3 }
  }
}`}</pre>
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textDim }}>
            Valid events: lesson_completed, challenge_completed, skill_practiced, confidence_reported,
            milestone_reached, session_started, session_ended, mistake_detected, breakthrough_moment,
            goal_set, goal_achieved, reflection_written, habit_completed
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── SHARED UI ──────────────────────────────────────────────────────────────────

function PageTitle({ children }) {
  return <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: COLORS.text }}>{children}</div>;
}

function StatCard({ label, value, sub, color = COLORS.red }) {
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 20 }}>
      {title && <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>{title}</div>}
      {children}
    </div>
  );
}

function Stat({ label, value, color = COLORS.textMuted }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
      <span style={{ fontSize: 11, color: COLORS.textDim }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ textAlign: "center", padding: "28px 0", fontSize: 13, color: COLORS.textMuted }}>{children}</div>;
}

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[1,2,3].map(i => <div key={i} style={{ height: 40, background: "#1a1a1a", borderRadius: 8, opacity: 0.5 }} />)}
    </div>
  );
}

function PlanBadge({ plan }) {
  if (!plan || plan === "free") return null;
  const colors = { all_access: COLORS.red, family_full: COLORS.gold, adult_complete: "#a855f7", kids_starter: "#4488ff", english_boost: COLORS.success, adult_growth: "#06b6d4", cancelled: "#333" };
  const c = colors[plan] ?? COLORS.textDim;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: `${c}22`, border: `1px solid ${c}44`, color: c, textTransform: "capitalize" }}>
      {plan.replace(/_/g, " ")}
    </span>
  );
}

function UserTable({ users }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>{["Name", "Email", "Plan", "Confidence", "Streak", "Joined"].map(h => (
          <th key={h} style={{ textAlign: "left", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", padding: "0 0 10px", borderBottom: "1px solid #2a2a2a" }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
            <td style={{ padding: "9px 0", fontSize: 13 }}>{u.name ?? "—"}</td>
            <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textMuted }}>{u.email}</td>
            <td style={{ padding: "9px 0" }}><PlanBadge plan={u.plan} /></td>
            <td style={{ padding: "9px 0", fontSize: 12, color: "#a855f7" }}>{confidenceLabel(u.confidenceScore ?? 50)}</td>
            <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textMuted }}>🔥 {u.streak ?? 0}d</td>
            <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textDim }}>
              {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("en-GB") : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
