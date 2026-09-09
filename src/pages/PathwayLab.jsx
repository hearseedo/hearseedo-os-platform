// Phase 1 — minimal functional profile/pathway switcher, for validating the
// account/profile/pathway architecture before Phase 2 builds the real,
// polished pathway selector and Family dashboard. Not linked from any nav —
// reached only by navigating directly to /dev/pathway-lab, same pattern as
// the existing /dev/phonics-v2 route. Deliberately unstyled/functional only.
import { useAuth } from "../hooks/useAuth";
import { PATHWAYS, PATHWAY_IDS } from "../constants/pathways";
import { SELF_PROFILE_ID } from "../lib/profiles";

export default function PathwayLab() {
  const {
    user, isAdmin, accessiblePathways, profiles, currentProfile, currentPathway,
    setActivePathway, setActiveProfile,
  } = useAuth();

  if (!user) return <div style={{ padding: 24 }}>Not signed in.</div>;

  return (
    <div style={{ padding: 24, fontFamily: "monospace", maxWidth: 720 }}>
      <h1>Pathway / Profile Lab</h1>
      <p>Dev-only tool for Phase 1 — not part of the final UI.</p>

      <section style={{ marginBottom: 24 }}>
        <h2>currentAccount</h2>
        <pre>{JSON.stringify({ uid: user.uid, email: user.email, plan: user.plan, accountType: user.accountType, roles: user.roles, isAdmin }, null, 2)}</pre>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2>Accessible pathways: {JSON.stringify(accessiblePathways)}</h2>
        <p>currentPathway: <b>{currentPathway ?? "(none selected)"}</b></p>
        {PATHWAY_IDS.map(id => (
          <button
            key={id}
            disabled={!accessiblePathways.includes(id)}
            onClick={() => setActivePathway(id)}
            style={{ marginRight: 8, marginBottom: 8, opacity: accessiblePathways.includes(id) ? 1 : 0.4 }}
          >
            {PATHWAYS[id].displayName} ({id}){currentPathway === id ? " ✓" : ""}
          </button>
        ))}
      </section>

      <section>
        <h2>Profiles ({profiles.length})</h2>
        <p>currentProfile: <b>{currentProfile?.name ?? "(none)"}</b> (id: {currentProfile?.id})</p>
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => setActiveProfile(p.id)}
            style={{ marginRight: 8, marginBottom: 8 }}
          >
            {p.name}{p.id === SELF_PROFILE_ID ? " (self)" : ""}{currentProfile?.id === p.id ? " ✓" : ""}
          </button>
        ))}
      </section>
    </div>
  );
}
