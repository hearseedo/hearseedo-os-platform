// Phase 2 — pathway entitlement route guard. The ONE place that enforces
// "can this account actually be here" for any pathway route, using the
// Phase 1 data-authoritative resolver (useAuth's pathwayStates, itself
// derived from getAccessiblePathways() — real Firestore-backed entitlement,
// never a client-side toggle). A locked or coming-soon pathway cannot be
// entered by typing its URL directly — this runs regardless of how the
// route was reached.
//
// Phase 3.2 hardening (2026-09-12) — this guard used to only distinguish
// two states: `loading` (Firebase Auth itself still resolving) and
// "resolved" (pathwayStates has a real answer). But pathwayStates is
// derived from useAuth's `profile`/`familyMembers` Firestore listeners,
// which have their own load time AND their own failure mode (e.g. a
// Firestore rules gap) — neither of which `loading` reflects, since
// `loading` only tracks Firebase Auth. The bug this caused in practice: a
// denied Firestore read left `profile` at its default empty shape, which
// getAccessiblePathways() read as "no pathwayAccess, no subscriptions" —
// i.e. indistinguishable from a genuinely-locked account — so real,
// paying/entitled accounts got bounced to /choose-path as though they'd
// never had access at all. Now there are three distinct states:
// loading (blank, same as before) -> profile load error (a real,
// recoverable error screen, NEVER a redirect implying "locked") ->
// profile still loading (blank) -> resolved (the real LOCKED/COMING_SOON
// check, unchanged). No cached/previous pathwayStates value is ever used
// as a stand-in for a fresh answer.
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { resolvePathwayRouteAccess } from "../lib/pathwayRouteAccess";
import { subscribeToFamilyFlags, DEFAULT_FLAGS } from "../family/familyFlags";

// Phase 3.4 (2026-09-12): localized via t() (previously hardcoded English
// only — see docs/PHASE_3_3_DIAGNOSTICS.md). A "Retry" reload can't detect
// its own failure (the whole page re-mounts), so a safe return-navigation
// option is always shown alongside it rather than only appearing after a
// detected second failure — the family is never stuck with only a button
// that might not work.
function AccountLoadError({ onRetry, onReturn }) {
  const { t } = useLang();
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0700", padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: "center", color: "#fff" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{t("account_error_title")}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginBottom: 24, lineHeight: 1.6 }}>
          {t("account_error_body")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <button
            onClick={onRetry}
            style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: "#C9A84C", color: "#0a0700", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
          >
            {t("account_error_retry")}
          </button>
          <button
            onClick={onReturn}
            style={{ padding: "8px 16px", borderRadius: 12, border: "none", background: "none", color: "rgba(255,255,255,0.65)", fontWeight: 700, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}
          >
            {t("account_error_return")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PathwayRoute({ pathwayId, children }) {
  const { loading, profileReady, profileError, pathwayStates } = useAuth();
  const navigate = useNavigate();
  // Phase 4 (item 23) — Family's own kill switch, checked alongside
  // entitlement. Only actually subscribed for pathwayId === "family" so
  // Student/Adult/Educator routes aren't affected by it.
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  useEffect(() => {
    if (pathwayId !== "family") return;
    return subscribeToFamilyFlags(setFlags);
  }, [pathwayId]);

  const { decision, reason } = resolvePathwayRouteAccess({
    loading, profileError, profileReady,
    pathwayState: pathwayStates?.[pathwayId],
    pathwayId, familyEnabled: flags.familyEnabled,
  });

  if (decision === "loading") return null;
  // A load error is never treated as "locked" and never redirects — that
  // would tell a genuinely-entitled account it has no access, when the
  // real problem is that we couldn't confirm either way. Reloading re-runs
  // useAuth's listener setup from scratch (fresh subscription attempt).
  if (decision === "error") return <AccountLoadError onRetry={() => window.location.reload()} onReturn={() => navigate("/choose-path", { replace: true })} />;
  if (decision === "redirect") return <Navigate to="/choose-path" replace state={{ blockedPathway: pathwayId, reason }} />;
  return children;
}
