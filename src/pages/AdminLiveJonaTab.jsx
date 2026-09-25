// Admin — Talk with Jona (Gemini Live) usage/cost dashboard (2026-09-25).
// Deliberately small: operational visibility for the beta cost guardrails,
// not a general analytics product. See
// docs/JONA_LIVE_BETA_GUARDRAILS_2026-09-25.md for the full design this
// dashboard surfaces.
import { useEffect, useState } from "react";
import { collectionGroup, doc, setDoc, onSnapshot, query, orderBy, limit as fsLimit } from "firebase/firestore";
import { db } from "../lib/firebase";

const COLORS = {
  card: "#ffffff", border: "#e7ded0", text: "#1c1a16", textMuted: "#786f60", textDim: "#a89d89",
  red: "#e01010", success: "#1f9950", gold: "#b3760f", purple: "#6a4e96",
};

const END_REASON_LABELS = {
  user_end: "User ended", idle_timeout: "Idle timeout", session_limit: "5-min limit",
  monthly_limit: "Monthly limit", daily_limit: "Daily limit", profile_switch: "Profile switch",
  logout: "Logout", route_change: "Route change", connection_error: "Connection error",
  admin_disabled: "Admin disabled", safety: "Safety", unknown: "Unknown",
};

function todayJST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}
function thisMonthJST() {
  return todayJST().slice(0, 7);
}

function StatBox({ label, value, sub, color = COLORS.text }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 16px", minWidth: 130 }}>
      <div style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function AdminLiveJonaTab() {
  const [sessions, setSessions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [passcode, setPasscode]     = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]   = useState("");
  const [policy, setPolicy]         = useState(null);
  const [policyDraft, setPolicyDraft] = useState(null);
  const [policySaving, setPolicySaving] = useState(false);

  useEffect(() => {
    // liveSessions is a subcollection under every users/{uid} doc —
    // collectionGroup reads across all of them in one query. firestore.rules'
    // per-document rule (owner or isAdminEmail()) is evaluated per matched
    // doc, so this works for the signed-in admin the same way any other
    // admin-only collectionGroup read in this codebase does.
    const q = query(collectionGroup(db, "liveSessions"), orderBy("startedAt", "desc"), fsLimit(500));
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => {
        const data = d.data();
        // uid lives in the doc's own path: users/{uid}/liveSessions/{id}
        const uid = d.ref.parent.parent?.id ?? null;
        return { id: d.id, uid, ...data };
      }));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "killSwitch"), (snap) => {
      if (snap.exists()) setLiveEnabled(snap.data().geminiLiveEnabled ?? true);
    }, () => {});
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "liveBetaPolicy"), (snap) => {
      const d = snap.exists() ? snap.data() : {};
      const p = {
        monthlyMinutes: d.monthlyMinutes ?? 30, maxSessionMinutes: d.maxSessionMinutes ?? 5,
        dailySessions: d.dailySessions ?? 3, idleCheckSeconds: d.idleCheckSeconds ?? 45,
        idleDisconnectSeconds: d.idleDisconnectSeconds ?? 60,
      };
      setPolicy(p);
      setPolicyDraft((prev) => prev ?? p); // don't clobber an in-progress edit
    }, () => {});
    return () => unsub();
  }, []);

  async function toggleLive(nextEnabled) {
    if (!passcode.trim()) { setActionMsg("Enter passcode first"); return; }
    setActionLoading(true);
    setActionMsg("");
    try {
      const r = await fetch("/api/kill-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextEnabled ? "enable_gemini_live" : "disable_gemini_live", passcode: passcode.trim() }),
      });
      const data = await r.json();
      setActionMsg(r.ok ? `✓ Talk with Jona ${nextEnabled ? "enabled" : "disabled"}` : (data.error ?? "Error"));
    } catch { setActionMsg("Network error — check console"); }
    setActionLoading(false);
  }

  async function savePolicy() {
    setPolicySaving(true);
    try {
      await setDoc(doc(db, "config", "liveBetaPolicy"), { ...policyDraft }, { merge: true });
    } catch (e) {
      console.error("liveBetaPolicy save failed:", e.message);
    }
    setPolicySaving(false);
  }

  if (loading) return <div style={{ color: COLORS.textMuted, fontSize: 13 }}>Loading…</div>;

  const today = todayJST();
  const month = thisMonthJST();

  const todaySessions = sessions.filter((s) => s.startedAt?.toDate && s.startedAt.toDate().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }) === today);
  const monthSessions = sessions.filter((s) => s.startedAt?.toDate && s.startedAt.toDate().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" }).startsWith(month));

  const sumMinutes = (arr) => arr.reduce((s, x) => s + (Number(x.durationSeconds) || 0), 0) / 60;
  const uniqueAccounts = (arr) => new Set(arr.map((s) => s.uid).filter(Boolean)).size;

  const todayMinutes = sumMinutes(todaySessions);
  const monthMinutes = sumMinutes(monthSessions);
  const avgSessionMin = monthSessions.length ? monthMinutes / monthSessions.length : 0;
  const monthCostUSD  = monthSessions.reduce((s, x) => s + (Number(x.estimatedCostUSD) || 0), 0);

  const adminSessions = monthSessions.filter((s) => s.usageClass === "admin_test");
  const betaSessions   = monthSessions.filter((s) => s.usageClass !== "admin_test");

  const byEndReason = {};
  for (const s of monthSessions) {
    const r = s.endReason || "unknown";
    byEndReason[r] = (byEndReason[r] ?? 0) + 1;
  }

  const byAccount = {};
  for (const s of monthSessions) {
    if (!s.uid) continue;
    byAccount[s.uid] = byAccount[s.uid] ?? { minutes: 0, sessions: 0, usageClass: s.usageClass };
    byAccount[s.uid].minutes += (Number(s.durationSeconds) || 0) / 60;
    byAccount[s.uid].sessions += 1;
  }
  const topAccounts = Object.entries(byAccount).sort((a, b) => b[1].minutes - a[1].minutes).slice(0, 8);

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
        Talk with Jona (Gemini Live) — Beta Usage
      </div>

      {/* ── Kill switch ─────────────────────────────────────────────── */}
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: liveEnabled ? COLORS.success : COLORS.red, display: "inline-block" }} />
          <span style={{ fontWeight: 800, fontSize: 14 }}>Talk with Jona: {liveEnabled ? "ENABLED" : "DISABLED"}</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10 }}>
          Disabling prevents NEW sessions immediately (checked before every token mint). An already-open session is allowed to finish naturally, not force-cut.
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="password" placeholder="Passcode" value={passcode} onChange={(e) => setPasscode(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${COLORS.border}`, fontSize: 13 }} />
          <button onClick={() => toggleLive(false)} disabled={actionLoading || !liveEnabled}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: actionLoading || !liveEnabled ? 0.5 : 1 }}>
            Disable
          </button>
          <button onClick={() => toggleLive(true)} disabled={actionLoading || liveEnabled}
            style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: COLORS.success, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: actionLoading || liveEnabled ? 0.5 : 1 }}>
            Enable
          </button>
          {actionMsg && <span style={{ fontSize: 12, color: COLORS.textMuted }}>{actionMsg}</span>}
        </div>
      </div>

      {/* ── Today ───────────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Today (JST)</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Live sessions" value={todaySessions.length} />
        <StatBox label="Live minutes" value={todayMinutes.toFixed(1)} />
        <StatBox label="Unique accounts" value={uniqueAccounts(todaySessions)} />
      </div>

      {/* ── This month ──────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>This Month (JST)</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Total sessions" value={monthSessions.length} />
        <StatBox label="Total minutes" value={monthMinutes.toFixed(1)} />
        <StatBox label="Avg session" value={`${avgSessionMin.toFixed(1)} min`} />
        <StatBox label="Unique accounts" value={uniqueAccounts(monthSessions)} />
        <StatBox label="Est. cost" value={`$${monthCostUSD.toFixed(2)}`} sub="estimated — see cost note below" color={COLORS.gold} />
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatBox label="Admin/test sessions" value={adminSessions.length} sub={`${sumMinutes(adminSessions).toFixed(1)} min`} color={COLORS.purple} />
        <StatBox label="Beta customer sessions" value={betaSessions.length} sub={`${sumMinutes(betaSessions).toFixed(1)} min`} color={COLORS.success} />
      </div>

      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 20, maxWidth: 640 }}>
        Est. cost uses a centralized, remotely-adjustable per-token rate (netlify/functions/_livePricingConfig.js) applied to whatever token counts Gemini's own usageMetadata reported per session — Google does not return an authoritative dollar figure, and the per-token rates are carried over from earlier live-verified research for a comparable model, not confirmed for the exact model in production use. Treat this as directional, not a bill.
      </div>

      {/* ── End reasons this month ──────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Sessions by End Reason (this month)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {Object.entries(byEndReason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
          <div key={reason} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: "6px 12px", fontSize: 12 }}>
            <strong>{count}</strong> {END_REASON_LABELS[reason] ?? reason}
          </div>
        ))}
        {Object.keys(byEndReason).length === 0 && <span style={{ fontSize: 12, color: COLORS.textDim }}>No sessions yet this month.</span>}
      </div>

      {/* ── Top accounts ─────────────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Top Accounts (this month)</div>
      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
        {topAccounts.length === 0 && <div style={{ padding: 14, fontSize: 12, color: COLORS.textDim }}>No usage yet this month.</div>}
        {topAccounts.map(([uid, v], i) => (
          <div key={uid} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < topAccounts.length - 1 ? `1px solid ${COLORS.border}` : "none", fontSize: 12 }}>
            <span style={{ fontFamily: "monospace", color: COLORS.textMuted }}>{uid.slice(0, 12)}…</span>
            <span>{v.sessions} sessions</span>
            <span>{v.minutes.toFixed(1)} min</span>
            <span style={{ color: v.usageClass === "admin_test" ? COLORS.purple : COLORS.success, fontWeight: 700 }}>
              {v.usageClass === "admin_test" ? "admin/test" : "beta"}
            </span>
          </div>
        ))}
      </div>

      {/* ── Beta limits editor ──────────────────────────────────────── */}
      <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textMuted, textTransform: "uppercase", marginBottom: 8 }}>Beta Limits (config/liveBetaPolicy)</div>
      {policyDraft && (
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 16, maxWidth: 480 }}>
          {[
            ["monthlyMinutes", "Monthly minutes / household"],
            ["maxSessionMinutes", "Max session length (min)"],
            ["dailySessions", "Daily sessions / household"],
            ["idleCheckSeconds", "Idle check-in (sec)"],
            ["idleDisconnectSeconds", "Idle total disconnect (sec)"],
          ].map(([key, label]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <label style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</label>
              <input
                type="number" value={policyDraft[key]}
                onChange={(e) => setPolicyDraft((p) => ({ ...p, [key]: Number(e.target.value) }))}
                style={{ width: 80, padding: "5px 8px", borderRadius: 6, border: `1px solid ${COLORS.border}`, fontSize: 13, textAlign: "right" }}
              />
            </div>
          ))}
          <button onClick={savePolicy} disabled={policySaving}
            style={{ width: "100%", padding: 9, borderRadius: 8, border: "none", background: COLORS.red, color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: policySaving ? 0.6 : 1 }}>
            {policySaving ? "Saving…" : "Save limits"}
          </button>
          {policy && JSON.stringify(policy) !== JSON.stringify(policyDraft) && (
            <div style={{ fontSize: 11, color: COLORS.gold, marginTop: 8 }}>Unsaved changes — takes effect on the next session mint, not retroactively.</div>
          )}
        </div>
      )}
    </div>
  );
}
