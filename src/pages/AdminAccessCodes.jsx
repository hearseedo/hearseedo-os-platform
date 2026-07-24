import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSignups, getEvents, getAdminMetrics, getCodePerformance, getEngagementStatus, getFollowUpRecommendation, applyFilters, exportCSV, formatTimestamp, relativeTime } from "../lib/adminAnalyticsUtils";
import { ACCESS_CODES } from "../constants/accessCodes";

// ── Palette ───────────────────────────────────────────────────────────────────
const BG    = "#0a0a0a";
const CARD  = "#111111";
const CARD2 = "#141414";
const TEAL  = "#2ec4b6";
const GOLD  = "#f59e0b";
const RED   = "#e01010";
const GREEN = "#22c55e";
const MUTED = "#888";
const DIM   = "#444";
const WHITE = "#ffffff";
const BORDER = "#1e1e1e";

const CATEGORY_COLOR = {
  "Kindergarten":               "#f97316",
  "University":                 "#2ec4b6",
  "Family":                     "#3b82f6",
  "Teacher":                    "#8b5cf6",
  "Workshop / Event / Partner": "#f59e0b",
};

const STATUS_COLOR = {
  "active":       GREEN,
  "expired":      RED,
  "credits_used": GOLD,
};

const ENGAGEMENT_COLOR = {
  "Upgrade Candidate": GREEN,
  "High Engagement":   TEAL,
  "Active User":       "#3b82f6",
  "New User":          GOLD,
  "Needs Onboarding":  RED,
  "Low Engagement":    MUTED,
};

const EVENT_ICONS = {
  access_code_activated: "🎟️",
  ai_credit_used:        "⚡",
  session_completed:     "✅",
  low_credits:           "⚠️",
  credits_exhausted:     "🔴",
  access_expired:        "⏰",
};

// ── Simulate helpers ──────────────────────────────────────────────────────────
const CODES = Object.keys(ACCESS_CODES);
const PATHS = ["Kids Path", "Family Path", "University Path", "Adult Path"];
const TYPES = ["Parent", "University Student", "Teacher", "Adult Learner", "Workshop Attendee"];
const GOALS = ["Job interviews", "Phonics", "Study abroad", "Speaking confidence", "EIKEN practice", "Travel English", "Presentations"];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function simulateSignup() {
  const code  = randomFrom(CODES);
  const def   = ACCESS_CODES[code];
  const names = ["Haruki", "Sora", "Rin", "Kai", "Noa", "Hiro", "Ami", "Ren"];
  const name  = randomFrom(names) + " " + String.fromCharCode(65 + Math.floor(Math.random() * 26)) + ".";
  const email = name.toLowerCase().replace(/\s/g, ".").replace(/\./g, "_").slice(0, 8) + Math.floor(Math.random() * 999) + "@example.com";
  const record = {
    userId: "sim_" + Date.now(), name, email,
    userType: randomFrom(TYPES), accessCodeUsed: code,
    campaignCategory: def.campaignCategory, source: def.source,
    selectedPath: randomFrom(PATHS), mainGoal: randomFrom(GOALS),
    signupTime: new Date().toISOString(), lastActiveTime: new Date().toISOString(),
    aiCreditsGranted: 30, aiCreditsUsed: 0, aiCreditsRemaining: 30,
    accessStatus: "active", activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    sessionsCompleted: 0, confidenceScore: 0, savedPhrases: 0, badges: [],
  };
  const existing = JSON.parse(localStorage.getItem("hsd_admin_signups") || "[]");
  localStorage.setItem("hsd_admin_signups", JSON.stringify([record, ...existing]));
  const evs = JSON.parse(localStorage.getItem("hsd_admin_events") || "[]");
  evs.unshift({ eventId: "sim_" + Date.now(), timestamp: new Date().toISOString(), eventType: "access_code_activated", userId: record.userId, email, description: `Activated ${code}`, accessCodeUsed: code, campaignCategory: def.campaignCategory, learningPath: null, creditsRemaining: 30 });
  localStorage.setItem("hsd_admin_events", JSON.stringify(evs.slice(0, 200)));
  window.dispatchEvent(new Event("hsd_admin_update"));
}

function simulateCreditUse() {
  const signups = JSON.parse(localStorage.getItem("hsd_admin_signups") || "[]");
  const active  = signups.filter(s => s.aiCreditsRemaining > 0 && s.accessStatus === "active");
  if (!active.length) return;
  const target  = randomFrom(active);
  target.aiCreditsUsed      += 1;
  target.aiCreditsRemaining -= 1;
  target.lastActiveTime      = new Date().toISOString();
  const idx = signups.findIndex(s => s.userId === target.userId);
  if (idx >= 0) signups[idx] = target;
  localStorage.setItem("hsd_admin_signups", JSON.stringify(signups));
  const evs = JSON.parse(localStorage.getItem("hsd_admin_events") || "[]");
  evs.unshift({ eventId: "sim_" + Date.now(), timestamp: new Date().toISOString(), eventType: "ai_credit_used", userId: target.userId, email: target.email, description: `Used 1 AI credit in ${randomFrom(["interview practice", "speaking practice", "EIKEN practice", "presentation feedback"])}`, accessCodeUsed: target.accessCodeUsed, campaignCategory: target.campaignCategory, learningPath: target.selectedPath, creditsRemaining: target.aiCreditsRemaining });
  localStorage.setItem("hsd_admin_events", JSON.stringify(evs.slice(0, 200)));
  window.dispatchEvent(new Event("hsd_admin_update"));
}

function simulatePractice() {
  const signups = JSON.parse(localStorage.getItem("hsd_admin_signups") || "[]");
  const active  = signups.filter(s => s.accessStatus === "active");
  if (!active.length) return;
  const target  = randomFrom(active);
  target.sessionsCompleted  = (target.sessionsCompleted ?? 0) + 1;
  target.confidenceScore    = Math.min(5, (target.confidenceScore ?? 0) + 1);
  target.lastActiveTime     = new Date().toISOString();
  const idx = signups.findIndex(s => s.userId === target.userId);
  if (idx >= 0) signups[idx] = target;
  localStorage.setItem("hsd_admin_signups", JSON.stringify(signups));
  const evs = JSON.parse(localStorage.getItem("hsd_admin_events") || "[]");
  evs.unshift({ eventId: "sim_" + Date.now(), timestamp: new Date().toISOString(), eventType: "session_completed", userId: target.userId, email: target.email, description: `Completed ${randomFrom(["interview", "phonics", "speaking", "EIKEN", "presentation"])} session`, accessCodeUsed: target.accessCodeUsed, campaignCategory: target.campaignCategory, learningPath: target.selectedPath, creditsRemaining: target.aiCreditsRemaining });
  localStorage.setItem("hsd_admin_events", JSON.stringify(evs.slice(0, 200)));
  window.dispatchEvent(new Event("hsd_admin_update"));
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminAccessCodes() {
  const navigate = useNavigate();
  const [signups, setSignups]   = useState([]);
  const [events, setEvents]     = useState([]);
  const [metrics, setMetrics]   = useState({});
  const [codePerf, setCodePerf] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [activeTab, setActiveTab]       = useState("overview"); // overview | codes | users | feed | results
  const [filters, setFilters]           = useState({});
  const [pulse, setPulse]               = useState(false);

  const refresh = useCallback(() => {
    const s = getSignups();
    const e = getEvents();
    setSignups(s);
    setEvents(e);
    setMetrics(getAdminMetrics(s, e));
    setCodePerf(getCodePerformance(s));
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  }, []);

  useEffect(() => {
    refresh();
    // TODO: Replace with Firestore onSnapshot listeners
    window.addEventListener("hsd_admin_update", refresh);
    return () => window.removeEventListener("hsd_admin_update", refresh);
  }, [refresh]);

  const filtered = applyFilters(signups, filters);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* TopBar */}
      <div style={{ background: CARD, borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 50 }}>
        <button onClick={() => navigate("/admin")} style={{ background: "none", border: "none", color: MUTED, fontSize: 13, cursor: "pointer" }}>← Admin</button>
        <div style={{ width: 1, height: 18, background: DIM }} />
        <span style={{ fontWeight: 800, fontSize: 14 }}>Access Code Dashboard</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: pulse ? `0 0 8px ${GREEN}` : "none", transition: "box-shadow 0.3s" }} />
          <span style={{ fontSize: 11, color: MUTED }}>Live</span>
        </div>
      </div>

      {/* Simulation buttons */}
      <div style={{ padding: "12px 24px", background: "#0d0d0d", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: DIM, marginRight: 4 }}>Simulate:</span>
        <SimBtn label="New Signup" color="#3b82f6" onClick={simulateSignup} />
        <SimBtn label="AI Credit Use" color={GOLD} onClick={simulateCreditUse} />
        <SimBtn label="Practice Completed" color={GREEN} onClick={simulatePractice} />
        <span style={{ marginLeft: "auto", fontSize: 11, color: DIM }}>MVP — mock data + localStorage. Replace with Firestore for production.</span>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 24px", borderBottom: `1px solid ${BORDER}`, display: "flex", gap: 0 }}>
        {[["overview","Overview"],["codes","Code Performance"],["users","User Signups"],["feed","Activity Feed"],["results","Results"]].map(([id,label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{ padding: "14px 18px", background: "none", border: "none", borderBottom: activeTab === id ? `2px solid ${TEAL}` : "2px solid transparent", color: activeTab === id ? TEAL : MUTED, fontSize: 13, fontWeight: activeTab === id ? 700 : 400, cursor: "pointer", marginBottom: -1 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === "overview"  && <OverviewTab metrics={metrics} codePerf={codePerf} />}
        {activeTab === "codes"     && <CodesTab codePerf={codePerf} />}
        {activeTab === "users"     && <UsersTab signups={filtered} filters={filters} setFilters={setFilters} onSelect={setSelectedUser} />}
        {activeTab === "feed"      && <FeedTab events={events} />}
        {activeTab === "results"   && <ResultsTab signups={signups} />}
      </div>

      {/* User detail panel */}
      {selectedUser && (
        <UserDetailPanel user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      <div style={{ textAlign: "center", padding: "20px", fontSize: 11, color: DIM, borderTop: `1px solid ${BORDER}` }}>
        Privacy note: This admin panel shows usage and progress data, not private full conversation content.
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ metrics, codePerf }) {
  const cards = [
    { label: "Total Signups",         value: metrics.totalSignups   ?? 0, color: WHITE },
    { label: "Signups Today",         value: metrics.signupsToday   ?? 0, color: TEAL },
    { label: "Active Free Month",     value: metrics.activeUsers    ?? 0, color: GREEN },
    { label: "Expired",               value: metrics.expiredUsers   ?? 0, color: RED },
    { label: "Credits Granted",       value: metrics.creditsGranted ?? 0, color: GOLD },
    { label: "Credits Used",          value: metrics.creditsUsed    ?? 0, color: GOLD },
    { label: "Avg Credits / User",    value: metrics.avgCreditsUsed ?? 0, color: WHITE },
    { label: "Credits Remaining",     value: metrics.creditsRemaining ?? 0, color: GREEN },
    { label: "Top Code",              value: metrics.topCode        ?? "—", color: TEAL, small: true },
    { label: "Top Learning Path",     value: metrics.topPath        ?? "—", color: WHITE, small: true },
    { label: "Top User Type",         value: metrics.topUserType    ?? "—", color: WHITE, small: true },
    { label: "Upgrade Candidates",    value: metrics.upgradeReady   ?? 0, color: GREEN },
  ];
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: c.small ? 16 : 28, fontWeight: 800, color: c.color, lineHeight: 1.1 }}>{c.value}</div>
          </div>
        ))}
      </div>
      <SectionTitle>Code Performance Snapshot</SectionTitle>
      <CodesTable rows={codePerf} compact />
    </>
  );
}

// ── Codes Tab ─────────────────────────────────────────────────────────────────

function CodesTab({ codePerf }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 8 }}>
        <ExportBtn label="Export CSV" onClick={() => exportCSV(codePerf, [
          { key: "code", label: "Code" }, { key: "codeType", label: "Type" },
          { key: "campaignCategory", label: "Category" }, { key: "activations", label: "Activations" },
          { key: "activeUsers", label: "Active" }, { key: "creditsUsed", label: "Credits Used" },
          { key: "avgCreditsUsed", label: "Avg Credits" }, { key: "topPath", label: "Top Path" },
        ], "code-performance.csv")} />
      </div>
      <CodesTable rows={codePerf} />
    </>
  );
}

function CodesTable({ rows, compact }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: compact ? 12 : 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {["Code","Category","Activations","Active","Expired","Credits Granted","Credits Used","Avg Credits","Top Path","Last Activation"].map(h => (
              <Th key={h}>{h}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.code} style={{ borderBottom: `1px solid #0f0f0f` }}>
              <Td><span style={{ fontFamily: "monospace", color: TEAL, fontWeight: 700 }}>{r.code}</span></Td>
              <Td><CategoryBadge cat={r.campaignCategory} /></Td>
              <Td bold>{r.activations}</Td>
              <Td color={GREEN}>{r.activeUsers}</Td>
              <Td color={r.expiredUsers ? RED : MUTED}>{r.expiredUsers}</Td>
              <Td>{r.creditsGranted}</Td>
              <Td>{r.creditsUsed}</Td>
              <Td>{r.avgCreditsUsed}</Td>
              <Td color={MUTED}>{r.topPath}</Td>
              <Td color={DIM}>{r.lastActivation ? relativeTime(r.lastActivation) : "—"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ signups, filters, setFilters, onSelect }) {
  const allCodes = Object.keys(ACCESS_CODES);
  const allCats  = [...new Set(Object.values(ACCESS_CODES).map(c => c.campaignCategory))];

  return (
    <>
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20, padding: 16, background: CARD2, borderRadius: 12, border: `1px solid ${BORDER}` }}>
        <FilterSelect label="Code" value={filters.code ?? ""} onChange={v => setFilters(f => ({ ...f, code: v || undefined }))} options={allCodes} />
        <FilterSelect label="Category" value={filters.category ?? ""} onChange={v => setFilters(f => ({ ...f, category: v || undefined }))} options={allCats} />
        <FilterSelect label="Status" value={filters.status ?? ""} onChange={v => setFilters(f => ({ ...f, status: v || undefined }))} options={["active","expired"]} />
        <FilterSelect label="Path" value={filters.path ?? ""} onChange={v => setFilters(f => ({ ...f, path: v || undefined }))} options={["Kids Path","Family Path","University Path","Adult Path"]} />
        <FilterSelect label="Credits Used" value={filters.creditUsage ?? ""} onChange={v => setFilters(f => ({ ...f, creditUsage: v || undefined }))} options={["0","1-10","11-20","21-30","used_up"]} />
        <button onClick={() => setFilters({})} style={{ padding: "6px 12px", borderRadius: 8, background: "none", border: `1px solid ${DIM}`, color: MUTED, fontSize: 12, cursor: "pointer" }}>Clear</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportBtn label="Export CSV" onClick={() => exportCSV(signups, [
            { key: "name", label: "Name" }, { key: "email", label: "Email" }, { key: "userType", label: "User Type" },
            { key: "accessCodeUsed", label: "Code" }, { key: "campaignCategory", label: "Category" },
            { key: "selectedPath", label: "Path" }, { key: "mainGoal", label: "Goal" },
            { key: "signupTime", label: "Signup" }, { key: "aiCreditsUsed", label: "Credits Used" },
            { key: "aiCreditsRemaining", label: "Credits Left" }, { key: "accessStatus", label: "Status" },
            { key: "sessionsCompleted", label: "Sessions" },
          ], "user-signups.csv")} />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["Name","Email","Type","Code","Path","Goal","Signup","Last Active","Credits","Status","Engagement"].map(h => (
                <Th key={h}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {signups.map(s => {
              const eng = getEngagementStatus(s);
              return (
                <tr key={s.userId} onClick={() => onSelect(s)} style={{ borderBottom: `1px solid #0f0f0f`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#161616"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Td bold>{s.name}</Td>
                  <Td color={MUTED}>{s.email}</Td>
                  <Td color={MUTED}>{s.userType}</Td>
                  <Td><span style={{ fontFamily: "monospace", color: TEAL, fontSize: 11 }}>{s.accessCodeUsed}</span></Td>
                  <Td color={MUTED}>{s.selectedPath}</Td>
                  <Td color={MUTED}>{s.mainGoal || "—"}</Td>
                  <Td color={DIM}>{relativeTime(s.signupTime)}</Td>
                  <Td color={DIM}>{relativeTime(s.lastActiveTime)}</Td>
                  <Td>
                    <CreditBar used={s.aiCreditsUsed ?? 0} total={s.aiCreditsGranted ?? 30} />
                  </Td>
                  <Td>
                    <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[s.accessStatus] ?? MUTED, background: `${STATUS_COLOR[s.accessStatus] ?? MUTED}18`, padding: "2px 8px", borderRadius: 20 }}>
                      {s.accessStatus?.toUpperCase()}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 10, fontWeight: 700, color: ENGAGEMENT_COLOR[eng] ?? MUTED }}>
                      {eng}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {signups.length === 0 && <p style={{ textAlign: "center", color: MUTED, padding: 32 }}>No signups match current filters.</p>}
      </div>
    </>
  );
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function FeedTab({ events }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 8 }}>
        <ExportBtn label="Export CSV" onClick={() => exportCSV(events, [
          { key: "timestamp", label: "Time" }, { key: "email", label: "Email" },
          { key: "eventType", label: "Event" }, { key: "description", label: "Description" },
          { key: "accessCodeUsed", label: "Code" }, { key: "learningPath", label: "Path" },
          { key: "creditsRemaining", label: "Credits Left" },
        ], "activity-feed.csv")} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {events.slice(0, 100).map(ev => (
          <div key={ev.eventId} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: CARD, borderRadius: 8, borderLeft: `2px solid ${CATEGORY_COLOR[ev.campaignCategory] ?? DIM}` }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{EVENT_ICONS[ev.eventType] ?? "📌"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: DIM, fontFamily: "monospace" }}>{formatTimestamp(ev.timestamp)}</span>
              <span style={{ fontSize: 12, color: WHITE, margin: "0 8px" }}>—</span>
              <span style={{ fontSize: 12, color: MUTED }}>{ev.email}</span>
              <span style={{ fontSize: 12, color: WHITE, margin: "0 8px" }}>{ev.description}</span>
              {ev.creditsRemaining !== undefined && (
                <span style={{ fontSize: 11, color: ev.creditsRemaining <= 5 ? GOLD : DIM }}>{ev.creditsRemaining} credits left</span>
              )}
            </div>
            {ev.accessCodeUsed && (
              <span style={{ fontSize: 10, fontFamily: "monospace", color: TEAL, flexShrink: 0 }}>{ev.accessCodeUsed}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

// ── Results Tab ───────────────────────────────────────────────────────────────

function ResultsTab({ signups }) {
  const total    = signups.length;
  const sessions = signups.reduce((a, s) => a + (s.sessionsCompleted ?? 0), 0);
  const avgConf  = total ? (signups.reduce((a, s) => a + (s.confidenceScore ?? 0), 0) / total).toFixed(1) : 0;
  const highEng  = signups.filter(s => (s.sessionsCompleted ?? 0) >= 3);
  const lowEng   = signups.filter(s => (s.sessionsCompleted ?? 0) === 0 && (s.aiCreditsUsed ?? 0) === 0);
  const heavy    = signups.filter(s => (s.aiCreditsUsed ?? 0) >= 20);

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total Sessions Completed", value: sessions, color: TEAL },
          { label: "Avg Confidence Score", value: `${avgConf} / 5`, color: GOLD },
          { label: "High Engagement Users (3+ sessions)", value: highEng.length, color: GREEN },
          { label: "Need Onboarding (0 activity)", value: lowEng.length, color: RED },
          { label: "Heavy AI Users (20+ credits)", value: heavy.length, color: GOLD },
        ].map(c => (
          <div key={c.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <SectionTitle>User Engagement Breakdown</SectionTitle>
      <div style={{ overflowX: "auto", marginBottom: 32 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["Name","Code","Sessions","Confidence","Credits Used","Path","Engagement"].map(h => <Th key={h}>{h}</Th>)}
            </tr>
          </thead>
          <tbody>
            {[...signups].sort((a, b) => (b.sessionsCompleted ?? 0) - (a.sessionsCompleted ?? 0)).map(s => {
              const eng = getEngagementStatus(s);
              return (
                <tr key={s.userId} style={{ borderBottom: `1px solid #0f0f0f` }}>
                  <Td bold>{s.name}</Td>
                  <Td><span style={{ fontFamily: "monospace", color: TEAL, fontSize: 11 }}>{s.accessCodeUsed}</span></Td>
                  <Td bold color={TEAL}>{s.sessionsCompleted ?? 0}</Td>
                  <Td>
                    <ConfidenceDots score={s.confidenceScore ?? 0} />
                  </Td>
                  <Td><CreditBar used={s.aiCreditsUsed ?? 0} total={30} /></Td>
                  <Td color={MUTED}>{s.selectedPath}</Td>
                  <Td><span style={{ fontSize: 10, fontWeight: 700, color: ENGAGEMENT_COLOR[eng] ?? MUTED }}>{eng}</span></Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── User Detail Panel ─────────────────────────────────────────────────────────

function UserDetailPanel({ user, onClose }) {
  const eng = getEngagementStatus(user);
  const rec = getFollowUpRecommendation(user);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.6)" }} />
      <div style={{ width: "min(420px, 100vw)", background: "#0d0d0d", borderLeft: `1px solid ${BORDER}`, overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>User Detail</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: MUTED, fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>{user.name}</div>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>{user.email}</div>

        {[
          ["User Type",          user.userType],
          ["Access Code",        user.accessCodeUsed],
          ["Campaign",           user.campaignCategory],
          ["Activated",          formatTimestamp(user.activatedAt)],
          ["Expires",            formatTimestamp(user.expiresAt)],
          ["Credits Granted",    user.aiCreditsGranted ?? 30],
          ["Credits Used",       user.aiCreditsUsed ?? 0],
          ["Credits Remaining",  user.aiCreditsRemaining ?? 0],
          ["Learning Path",      user.selectedPath],
          ["Main Goal",          user.mainGoal || "—"],
          ["Sessions Completed", user.sessionsCompleted ?? 0],
          ["Confidence Score",   `${user.confidenceScore ?? 0} / 5`],
          ["Saved Phrases",      user.savedPhrases ?? 0],
          ["Last Active",        relativeTime(user.lastActiveTime)],
        ].map(([label, val]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid #1a1a1a`, fontSize: 13 }}>
            <span style={{ color: MUTED }}>{label}</span>
            <span style={{ color: WHITE, fontWeight: 600, textAlign: "right", maxWidth: "55%" }}>{String(val)}</span>
          </div>
        ))}

        <div style={{ marginTop: 20, padding: 14, background: `${ENGAGEMENT_COLOR[eng] ?? MUTED}12`, border: `1px solid ${ENGAGEMENT_COLOR[eng] ?? DIM}44`, borderRadius: 10 }}>
          <div style={{ fontSize: 11, color: ENGAGEMENT_COLOR[eng], fontWeight: 700, marginBottom: 6 }}>{eng}</div>
          <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{rec}</div>
        </div>

        {(user.badges ?? []).length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Badges Earned</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {user.badges.map(b => (
                <span key={b} style={{ fontSize: 11, padding: "3px 10px", background: `${GOLD}18`, border: `1px solid ${GOLD}44`, borderRadius: 20, color: GOLD }}>{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function SectionTitle({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{children}</div>;
}

function Th({ children }) {
  return <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, color: DIM, fontWeight: 600, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{children}</th>;
}

function Td({ children, bold, color }) {
  return <td style={{ padding: "10px 12px", color: color ?? WHITE, fontWeight: bold ? 700 : 400, whiteSpace: "nowrap" }}>{children}</td>;
}

function CategoryBadge({ cat }) {
  const color = CATEGORY_COLOR[cat] ?? MUTED;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 20, padding: "2px 8px", whiteSpace: "nowrap" }}>
      {cat}
    </span>
  );
}

function CreditBar({ used, total }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  const col  = pct >= 90 ? RED : pct >= 60 ? GOLD : TEAL;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 60, height: 5, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 11, color: col }}>{used}/{total}</span>
    </div>
  );
}

function ConfidenceDots({ score }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i <= score ? GOLD : "#2a2a2a" }} />
      ))}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, color: DIM }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: "5px 10px", borderRadius: 6, background: "#1a1a1a", border: `1px solid ${DIM}`, color: WHITE, fontSize: 12, cursor: "pointer" }}>
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SimBtn({ label, color, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 6, background: `${color}18`, border: `1px solid ${color}44`, color, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      + {label}
    </button>
  );
}

function ExportBtn({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: "6px 14px", borderRadius: 8, background: "none", border: `1px solid ${TEAL}44`, color: TEAL, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      {label}
    </button>
  );
}
