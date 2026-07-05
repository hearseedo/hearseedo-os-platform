import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, doc, updateDoc, onSnapshot, query, orderBy, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db, logout } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { COLORS } from "../constants/colors";
import { APPS } from "../constants/apps";
import { PLANS, FAMILY_PLANS } from "../constants/plans";
import { APP_REGISTRY } from "../constants/appRegistry";
import { confidenceLabel, trendIcon } from "../lib/confidenceEngine";
import { FOUNDING_LIMIT, FOUNDING_BADGE, REFERRAL_BADGES, LEGACY_FOUNDER_BADGE } from "../lib/founding";
import FoundingBadge from "../components/FoundingBadge";

const TABS = [
  { id: "overview",      label: "Overview",       icon: "📊" },
  { id: "warnings",      label: "Warnings",       icon: "⚠️" },
  { id: "support",       label: "Support",        icon: "💬" },
  { id: "feedback",      label: "Feedback",       icon: "📣" },
  { id: "intelligence",  label: "Intelligence",   icon: "🧠" },
  { id: "users",         label: "Users",          icon: "👥" },
  { id: "founding",      label: "Founding",       icon: "🏅" },
  { id: "apps",          label: "App Registry",   icon: "📱" },
  { id: "revenue",       label: "Revenue",        icon: "💳" },
  { id: "audit",         label: "Audit Log",      icon: "🔐" },
  { id: "settings",      label: "Settings",       icon: "⚙️" },
];

// ── WARNING ENGINE ─────────────────────────────────────────────────────────────

const XPRIZE_DEADLINE = new Date("2026-08-17T23:59:59Z");
const FOUNDING_GOAL   = 200;

function computeWarnings({ users, platform, foundingCount, mrr }) {
  const warnings = [];
  const now      = new Date();

  // ── CRITICAL ────────────────────────────────────────────────────────────────

  const daysToXprize = Math.ceil((XPRIZE_DEADLINE - now) / 86400000);
  if (daysToXprize <= 60) {
    warnings.push({
      id: "xprize_deadline",
      level: daysToXprize <= 14 ? "critical" : "warning",
      title: `XPRIZE deadline in ${daysToXprize} day${daysToXprize !== 1 ? "s" : ""}`,
      detail: "Submission closes Aug 17, 2026. You need a demo video, 200 founding members, and proof of learning outcomes.",
      action: "Record demo video, reach 200 members, deploy final build.",
      icon: "🏆",
    });
  }

  const pastDueUsers = users.filter(u => u.planStatus === "past_due");
  if (pastDueUsers.length > 0) {
    const lostMrr = pastDueUsers.reduce((s, u) => s + (MRR_MAP[u.plan] ?? 0), 0);
    warnings.push({
      id: "past_due",
      level: "critical",
      title: `${pastDueUsers.length} subscription${pastDueUsers.length > 1 ? "s" : ""} past due`,
      detail: `¥${lostMrr.toLocaleString()}/mo at risk. Stripe will auto-retry but may cancel after 3 failures.`,
      action: "Check Stripe → Billing → Past due. Email users to update payment.",
      icon: "💳",
    });
  }

  const missingIframeUrls = [
    "VITE_APP_URL_PHONICS","VITE_APP_URL_SPEAK","VITE_APP_URL_WONDERCAMP",
    "VITE_APP_URL_FAMILY","VITE_APP_URL_SIPSWITCH","VITE_APP_URL_INNERKEY",
    "VITE_APP_URL_EIKEN",
  ].filter(k => !import.meta.env[k]);
  if (missingIframeUrls.length > 0) {
    warnings.push({
      id: "iframe_urls",
      level: "critical",
      title: `${missingIframeUrls.length} app iframe URL${missingIframeUrls.length > 1 ? "s" : ""} not configured`,
      detail: "Apps without a URL open a blank iframe. Users can't access these apps.",
      action: "Set VITE_APP_URL_* env vars in Netlify → Site config → Environment variables, then redeploy.",
      icon: "📱",
    });
  }

  // ── WARNINGS ────────────────────────────────────────────────────────────────

  const foundingNeeded = FOUNDING_GOAL - (foundingCount ?? 0);
  const foundingPct    = ((foundingCount ?? 0) / FOUNDING_GOAL) * 100;
  if (foundingNeeded > 0 && foundingPct >= 50) {
    warnings.push({
      id: "founding_members",
      level: "warning",
      title: `${foundingNeeded} founding member spot${foundingNeeded !== 1 ? "s" : ""} remaining`,
      detail: `${Math.round(foundingPct)}% full. The founding window closes at 200 paying members — this is your main XPRIZE growth signal.`,
      action: "Push referral links, share XPRIZE competition story on social media.",
      icon: "🏅",
    });
  } else if (foundingNeeded > 0 && foundingPct > 0) {
    warnings.push({
      id: "founding_low",
      level: "warning",
      title: `Founding members: ${foundingCount ?? 0} / ${FOUNDING_GOAL}`,
      detail: "Need 200 paying members before Aug 15 to meet the XPRIZE goal.",
      action: "Focus on converting free users and driving new sign-ups via referrals.",
      icon: "🏅",
    });
  }

  const paidUsers = users.filter(u => u.plan && u.plan !== "free" && u.planStatus === "active").length;
  const freeUsers = users.filter(u => !u.plan || u.plan === "free").length;
  const convRate  = users.length ? (paidUsers / users.length) * 100 : 0;
  if (users.length >= 10 && convRate < 15) {
    warnings.push({
      id: "low_conversion",
      level: "warning",
      title: `Low paid conversion: ${convRate.toFixed(0)}%`,
      detail: `${freeUsers} of ${users.length} users are on free plan. Industry average for EdTech is 15–25%.`,
      action: "Add in-app upgrade prompts, limited-time founding member offer, or feature-gate key apps.",
      icon: "📈",
    });
  }

  const cancelledUsers = users.filter(u => u.planStatus === "cancelled").length;
  const churnRate = users.length ? (cancelledUsers / users.length) * 100 : 0;
  if (cancelledUsers > 0 && churnRate > 5) {
    warnings.push({
      id: "high_churn",
      level: "warning",
      title: `Churn rate: ${churnRate.toFixed(1)}%`,
      detail: `${cancelledUsers} cancelled subscription${cancelledUsers !== 1 ? "s" : ""}. Above 5% monthly churn hurts ARR growth.`,
      action: "Set up win-back email sequence via Mailchimp. Survey churned users for feedback.",
      icon: "📉",
    });
  }

  // ElevenLabs is server-side only (no VITE_ prefix) — always remind admin to verify it's set
  if (!platform?.elevenlabsVerified) {
    warnings.push({
      id: "elevenlabs",
      level: "warning",
      title: "Verify ElevenLabs voice key is set",
      detail: "ELEVENLABS_API_KEY is server-side only and cannot be auto-detected here. If Jona's voice is silent for users, the key is missing or wrong.",
      action: "In Netlify → Site config → Environment variables, confirm ELEVENLABS_API_KEY (no VITE_ prefix) is set. Then set platform.elevenlabsVerified = true in Firestore analytics/platform.",
      icon: "🎙️",
    });
  }

  const usersWithoutAssessment = users.filter(u => !u.assessmentDone && u.plan && u.plan !== "free").length;
  if (usersWithoutAssessment > 0) {
    warnings.push({
      id: "no_baseline",
      level: "warning",
      title: `${usersWithoutAssessment} paid user${usersWithoutAssessment !== 1 ? "s" : ""} without a baseline assessment`,
      detail: "Without a baseline, you can't prove learning improvement for XPRIZE or school contracts.",
      action: "Add a reminder to complete the placement assessment on the Dashboard home screen.",
      icon: "📋",
    });
  }

  const avgConfidence = users.length
    ? Math.round(users.reduce((s, u) => s + (u.confidenceScore ?? 50), 0) / users.length)
    : 0;
  if (users.length >= 5 && avgConfidence < 40) {
    warnings.push({
      id: "low_confidence",
      level: "warning",
      title: `Platform avg confidence is low: ${avgConfidence}%`,
      detail: "Users average below 40 confidence score. This may indicate onboarding friction or low engagement.",
      action: "Review onboarding flow, check if WarmUp and AIChat are engaging users effectively.",
      icon: "🧠",
    });
  }

  // ── INFO ────────────────────────────────────────────────────────────────────

  if (!window.location.hostname.includes("hsdos.ai") && !window.location.hostname.includes("localhost")) {
    warnings.push({
      id: "custom_domain",
      level: "info",
      title: "Custom domain not yet live",
      detail: `Platform is running on ${window.location.hostname}. Target domain: app.hsdos.ai (landing: hsdos.ai).`,
      action: "In Netlify → Domain management, add hsdos.ai. Set app.hsdos.ai for the platform and hsdos.ai for the landing page.",
      icon: "🌐",
    });
  }

  if (users.length > 50 && !platform?.geminiTierUpgraded) {
    warnings.push({
      id: "gemini_tier",
      level: "info",
      title: "Consider upgrading Gemini API tier",
      detail: `${users.length} users — at high concurrency the free Gemini tier (15 RPM) may rate-limit learning path and assessment calls.`,
      action: "Upgrade to Gemini paid tier at Google AI Studio to increase rate limits.",
      icon: "🤖",
    });
  }

  const zeroStreakPaidUsers = users.filter(u => u.plan && u.plan !== "free" && (u.streak ?? 0) === 0).length;
  if (zeroStreakPaidUsers > 2) {
    warnings.push({
      id: "inactive_paid",
      level: "info",
      title: `${zeroStreakPaidUsers} paid users with 0-day streak`,
      detail: "Paying users who aren't returning are at high churn risk.",
      action: "Set up a re-engagement email sequence for users inactive 3+ days.",
      icon: "😴",
    });
  }

  return warnings;
}

const MRR_MAP = {
  individual: 2480, family: 3980,
  phonics: 1280, eiken: 1258, wondercamp: 1680, sipswitch: 1088, speak: 1020, innerkey: 1258,
  kids_starter: 2780, english_boost: 2108, adult_growth: 1853,
  adult_complete: 2873, all_access: 4980,
  family_core: 2780, family_plus: 4280, family_premium: 5980,
};

export default function Admin() {
  const { user, isAdmin } = useAuth();
  const navigate          = useNavigate();
  const [tab, setTab]     = useState("overview");
  const [users, setUsers] = useState([]);
  const [platform, setPlatform]   = useState(null);
  const [pageViews, setPageViews] = useState(null);
  const [foundingCount, setFoundingCount] = useState(null);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (user === null || (user && !isAdmin)) navigate("/", { replace: true });
  }, [user, isAdmin]);

  // Admin access log — write once on mount
  useEffect(() => {
    if (!user?.uid || !isAdmin) return;
    addDoc(collection(db, "adminLogs"), {
      adminEmail: user.email,
      action:     "admin_panel_opened",
      timestamp:  serverTimestamp(),
      userAgent:  navigator.userAgent.slice(0, 200),
    }).catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    const ready = new Set();
    const markReady = (key) => { ready.add(key); if (ready.size === 4) setLoading(false); };

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      snap => { setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))); markReady("users"); },
      err  => { console.error("Admin users:", err); markReady("users"); }
    );
    const unsubPlatform = onSnapshot(
      doc(db, "analytics", "platform"),
      snap => { if (snap.exists()) setPlatform(snap.data()); markReady("platform"); },
      err  => { console.error("Admin platform:", err); markReady("platform"); }
    );
    const unsubPageViews = onSnapshot(
      doc(db, "analytics", "pageViews"),
      snap => { if (snap.exists()) setPageViews(snap.data()); markReady("pv"); },
      err  => { console.error("Admin pageViews:", err); markReady("pv"); }
    );
    const unsubSignups = onSnapshot(
      doc(db, "meta", "signups"),
      snap => { setFoundingCount(snap.exists() ? (snap.data().count ?? 0) : 0); markReady("signups"); },
      err  => { console.error("Admin signups:", err); markReady("signups"); }
    );

    return () => { unsubUsers(); unsubPlatform(); unsubPageViews(); unsubSignups(); };
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

  const warnings       = loading ? [] : computeWarnings({ users, platform, foundingCount, mrr });
  const criticalCount  = warnings.filter(w => w.level === "critical").length;
  const warningCount   = warnings.filter(w => w.level !== "info").length;

  // Live support unread count
  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "support"), snap => {
      setSupportUnread(snap.docs.filter(d => d.data().unreadByAdmin).length);
    });
    return unsub;
  }, []);

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
          {TABS.map(t => {
            const isWarningTab = t.id === "warnings";
            const isSupportTab = t.id === "support";
            const badgeCount   = isWarningTab ? warnings.length : isSupportTab ? supportUnread : 0;
            const badgeColor   = isWarningTab ? (criticalCount > 0 ? COLORS.red : "#f59e0b") : COLORS.red;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, marginBottom: 2,
                background: tab === t.id ? (isWarningTab ? "rgba(245,158,11,0.12)" : "rgba(224,16,16,0.15)") : "none",
                border: "none",
                color: tab === t.id ? (isWarningTab ? "#f59e0b" : COLORS.red) : COLORS.textMuted,
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400, cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {badgeCount > 0 && (
                  <span style={{
                    background: badgeColor, color: "#fff", fontSize: 10, fontWeight: 800,
                    minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center",
                    justifyContent: "center", padding: "0 4px",
                  }}>{badgeCount}</span>
                )}
              </button>
            );
          })}

          <div style={{ margin: "20px 8px 0", padding: 12, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8 }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 8, letterSpacing: 1 }}>LIVE STATS</div>
            <Stat label="Users"        value={loading ? "…" : totalUsers} />
            <Stat label="Paid"         value={loading ? "…" : paidUsers} color={COLORS.success} />
            <Stat label="All Access"   value={loading ? "…" : allAccessUsers} color={COLORS.gold} />
            <Stat label="Est. MRR"     value={loading ? "…" : `¥${mrr.toLocaleString()}`} color={COLORS.red} />
            <Stat label="AI Msgs"       value={loading ? "…" : (platform?.totalAIMessages ?? 0).toLocaleString()} color="#4488ff" />
            <Stat label="Avg Confidence" value={loading ? "…" : `${avgConfidence}%`} color="#a855f7" />
            <Stat label="Founding #"    value={loading ? "…" : `${foundingCount ?? 0} / ${FOUNDING_LIMIT}`} color="#C9A84C" />
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {tab === "overview"     && <OverviewTab     users={users} planCounts={planCounts} platform={platform} pageViews={pageViews} loading={loading} mrr={mrr} paidUsers={paidUsers} avgConfidence={avgConfidence} foundingCount={foundingCount} warnings={warnings} onViewWarnings={() => setTab("warnings")} />}
          {tab === "warnings"     && <WarningsTab     warnings={warnings} loading={loading} />}
          {tab === "support"      && <SupportTab />}
          {tab === "intelligence" && <IntelligenceTab users={users} platform={platform} loading={loading} avgConfidence={avgConfidence} />}
          {tab === "users"        && <UsersTab        users={users} loading={loading} setUsers={setUsers} />}
          {tab === "founding"     && <FoundingTab     users={users} loading={loading} foundingCount={foundingCount} />}
          {tab === "apps"         && <AppsTab         users={users} />}
          {tab === "revenue"      && <RevenueTab      users={users} planCounts={planCounts} mrr={mrr} />}
          {tab === "audit"        && <AuditTab />}
          {tab === "feedback"     && <FeedbackTab />}
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

function OverviewTab({ users, planCounts, platform, pageViews, loading, mrr, paidUsers, avgConfidence, foundingCount, warnings = [], onViewWarnings }) {
  const freeUsers  = users.filter(u => !u.plan || u.plan === "free").length;
  const avgStreak  = users.length ? Math.round(users.reduce((s, u) => s + (u.streak ?? 0), 0) / users.length) : 0;
  const totalAI    = platform?.totalAIMessages ?? 0;
  const today      = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const pvTotal    = pageViews?.total ?? 0;
  const pvToday    = pageViews?.[today] ?? 0;
  const critical   = warnings.filter(w => w.level === "critical");
  const nonInfo    = warnings.filter(w => w.level !== "info");

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Platform Overview</PageTitle>

      {/* Warnings strip */}
      {!loading && warnings.length > 0 && (
        <div style={{
          marginBottom: 24, padding: "14px 18px",
          background: critical.length > 0 ? "rgba(224,16,16,0.08)" : "rgba(245,158,11,0.07)",
          border: `1px solid ${critical.length > 0 ? "rgba(224,16,16,0.3)" : "rgba(245,158,11,0.3)"}`,
          borderRadius: 12, display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{ fontSize: 22 }}>{critical.length > 0 ? "🚨" : "⚠️"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: critical.length > 0 ? COLORS.red : "#f59e0b", marginBottom: 3 }}>
              {critical.length > 0
                ? `${critical.length} critical issue${critical.length !== 1 ? "s" : ""} require your attention`
                : `${nonInfo.length} warning${nonInfo.length !== 1 ? "s" : ""} to review`}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>
              {critical.map(w => w.title).join(" · ")}
            </div>
          </div>
          <button onClick={onViewWarnings} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid currentColor",
            background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600,
            color: critical.length > 0 ? COLORS.red : "#f59e0b",
            flexShrink: 0,
          }}>
            View all {warnings.length} →
          </button>
        </div>
      )}

      {!loading && warnings.length === 0 && (
        <div style={{ marginBottom: 24, padding: "12px 18px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <span style={{ fontSize: 13, color: "#22c55e", fontWeight: 600 }}>All systems healthy — no upgrades or issues detected</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Total Users"    value={loading ? "—" : users.length}       color={COLORS.red} />
        <StatCard label="Paid Users"     value={loading ? "—" : paidUsers}           color={COLORS.success} sub="active subscriptions" />
        <StatCard label="Est. MRR"       value={loading ? "—" : `¥${mrr.toLocaleString()}`} color={COLORS.gold} sub="monthly recurring" />
        <StatCard label="AI Messages"    value={loading ? "—" : totalAI.toLocaleString()} color="#4488ff" sub="total conversations" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Free Users"        value={loading ? "—" : freeUsers}           color={COLORS.textMuted} />
        <StatCard label="Avg Confidence"    value={loading ? "—" : `${avgConfidence}%`} color="#a855f7" />
        <StatCard label="Avg Streak"        value={loading ? "—" : `${avgStreak}d`}     color="#06b6d4" sub="days consistent" />
        <StatCard label="App Registry"      value={APP_REGISTRY.length}                 color={COLORS.red} sub="registered apps" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Landing Visits"    value={loading ? "—" : pvTotal.toLocaleString()}                                                              color="#f59e0b" sub="all-time" />
        <StatCard label="Visits Today"      value={loading ? "—" : pvToday.toLocaleString()}                                                              color="#f59e0b" sub="Japan time" />
        <StatCard label="Visit → Signup"    value={loading || !pvTotal ? "—" : `${((users.length / pvTotal) * 100).toFixed(1)}%`}                        color="#06b6d4" sub="conversion rate" />
        <StatCard label="Free → Paid"       value={loading || !users.length ? "—" : `${((paidUsers / users.length) * 100).toFixed(1)}%`}                 color={COLORS.success} sub="upgrade rate" />
      </div>

      {/* Founding Member Banner */}
      {foundingCount !== null && (
        <div style={{ marginBottom: 28, background: "linear-gradient(135deg,#1a0000,#0d0d0d)", border: "1px solid rgba(224,16,16,0.3)", borderRadius: 12, padding: "18px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Founding Member Window — First 200 Paying Users</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                {foundingCount >= FOUNDING_LIMIT
                  ? <span style={{ color: COLORS.red, fontWeight: 700 }}>Window CLOSED — all 200 Founding Member spots filled</span>
                  : <span><strong style={{ color: COLORS.red }}>{FOUNDING_LIMIT - foundingCount} spots remaining</strong> — closes at paying member #{FOUNDING_LIMIT}</span>
                }
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: foundingCount >= FOUNDING_LIMIT ? COLORS.red : "#C9A84C" }}>
                {foundingCount} <span style={{ fontSize: 16, color: COLORS.textMuted }}>/ {FOUNDING_LIMIT}</span>
              </div>
              <div style={{ fontSize: 10, color: COLORS.textDim }}>founding members</div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${Math.min(100, (foundingCount / FOUNDING_LIMIT) * 100)}%`,
              background: foundingCount >= FOUNDING_LIMIT ? COLORS.red : "linear-gradient(90deg,#e01010,#ff4444)",
              borderRadius: 3, transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}

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
            { label: "Firebase Auth",             done: true  },
            { label: "Firestore + Rules",          done: true  },
            { label: "Stripe Webhook",             done: true  },
            { label: "Gemini AI (learning path)",  done: true  },
            { label: "Claude AI (Jona chat)",      done: true  },
            { label: "Customer Portal",            done: true  },
            { label: "Learner Intelligence",       done: true  },
            { label: "Placement Assessment",       done: true  },
            { label: "Assessment → Learning Path", done: true  },
            { label: "Admin Warnings Engine",      done: true  },
            { label: "Japanese (JP) translation",  done: true  },
            { label: "Daily Warm-Up",              done: true  },
            { label: "Progress Journey tracker",   done: true  },
            { label: "Parent share page",          done: true  },
            { label: "UID auth on all APIs",       done: true  },
            { label: "ElevenLabs voice",           done: true  },
            { label: "App iframe URLs",            done: true  },
            { label: "Custom domain (hsdos.ai)",   done: true  },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #1a1a1a" }}>
              <span style={{ fontSize: 12, color: item.done ? COLORS.success : "#f59e0b" }}>{item.done ? "✓" : "○"}</span>
              <span style={{ fontSize: 12, color: item.done ? COLORS.text : COLORS.textMuted, flex: 1 }}>{item.label}</span>
              {!item.done && item.note && <span style={{ fontSize: 9, color: "#f59e0b", letterSpacing: 0.5 }}>{item.note}</span>}
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

// ── FOUNDING ──────────────────────────────────────────────────────────────────

function FoundingTab({ users, loading, foundingCount }) {
  // Founding Members = first 200 paying (set by Stripe webhook)
  const foundingMembers = users
    .filter(u => u.isFoundingMember && u.foundingMemberNumber)
    .sort((a, b) => a.foundingMemberNumber - b.foundingMemberNumber);

  const windowClosed = (foundingCount ?? 0) >= FOUNDING_LIMIT;

  // Referral leaderboard from users (referralCount sourced from user doc if pre-loaded, or 0)
  // For full referral data we'd need to query the referrals sub-collection; here we show what's on users
  const referralLeaders = [...users]
    .filter(u => (u.referralCount ?? 0) > 0)
    .sort((a, b) => (b.referralCount ?? 0) - (a.referralCount ?? 0));

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Founding Members &amp; Referrals</PageTitle>

      {/* Stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 28 }}>
        <StatCard label="Founding Members" value={loading ? "—" : foundingCount ?? 0}      color={COLORS.red}     sub={`of ${FOUNDING_LIMIT} paying spots`} />
        <StatCard label="Spots Left"       value={loading ? "—" : Math.max(0, FOUNDING_LIMIT - (foundingCount ?? 0))} color={windowClosed ? COLORS.red : COLORS.success} sub="window status" />
        <StatCard label="Status"           value={windowClosed ? "CLOSED" : "OPEN"}         color={windowClosed ? COLORS.red : COLORS.success} sub="founding window" />
        <StatCard label="Referral Leaders" value={loading ? "—" : referralLeaders.length}   color="#C9A84C"        sub="active referrers" />
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 28, background: COLORS.card, border: "1px solid rgba(224,16,16,0.2)", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>Founding Member Window</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>
            <strong style={{ color: COLORS.red }}>{foundingCount ?? 0}</strong> / {FOUNDING_LIMIT} paying members
          </div>
        </div>
        <div style={{ height: 8, background: "#1e1e1e", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, ((foundingCount ?? 0) / FOUNDING_LIMIT) * 100)}%`, background: windowClosed ? "#555" : "linear-gradient(90deg,#e01010,#ff4444)", borderRadius: 4, transition: "width 0.4s" }} />
        </div>
        {windowClosed && <div style={{ marginTop: 8, fontSize: 12, color: COLORS.red, fontWeight: 600 }}>Window closed — 200 Founding Members confirmed.</div>}
      </div>

      {/* Badge reference */}
      <Card title="Badge System">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 8 }}>
          {[
            { ...FOUNDING_BADGE, note: "First 200 paying users" },
            { ...REFERRAL_BADGES.ambassador, note: "50+ referrals" },
            { ...REFERRAL_BADGES.pioneer,    note: "100+ referrals" },
            { ...REFERRAL_BADGES.visionary,  note: "250+ referrals" },
            { ...LEGACY_FOUNDER_BADGE,       note: "Top 100 referrers" },
          ].map(b => (
            <div key={b.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: 12, background: "#111", borderRadius: 10, border: `1px solid ${b.color}33` }}>
              <FoundingBadge badgeId={b.id} size="sm" />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: b.color }}>{b.name}</div>
                <div style={{ fontSize: 9, color: COLORS.textDim }}>{b.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Founding member list */}
      <div style={{ marginTop: 20 }}>
        <Card title={`Founding Members (${foundingMembers.length} / ${FOUNDING_LIMIT})`}>
          {loading ? <Skeleton /> : foundingMembers.length === 0
            ? <Empty>No founding members yet — awarded on first payment</Empty>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["#", "Name", "Email", "Plan", "Claimed"].map(h => (
                    <th key={h} style={{ textAlign: "left", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", padding: "0 0 10px", borderBottom: "1px solid #2a2a2a" }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {foundingMembers.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                      <td style={{ padding: "9px 0", fontSize: 13, color: COLORS.red, fontWeight: 700 }}>#{String(u.foundingMemberNumber).padStart(3, "0")}</td>
                      <td style={{ padding: "9px 0", fontSize: 13 }}>{u.name ?? "—"}</td>
                      <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textMuted }}>{u.email}</td>
                      <td style={{ padding: "9px 0" }}><PlanBadge plan={u.plan} /></td>
                      <td style={{ padding: "9px 0", fontSize: 11, color: COLORS.textDim }}>
                        {u.foundingClaimedAt ? new Date(u.foundingClaimedAt).toLocaleDateString("en-GB") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </Card>
      </div>

      {/* Referral leaderboard */}
      {referralLeaders.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card title="Referral Leaderboard">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Rank", "Name", "Email", "Badge", "Referrals"].map(h => (
                  <th key={h} style={{ textAlign: "left", fontSize: 10, color: COLORS.textDim, letterSpacing: 1, textTransform: "uppercase", padding: "0 0 10px", borderBottom: "1px solid #2a2a2a" }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {referralLeaders.slice(0, 50).map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
                    <td style={{ padding: "9px 0", fontSize: 13, color: i < 3 ? "#C9A84C" : COLORS.textMuted, fontWeight: 700 }}>#{i + 1}</td>
                    <td style={{ padding: "9px 0", fontSize: 13 }}>{u.name ?? "—"}</td>
                    <td style={{ padding: "9px 0", fontSize: 12, color: COLORS.textMuted }}>{u.email}</td>
                    <td style={{ padding: "9px 0" }}>
                      {u.referralBadge && u.referralBadge !== "none" && <FoundingBadge badgeId={u.isLegacyFounder ? "legacy_founder" : u.referralBadge} size="sm" />}
                    </td>
                    <td style={{ padding: "9px 0", fontSize: 14, fontWeight: 700, color: "#C9A84C" }}>{u.referralCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
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
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState("all");
  const [thankingUid, setThankingUid] = useState(null);
  const [noteText, setNoteText]       = useState("");
  const [sending, setSending]         = useState(false);

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

  const openThankYou = (u) => {
    setThankingUid(u.id);
    setNoteText(`Your idea just shipped in HSD OS. Thank you for helping us build something better — you're officially a Contributor. 🙏`);
  };

  const sendThankYou = async (uid) => {
    if (!noteText.trim()) return;
    setSending(true);
    try {
      await updateDoc(doc(db, "users", uid), { hasContributorBadge: true });
      await addDoc(collection(db, "users", uid, "notifications"), {
        message:   noteText.trim(),
        from:      "admin",
        type:      "contributor_thanks",
        read:      false,
        createdAt: serverTimestamp(),
      });
      setUsers(prev => prev.map(x => x.id === uid ? { ...x, hasContributorBadge: true } : x));
      setThankingUid(null);
      setNoteText("");
    } catch (e) {
      console.error("sendThankYou:", e);
    }
    setSending(false);
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
            <div key={u.id} style={{ background: COLORS.card, border: `1px solid ${u.hasContributorBadge ? "rgba(6,182,212,0.25)" : "#1e1e1e"}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg,#4a0000,#8b0000)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
                  {(u.name || u.email)?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{u.name || u.email?.split("@")[0] || u.id}</span>
                    <PlanBadge plan={u.plan} />
                    {u.planStatus === "past_due" && <span style={{ fontSize: 10, color: "#f59e0b", border: "1px solid #f59e0b44", padding: "1px 6px", borderRadius: 8 }}>PAST DUE</span>}
                    {u.hasContributorBadge && <span style={{ fontSize: 10, color: "#06b6d4", border: "1px solid rgba(6,182,212,0.4)", padding: "1px 8px", borderRadius: 8, fontWeight: 700 }}>💡 Contributor</span>}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>{u.email ?? <span style={{ color: "#555", fontStyle: "italic" }}>email not on file — will update on next login</span>}</div>
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: "right", fontSize: 11, color: COLORS.textMuted }}>
                    <div style={{ color: "#a855f7", fontWeight: 600 }}>{confidenceLabel(u.confidenceScore ?? 50)}</div>
                    <div style={{ marginTop: 3 }}>🔥 {u.streak ?? 0}d streak</div>
                    <div style={{ marginTop: 3 }}>⭐ {(u.xpEarned ?? 0).toLocaleString()} XP</div>
                    <div style={{ marginTop: 3, color: COLORS.textDim }}>
                      {u.createdAt?.seconds ? new Date(u.createdAt.seconds * 1000).toLocaleDateString("en-GB") : "—"}
                    </div>
                  </div>
                  {!u.hasContributorBadge && (
                    <button
                      onClick={() => thankingUid === u.id ? setThankingUid(null) : openThankYou(u)}
                      style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                        background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.3)", color: "#06b6d4" }}>
                      💡 Thank You
                    </button>
                  )}
                </div>
              </div>

              {/* Inline compose area */}
              {thankingUid === u.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1e1e1e" }}>
                  <div style={{ fontSize: 11, color: "#06b6d4", fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
                    💌 Personal note to {u.name || u.email?.split("@")[0]}
                  </div>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    rows={3}
                    style={{ width: "100%", padding: "10px 12px", background: "#0d0d0d", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 8, color: COLORS.text, fontSize: 13, resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setThankingUid(null)}
                      style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", background: "transparent", border: "1px solid #2a2a2a", color: COLORS.textMuted }}>
                      Cancel
                    </button>
                    <button onClick={() => sendThankYou(u.id)} disabled={sending || !noteText.trim()}
                      style={{ padding: "6px 16px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: sending ? "wait" : "pointer",
                        background: "rgba(6,182,212,0.2)", border: "1px solid rgba(6,182,212,0.5)", color: "#06b6d4" }}>
                      {sending ? "Sending…" : "Send + Award Badge"}
                    </button>
                  </div>
                </div>
              )}
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
          {[...PLANS, ...FAMILY_PLANS.filter(p => p.price_monthly > 0)].map(p => {
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

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────

function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "adminLogs"), orderBy("timestamp", "desc"));
    const unsub = onSnapshot(q, snap => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const ACTION_LABELS = {
    admin_panel_opened: "Admin panel opened",
    account_deleted:    "Account deleted",
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Audit Log</PageTitle>
      <p style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20 }}>
        Real-time log of admin access and security events. Retained indefinitely.
      </p>
      {loading ? <Skeleton /> : logs.length === 0 ? <Empty>No audit events yet</Empty> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {logs.map(log => (
            <div key={log.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: log.action === "account_deleted" ? COLORS.red : "#22c55e", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{ACTION_LABELS[log.action] ?? log.action}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                  {log.adminEmail || log.uid || "—"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: COLORS.textDim, textAlign: "right", flexShrink: 0 }}>
                {log.timestamp?.seconds
                  ? new Date(log.timestamp.seconds * 1000).toLocaleString("en-GB", { timeZone: "Asia/Tokyo", hour12: false })
                  : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
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
    { key: "STRIPE_FOUNDING_COUPON_ID",      status: "set",     note: "15% founding member discount — coupon K1sGeMKk" },
    { key: "FIREBASE_API_KEY",               status: "set",     note: "Server-side Firestore key" },
    { key: "ELEVENLABS_API_KEY",              status: "set",     note: "Voice narration (server-side only — NO VITE_ prefix)" },
    { key: "VITE_APP_URL_PHONICS",           status: "set",     note: "monkeyphonics-jzkjzkbj.manus.space" },
    { key: "VITE_APP_URL_EIKEN",             status: "set",     note: "eiken.hsdos.ai" },
    { key: "VITE_APP_URL_SPEAK",             status: "set",     note: "speak-sweat-core.replit.app" },
    { key: "VITE_APP_URL_WONDERCAMP",        status: "set",     note: "wondercamp.hsdos.ai" },
    { key: "VITE_APP_URL_FAMILY",            status: "set",     note: "family-english-hear.replit.app" },
    { key: "VITE_APP_URL_SIPSWITCH",         status: "set",     note: "sip-switch.replit.app" },
    { key: "VITE_APP_URL_INNERKEY",          status: "set",     note: "innerkey.hsdos.ai" },
  ];

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageTitle>Platform Settings</PageTitle>

      <div style={{ marginBottom: 20, padding: 14, background: "#0a0a0a", border: "1px solid rgba(224,16,16,0.2)", borderRadius: 10, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7 }}>
        All secrets are stored in <strong style={{ color: COLORS.text }}>Netlify → Site config → Environment variables</strong>.<br />
        After adding or updating a key, redeploy for it to take effect: <code style={{ color: COLORS.red }}>Netlify → Deploys → Trigger deploy</code>.<br />
        Keys with <code style={{ color: "#4488ff" }}>VITE_</code> prefix are readable in the browser. Keys without it are server-side only (Netlify Functions).
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
          <pre style={{ background: "#0a0a0a", border: "1px solid #1e1e1e", borderRadius: 8, padding: 14, fontSize: 11, color: "#4488ff", overflowX: "auto" }}>{`POST https://app.hsdos.ai/api/intelligence

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

      <DpaCard />
    </div>
  );
}

// ── DPA TRACKING ──────────────────────────────────────────────────────────────

const DPA_VENDORS = [
  { id: "firebase",   name: "Firebase / Google Cloud", purpose: "Auth, Firestore database, storage",    dpaUrl: "https://firebase.google.com/terms/data-processing-terms" },
  { id: "stripe",     name: "Stripe",                  purpose: "Payments, subscriptions, billing",     dpaUrl: "https://stripe.com/legal/dpa" },
  { id: "elevenlabs", name: "ElevenLabs",              purpose: "AI voice synthesis (Jona)",            dpaUrl: "https://elevenlabs.io/privacy" },
  { id: "netlify",    name: "Netlify",                 purpose: "Hosting, serverless functions",        dpaUrl: "https://www.netlify.com/legal/data-processing-addendum" },
  { id: "anthropic",  name: "Anthropic (Claude)",      purpose: "AI chat & curriculum engine",          dpaUrl: "https://www.anthropic.com/legal/privacy" },
  { id: "google_ai",  name: "Google AI (Gemini)",      purpose: "Primary AI engine (Gemini 2.5 Flash)", dpaUrl: "https://ai.google.dev/terms" },
];

const DPA_STATUS_CYCLE = ["not_started", "pending", "signed"];
const DPA_STATUS_META  = {
  not_started: { label: "Not started", color: "#555",          bg: "#1a1a1a",                    border: "#2a2a2a" },
  pending:     { label: "Pending",     color: "#f59e0b",       bg: "rgba(245,158,11,0.08)",      border: "rgba(245,158,11,0.3)" },
  signed:      { label: "✓ Signed",   color: COLORS.success,  bg: "rgba(34,197,94,0.08)",       border: "rgba(34,197,94,0.3)" },
};

function DpaCard() {
  const [dpa, setDpa] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "adminConfig", "dpa"), snap => {
      if (snap.exists()) setDpa(snap.data());
    });
    return unsub;
  }, []);

  async function cycleStatus(vendorId) {
    const current = dpa[vendorId]?.status ?? "not_started";
    const next    = DPA_STATUS_CYCLE[(DPA_STATUS_CYCLE.indexOf(current) + 1) % DPA_STATUS_CYCLE.length];
    const now     = new Date().toISOString();
    const patch   = { [vendorId]: { status: next, updatedAt: now } };
    setDpa(prev  => ({ ...prev, ...patch }));
    setDoc(doc(db, "adminConfig", "dpa"), patch, { merge: true }).catch(() => {});
  }

  const allSigned  = DPA_VENDORS.every(v => (dpa[v.id]?.status ?? "not_started") === "signed");
  const signedCount = DPA_VENDORS.filter(v => (dpa[v.id]?.status ?? "not_started") === "signed").length;

  return (
    <Card title={`Vendor DPA Tracking — ${signedCount}/${DPA_VENDORS.length} signed`}>
      <p style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.7, marginTop: 0, marginBottom: 16 }}>
        Data Processing Agreements with third-party vendors. Required for GDPR / APPI compliance.
        Click a badge to cycle its status. Changes save instantly.
      </p>

      {allSigned && (
        <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontSize: 12, color: COLORS.success }}>
          All vendor DPAs signed. ✓
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {DPA_VENDORS.map(v => {
          const status = dpa[v.id]?.status ?? "not_started";
          const meta   = DPA_STATUS_META[status];
          const updatedAt = dpa[v.id]?.updatedAt;
          return (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 2 }}>{v.name}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{v.purpose}</div>
                {updatedAt && (
                  <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2 }}>
                    Updated {new Date(updatedAt).toLocaleDateString("en-GB")}
                  </div>
                )}
              </div>
              <a
                href={v.dpaUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 10, color: COLORS.red, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" }}
                onClick={e => e.stopPropagation()}
              >
                View DPA →
              </a>
              <button
                onClick={() => cycleStatus(v.id)}
                style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", borderRadius: 20, border: `1px solid ${meta.border}`, background: meta.bg, color: meta.color, flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.15s" }}
              >
                {meta.label}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── WARNINGS TAB ──────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  critical: { color: COLORS?.red ?? "#e01010", bg: "rgba(224,16,16,0.08)", border: "rgba(224,16,16,0.3)", label: "CRITICAL", dot: "#e01010" },
  warning:  { color: "#f59e0b",                bg: "rgba(245,158,11,0.07)",  border: "rgba(245,158,11,0.3)",  label: "WARNING",  dot: "#f59e0b" },
  info:     { color: "#4488ff",                bg: "rgba(68,136,255,0.06)",  border: "rgba(68,136,255,0.2)",  label: "INFO",     dot: "#4488ff" },
};

function WarningsTab({ warnings, loading }) {
  const [filter, setFilter] = useState("all");

  if (loading) return <div style={{ animation: "fadeIn 0.3s ease" }}><PageTitle>Upgrade Warnings</PageTitle><Skeleton /></div>;

  const visible = filter === "all" ? warnings : warnings.filter(w => w.level === filter);
  const counts  = {
    all:      warnings.length,
    critical: warnings.filter(w => w.level === "critical").length,
    warning:  warnings.filter(w => w.level === "warning").length,
    info:     warnings.filter(w => w.level === "info").length,
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <PageTitle>Upgrade Warnings</PageTitle>
          <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: -14, marginBottom: 20 }}>
            Live checks against your platform data. Address critical issues first.
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[
          { id: "all",      label: "All",      color: COLORS.textMuted },
          { id: "critical", label: "Critical", color: LEVEL_CONFIG.critical.color },
          { id: "warning",  label: "Warnings", color: LEVEL_CONFIG.warning.color },
          { id: "info",     label: "Info",     color: LEVEL_CONFIG.info.color },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: "7px 16px", borderRadius: 8, border: `1px solid ${filter === f.id ? f.color : "#2a2a2a"}`,
            background: filter === f.id ? `${f.color}15` : "transparent",
            color: filter === f.id ? f.color : COLORS.textMuted,
            fontSize: 12, fontWeight: filter === f.id ? 700 : 400, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {f.label}
            {counts[f.id] > 0 && (
              <span style={{
                background: f.color, color: f.id === "all" ? COLORS.bg : "#000",
                fontSize: 10, fontWeight: 800, minWidth: 16, height: 16, borderRadius: 8,
                display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
              }}>{counts[f.id]}</span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No {filter === "all" ? "" : filter + " "}issues</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted }}>Platform is healthy in this category.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visible.map(w => {
            const cfg = LEVEL_CONFIG[w.level] ?? LEVEL_CONFIG.info;
            return (
              <div key={w.id} style={{
                background: cfg.bg, border: `1px solid ${cfg.border}`,
                borderRadius: 12, padding: "18px 20px",
                borderLeft: `4px solid ${cfg.color}`,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{w.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: "2px 7px",
                        borderRadius: 4, background: cfg.color, color: w.level === "info" ? "#fff" : "#000",
                        textTransform: "uppercase",
                      }}>{cfg.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{w.title}</span>
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 10 }}>{w.detail}</div>
                    <div style={{
                      padding: "10px 14px", background: "rgba(0,0,0,0.3)", borderRadius: 8,
                      fontSize: 12, color: cfg.color, borderLeft: `3px solid ${cfg.color}`,
                    }}>
                      <span style={{ fontWeight: 700, marginRight: 6 }}>Action:</span>{w.action}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SUPPORT INBOX ─────────────────────────────────────────────────────────────

function SupportTab() {
  const [threads, setThreads]     = useState([]);
  const [selected, setSelected]   = useState(null);
  const [messages, setMessages]   = useState([]);
  const [reply, setReply]         = useState("");
  const [sending, setSending]     = useState(false);
  const bottomRef                  = useRef(null);

  // Live thread list
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "support"), orderBy("lastMessageAt", "desc")),
      snap => setThreads(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // Live messages for selected thread
  useEffect(() => {
    if (!selected) return;
    const unsub = onSnapshot(
      query(collection(db, "support", selected.id, "messages"), orderBy("createdAt", "asc")),
      snap => setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [selected?.id]);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages read by admin when thread selected
  useEffect(() => {
    if (!selected) return;
    messages.filter(m => m.from === "user" && !m.readByAdmin).forEach(m => {
      updateDoc(doc(db, "support", selected.id, "messages", m.id), { readByAdmin: true }).catch(() => {});
    });
    if (selected.unreadByAdmin) {
      updateDoc(doc(db, "support", selected.id), { unreadByAdmin: false }).catch(() => {});
    }
  }, [selected?.id, messages]);

  async function sendReply() {
    const trimmed = reply.trim();
    if (!trimmed || sending || !selected) return;
    setSending(true);
    setReply("");
    try {
      await setDoc(doc(db, "support", selected.id), {
        lastMessage:   trimmed,
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: false,
      }, { merge: true });
      await addDoc(collection(db, "support", selected.id, "messages"), {
        text:        trimmed,
        from:        "admin",
        createdAt:   serverTimestamp(),
        readByAdmin: true,
        readByUser:  false,
      });
    } catch (err) { console.error(err); }
    setSending(false);
  }

  const totalUnread = threads.filter(t => t.unreadByAdmin).length;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <PageTitle>Support Inbox</PageTitle>
        {totalUnread > 0 && (
          <span style={{ padding: "2px 10px", borderRadius: 20, background: COLORS.red, color: "#fff", fontSize: 11, fontWeight: 700 }}>
            {totalUnread} new
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, height: 540 }}>
        {/* Thread list */}
        <div style={{ width: 240, flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {threads.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, color: COLORS.textMuted }}>No messages yet</div>
          )}
          {threads.map(t => (
            <button key={t.id} onClick={() => setSelected(t)} style={{
              textAlign: "left", padding: "12px 14px",
              background: selected?.id === t.id ? "#1a0000" : COLORS.card,
              border: `1px solid ${selected?.id === t.id ? COLORS.red + "55" : "#1e1e1e"}`,
              borderRadius: 10, cursor: "pointer", color: COLORS.text,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                  {t.name || t.email}
                </span>
                {t.unreadByAdmin && (
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.red, flexShrink: 0 }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 2 }}>{t.email}</div>
              <div style={{ fontSize: 11, color: COLORS.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {t.lastMessage}
              </div>
            </button>
          ))}
        </div>

        {/* Conversation */}
        <div style={{
          flex: 1, background: COLORS.card, border: "1px solid #1e1e1e",
          borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {!selected ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>
              Select a conversation
            </div>
          ) : (
            <>
              {/* Conv header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e1e1e" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{selected.name || selected.email}</div>
                <div style={{ fontSize: 11, color: COLORS.textMuted }}>{selected.email}</div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
                {messages.map(m => (
                  <div key={m.id} style={{
                    display: "flex",
                    justifyContent: m.from === "admin" ? "flex-end" : "flex-start",
                    marginBottom: 10,
                  }}>
                    <div style={{
                      maxWidth: "75%", padding: "9px 13px",
                      borderRadius: m.from === "admin" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: m.from === "admin" ? COLORS.red : "#1e1e1e",
                      color: "#fff", fontSize: 13, lineHeight: 1.5,
                    }}>
                      {m.text}
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4, textAlign: m.from === "admin" ? "right" : "left" }}>
                        {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Reply */}
              <div style={{ padding: "10px 12px", borderTop: "1px solid #1e1e1e", display: "flex", gap: 8 }}>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Reply…"
                  rows={1}
                  style={{
                    flex: 1, padding: "9px 12px",
                    background: "#1a1a1a", border: "1px solid #2a2a2a",
                    borderRadius: 10, color: COLORS.text, fontSize: 13,
                    resize: "none", outline: "none", fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={sendReply}
                  disabled={!reply.trim() || sending}
                  style={{
                    padding: "9px 16px", borderRadius: 10, flexShrink: 0,
                    background: reply.trim() ? COLORS.red : "#1a1a1a",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                >Send</button>
              </div>
            </>
          )}
        </div>
      </div>
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

// ── FEEDBACK TAB ──────────────────────────────────────────────────────────────

const MOOD_META = {
  struggling: { emoji: "😫", label: "Struggling", color: "#e01010" },
  ok:         { emoji: "😊", label: "It's OK",    color: "#f59e0b" },
  loving_it:  { emoji: "❤️", label: "Loving it!", color: "#22c55e" },
};

function FeedbackTab() {
  const [responses, setResponses] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setResponses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const counts = { struggling: 0, ok: 0, loving_it: 0 };
  responses.forEach(r => { if (counts[r.mood] !== undefined) counts[r.mood]++; });
  const total = responses.length;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>User Feedback</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted }}>{total} response{total !== 1 ? "s" : ""} collected</div>
      </div>

      {/* Mood summary */}
      <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
        {Object.entries(MOOD_META).map(([id, m]) => (
          <div key={id} style={{
            flex: 1, padding: "16px 14px", background: COLORS.surface,
            border: `1px solid ${m.color}33`, borderRadius: 12, textAlign: "center",
          }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{m.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: m.color, marginBottom: 2 }}>{counts[id]}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.label}</div>
            {total > 0 && (
              <div style={{ marginTop: 8, height: 3, background: "#1a1a1a", borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${Math.round((counts[id] / total) * 100)}%`, background: m.color, borderRadius: 2, transition: "width 0.6s" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Response list */}
      {loading ? (
        <Skeleton />
      ) : responses.length === 0 ? (
        <Empty>No feedback yet — responses will appear here in real time.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {responses.map(r => {
            const m = MOOD_META[r.mood] ?? { emoji: "❓", label: r.mood, color: COLORS.textDim };
            const date = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : null;
            return (
              <div key={r.id} style={{
                padding: "14px 16px", background: COLORS.surface,
                border: `1px solid ${m.color}22`, borderRadius: 10,
                display: "flex", gap: 14, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 24, flexShrink: 0, marginTop: 1 }}>{m.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: r.comment ? 6 : 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>{r.name ?? r.email ?? "Anonymous"}</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: `${m.color}18`, border: `1px solid ${m.color}44`, color: m.color, fontWeight: 700 }}>{m.label}</span>
                      {r.trigger && <span style={{ fontSize: 10, color: COLORS.textDim, padding: "2px 6px", border: "1px solid #2a2a2a", borderRadius: 20 }}>{r.trigger}</span>}
                      {r.lang && <span style={{ fontSize: 10, color: COLORS.textDim }}>{r.lang === "jp" ? "🇯🇵" : "🇬🇧"}</span>}
                    </div>
                    {date && (
                      <span style={{ fontSize: 10, color: COLORS.textDim, flexShrink: 0 }}>
                        {date.toLocaleDateString("en-GB")} {date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                  {r.comment && (
                    <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, background: "#0d0d0d", padding: "8px 10px", borderRadius: 7, borderLeft: `3px solid ${m.color}55` }}>
                      "{r.comment}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
