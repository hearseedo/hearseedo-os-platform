// Phase 2 — shared pathway entry point (/family, /student, /adult,
// /educator all render this, parameterized by pathwayId). Deliberately
// NOT a pathway dashboard — those are later phases (Confidence AI Alpha,
// HSD Family Beta foundation). This page's job is just: confirm the
// account is in the right pathway/profile context, resolve profile
// selection where needed (the Family "Who's learning?" flow), record that
// the pathway was entered, and bridge into the existing, fully-functional
// Dashboard.jsx rather than faking a new one.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { PATHWAYS } from "../constants/pathways";
import { SELF_PROFILE_ID } from "../lib/profiles";

export default function PathwayEntry({ pathwayId }) {
  const { user, profiles, currentProfile, setActiveProfile, setActivePathway } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [visited, setVisited] = useState(false);
  const pathway = PATHWAYS[pathwayId];

  // Record entry into this pathway once per mount (updates lastUsedPathway,
  // visitedPathways, and fires the pathway_selected/switched analytics —
  // all via the single setActivePathway() in useAuth, never duplicated here).
  useEffect(() => {
    setActivePathway(pathwayId).finally(() => setVisited(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathwayId]);

  // Family with more than one selectable profile (self + at least one
  // child) shows the lightweight "Who's learning?" picker before
  // continuing — the minimal version of the future flow item 9 describes.
  // Every other pathway (and a Family account with only the self profile)
  // auto-resolves to "self" and skips straight to the continue step.
  const needsProfilePicker = pathwayId === "family" && profiles.length > 1;
  const [pickedProfile, setPickedProfile] = useState(needsProfilePicker ? null : SELF_PROFILE_ID);

  useEffect(() => {
    if (!needsProfilePicker && currentProfile?.id !== SELF_PROFILE_ID) {
      setActiveProfile(SELF_PROFILE_ID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsProfilePicker]);

  if (!user || !visited) return null;

  function choose(profileId) {
    setPickedProfile(profileId);
    setActiveProfile(profileId);
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0a", color: "#fff",
      padding: "48px 20px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <button
        onClick={() => navigate("/choose-path")}
        style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer", marginBottom: 32 }}
      >
        {t("path_back_to_selector")}
      </button>

      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: pathway.accent.primary, marginBottom: 10 }}>
          {pathway.displayName}
        </div>
        <p style={{ fontSize: 15, color: "#ccc", marginBottom: 32 }}>{pathway.tagline}</p>

        {needsProfilePicker && !pickedProfile ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>{t("path_whos_learning")}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 16 }}>
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => choose(p.id)}
                  style={{
                    padding: "14px 20px", borderRadius: 12, border: `1px solid ${pathway.accent.primary}55`,
                    background: "#141414", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  {p.name}{p.id === SELF_PROFILE_ID ? ` (${user.name?.split(" ")[0] ?? "Me"} — ${t("path_state_continue")})` : ""}
                </button>
              ))}
            </div>
            {pathwayId === "family" && (
              <button onClick={() => navigate("/family/add-child")} style={{ background: "none", border: "none", color: pathway.accent.primary, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                + {t("path_add_profile")}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={() => navigate(pathwayId === "family" ? "/family/home" : "/dashboard")}
            style={{
              width: "100%", padding: 16, borderRadius: 12, border: "none",
              background: pathway.accent.primary, color: "#0a0700", fontSize: 16, fontWeight: 800, cursor: "pointer",
            }}
          >
            {t("nav_home")} →
          </button>
        )}
        {pathwayId === "family" && !needsProfilePicker && (
          <button onClick={() => navigate("/family/add-child")} style={{ marginTop: 12, background: "none", border: "none", color: pathway.accent.primary, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            + {t("path_add_profile")}
          </button>
        )}
      </div>
    </div>
  );
}
