// Phase 2 — pathway entitlement route guard. The ONE place that enforces
// "can this account actually be here" for any pathway route, using the
// Phase 1 data-authoritative resolver (useAuth's pathwayStates, itself
// derived from getAccessiblePathways() — real Firestore-backed entitlement,
// never a client-side toggle). A locked or coming-soon pathway cannot be
// entered by typing its URL directly — this runs regardless of how the
// route was reached.
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { PATHWAY_STATES } from "../lib/pathwayAccess";
import { subscribeToFamilyFlags, DEFAULT_FLAGS } from "../family/familyFlags";

export default function PathwayRoute({ pathwayId, children }) {
  const { loading, pathwayStates } = useAuth();
  // Phase 4 (item 23) — Family's own kill switch, checked alongside
  // entitlement. Only actually subscribed for pathwayId === "family" so
  // Student/Adult/Educator routes aren't affected by it.
  const [flags, setFlags] = useState(DEFAULT_FLAGS);
  useEffect(() => {
    if (pathwayId !== "family") return;
    return subscribeToFamilyFlags(setFlags);
  }, [pathwayId]);

  if (loading) return null;

  const state = pathwayStates?.[pathwayId];
  if (state === PATHWAY_STATES.LOCKED || state === PATHWAY_STATES.COMING_SOON) {
    return <Navigate to="/choose-path" replace state={{ blockedPathway: pathwayId, reason: state }} />;
  }
  if (pathwayId === "family" && !flags.familyEnabled) {
    return <Navigate to="/choose-path" replace state={{ blockedPathway: pathwayId, reason: "disabled" }} />;
  }
  return children;
}
