import { useParams } from "react-router-dom";
import { WORLDS_MAP } from "../constants/worlds";
import { useAuth } from "../hooks/useAuth";
import AppShell from "./components/AppShell";
import WorldLanding from "./world/WorldLanding";
import WorldLaunch from "./world/WorldLaunch";
import { TOKENS } from "../constants/tokens";

// Rebuild prompt section 9 — routes a World to the right template:
// internal Worlds get the landing page (hero + journey, stays in-shell);
// external/modal Worlds get the launch flow (iframe SSO or honest gap state).
export default function WorldPage() {
  const { worldId } = useParams();
  const { user } = useAuth();
  const world = WORLDS_MAP[worldId];

  if (!world) {
    return (
      <AppShell active="worlds">
        <div style={{ color: TOKENS.color.textMuted }}>Unknown World: {worldId}</div>
      </AppShell>
    );
  }

  return (
    <AppShell active="worlds">
      {world.launch === "internal"
        ? <WorldLanding world={world} user={user} />
        : <WorldLaunch world={world} user={user} />}
    </AppShell>
  );
}
