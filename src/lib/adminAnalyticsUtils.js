import { MOCK_SIGNUPS, MOCK_EVENTS } from "./mockAdminData";
import { ACCESS_CODES } from "../constants/accessCodes";

// Merge mock data with real localStorage activations
// TODO: Replace with Firestore queries / real-time subscriptions

export function getSignups() {
  const real  = JSON.parse(localStorage.getItem("hsd_admin_signups") || "[]");
  const merged = [...real];
  for (const mock of MOCK_SIGNUPS) {
    if (!merged.find(r => r.userId === mock.userId)) merged.push(mock);
  }
  return merged.sort((a, b) => new Date(b.signupTime) - new Date(a.signupTime));
}

export function getEvents() {
  const real  = JSON.parse(localStorage.getItem("hsd_admin_events") || "[]");
  const merged = [...real];
  for (const mock of MOCK_EVENTS) {
    if (!merged.find(r => r.eventId === mock.eventId)) merged.push(mock);
  }
  return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function getAdminMetrics(signups, events) {
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  const active  = signups.filter(s => s.accessStatus === "active");
  const expired = signups.filter(s => s.accessStatus === "expired");

  const creditsGranted = signups.reduce((a, s) => a + (s.aiCreditsGranted ?? 0), 0);
  const creditsUsed    = signups.reduce((a, s) => a + (s.aiCreditsUsed   ?? 0), 0);
  const creditsLeft    = signups.reduce((a, s) => a + (s.aiCreditsRemaining ?? 0), 0);

  const codeCounts = {};
  for (const s of signups) codeCounts[s.accessCodeUsed] = (codeCounts[s.accessCodeUsed] ?? 0) + 1;
  const topCode = Object.entries(codeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const pathCounts = {};
  for (const s of signups) pathCounts[s.selectedPath] = (pathCounts[s.selectedPath] ?? 0) + 1;
  const topPath = Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const typeCounts = {};
  for (const s of signups) typeCounts[s.userType] = (typeCounts[s.userType] ?? 0) + 1;
  const topType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const upgradeReady = signups.filter(s => (s.aiCreditsUsed ?? 0) >= 20 || (s.aiCreditsRemaining ?? 30) <= 5);

  return {
    totalSignups:      signups.length,
    signupsToday:      signups.filter(s => new Date(s.signupTime) >= today).length,
    activeUsers:       active.length,
    expiredUsers:      expired.length,
    creditsGranted,
    creditsUsed,
    avgCreditsUsed:    signups.length ? Math.round(creditsUsed / signups.length) : 0,
    creditsRemaining:  creditsLeft,
    topCode,
    topPath,
    topUserType:       topType,
    upgradeReady:      upgradeReady.length,
  };
}

export function getCodePerformance(signups) {
  return Object.entries(ACCESS_CODES).map(([code, def]) => {
    const users    = signups.filter(s => s.accessCodeUsed === code);
    const active   = users.filter(s => s.accessStatus === "active");
    const expired  = users.filter(s => s.accessStatus === "expired");
    const granted  = users.reduce((a, s) => a + (s.aiCreditsGranted ?? 0), 0);
    const used     = users.reduce((a, s) => a + (s.aiCreditsUsed    ?? 0), 0);
    const pathMap  = {};
    for (const u of users) pathMap[u.selectedPath] = (pathMap[u.selectedPath] ?? 0) + 1;
    const topPath  = Object.entries(pathMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const lastAct  = users.sort((a, b) => new Date(b.activatedAt ?? 0) - new Date(a.activatedAt ?? 0))[0]?.activatedAt;
    return {
      code, codeType: def.codeType, campaignCategory: def.campaignCategory,
      source: def.source, activations: users.length,
      activeUsers: active.length, expiredUsers: expired.length,
      creditsGranted: granted, creditsUsed: used,
      avgCreditsUsed: users.length ? Math.round(used / users.length) : 0,
      topPath, lastActivation: lastAct ?? null,
    };
  });
}

export function getEngagementStatus(signup) {
  const hoursSince = (new Date() - new Date(signup.signupTime)) / 3600000;
  if ((signup.aiCreditsUsed ?? 0) >= 20 || (signup.aiCreditsRemaining ?? 30) <= 5) return "Upgrade Candidate";
  if ((signup.sessionsCompleted ?? 0) >= 3) return "High Engagement";
  if ((signup.sessionsCompleted ?? 0) >= 1) return "Active User";
  if (hoursSince <= 24) return "New User";
  if ((signup.aiCreditsUsed ?? 0) === 0) return "Needs Onboarding";
  return "Low Engagement";
}

export function getFollowUpRecommendation(signup) {
  const status = getEngagementStatus(signup);
  const map = {
    "Upgrade Candidate": "High engagement. Good upgrade candidate.",
    "High Engagement":   "Very active. Prime time to introduce paid plan.",
    "Active User":       "Practicing regularly. Nurture toward upgrade.",
    "New User":          "Just signed up. Send a warm welcome.",
    "Needs Onboarding":  "Signed up but hasn't practiced. Send onboarding guide.",
    "Low Engagement":    "Low activity. Consider a check-in message.",
  };
  const extra = {
    "University":               " University user — send Career Ready or interview prep tip.",
    "Kindergarten":             " Kindergarten family — send phonics and parent-child practice tips.",
    "Family":                   " Family user — send family conversation activity.",
    "Teacher":                  " Teacher — send classroom support resources.",
    "Workshop / Event / Partner": " Workshop attendee — send follow-up and next steps.",
  };
  return (map[status] ?? "") + (extra[signup.campaignCategory] ?? "");
}

export function applyFilters(signups, filters) {
  return signups.filter(s => {
    if (filters.code && s.accessCodeUsed !== filters.code) return false;
    if (filters.category && s.campaignCategory !== filters.category) return false;
    if (filters.userType && s.userType !== filters.userType) return false;
    if (filters.path && s.selectedPath !== filters.path) return false;
    if (filters.status && s.accessStatus !== filters.status) return false;
    if (filters.creditUsage) {
      const used = s.aiCreditsUsed ?? 0;
      if (filters.creditUsage === "0"      && used !== 0)        return false;
      if (filters.creditUsage === "1-10"   && (used < 1  || used > 10)) return false;
      if (filters.creditUsage === "11-20"  && (used < 11 || used > 20)) return false;
      if (filters.creditUsage === "21-30"  && (used < 21 || used > 30)) return false;
      if (filters.creditUsage === "used_up" && (s.aiCreditsRemaining ?? 0) > 0) return false;
    }
    if (filters.dateFrom && new Date(s.signupTime) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo   && new Date(s.signupTime) > new Date(filters.dateTo))   return false;
    return true;
  });
}

export function exportCSV(rows, columns, filename) {
  const header = columns.map(c => c.label).join(",");
  const body   = rows.map(r => columns.map(c => `"${(r[c.key] ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob   = new Blob([header + "\n" + body], { type: "text/csv" });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function formatTimestamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
