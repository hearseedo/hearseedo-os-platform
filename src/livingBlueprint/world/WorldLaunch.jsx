import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { APPS } from "../../constants/apps";
import { auth } from "../../lib/firebase";
import { useSubscription } from "../../hooks/useSubscription";
import { getWorldAccess } from "../home/worldAccess";

// Rebuild prompt section 9 — "Launch behavior" for external/iframe Worlds:
// preserve signed-in identity, pass only short-lived access data, retain
// navigation back to HSDOS, never expose permanent tokens in client code,
// and clearly handle loading/timeout/permission/unavailable states.
// Mirrors the real SSO pattern already used by components/AppModal.jsx
// (sso_token=uid, id_token=fresh Firebase ID token, never a permanent key).
function buildIframeSrc(url, uid, idToken) {
  if (!url || !uid) return url;
  const u = new URL(url);
  u.searchParams.set("sso_token", uid);
  if (idToken) u.searchParams.set("id_token", idToken);
  return u.toString();
}

export default function WorldLaunch({ world, user }) {
  const navigate = useNavigate();
  const [idToken, setIdToken] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef(null);

  const subscription = useSubscription();
  const access = getWorldAccess(world, user, subscription);
  const app = world.iframeAppId ? APPS.find(a => a.id === world.iframeAppId) : null;

  useEffect(() => {
    if (!auth.currentUser) return;
    auth.currentUser.getIdToken().then(setIdToken).catch(() => {});
  }, []);

  useEffect(() => {
    if (!app?.iframeUrl || loaded) return;
    const timer = setTimeout(() => setBlocked(true), 20000);
    return () => clearTimeout(timer);
  }, [app?.iframeUrl, loaded]);

  useEffect(() => {
    return () => { if (iframeRef.current) { try { iframeRef.current.src = "about:blank"; } catch {} } };
  }, []);

  const BackLink = (
    <button onClick={() => navigate("/preview/shell")} style={{
      background: "none", border: "none", color: TOKENS.color.textMuted, cursor: "pointer",
      fontSize: TOKENS.font.size.sm, marginBottom: TOKENS.space[4], padding: 0,
    }}>
      ← Back to HSDOS
    </button>
  );

  // Permission state — never attempt the iframe if the account isn't entitled.
  if (access.status === "locked") {
    return (
      <div>
        {BackLink}
        <StateCard
          title={`${world.name} is locked`}
          detail={access.reason}
          action={{ label: access.unlockLabel, onClick: () => navigate(access.unlockPath) }}
        />
      </div>
    );
  }

  // Coming-soon experiences (e.g. Monkeys Unlock) — real status from
  // constants/apps.js, not a fake locked state.
  if (world.comingSoon) {
    return (
      <div>
        {BackLink}
        <StateCard title={`${world.name} is coming soon`} detail="This experience isn't launched yet." />
      </div>
    );
  }

  // Launch-behavior gap for "modal" Worlds (e.g. EIKEN) — honest, not faked.
  if (world.launch === "modal") {
    return (
      <div>
        {BackLink}
        <StateCard
          title={`${world.name} opens from the Dashboard`}
          detail="This World is a native in-app experience that doesn't have a standalone Living Blueprint route yet. It's reachable from the current Dashboard's app grid."
          action={{ label: "Go to Dashboard", onClick: () => navigate("/dashboard") }}
        />
      </div>
    );
  }

  // Unavailable state — no iframe URL configured for this environment.
  if (!app?.iframeUrl) {
    return (
      <div>
        {BackLink}
        <StateCard
          title={`${world.name} is unavailable right now`}
          detail="No launch URL is configured for this environment."
        />
      </div>
    );
  }

  // Timeout / blocked state.
  if (blocked) {
    return (
      <div>
        {BackLink}
        <StateCard
          title={`${world.name} didn't load`}
          detail="It may be blocked by a browser extension or network setting."
          action={{ label: "Open in a new tab", onClick: () => window.open(buildIframeSrc(app.iframeUrl, user?.uid, idToken), "_blank") }}
        />
      </div>
    );
  }

  return (
    <div>
      {BackLink}
      <div style={{ position: "relative", borderRadius: TOKENS.radius.lg, overflow: "hidden", border: `1px solid ${TOKENS.color.border}`, height: "70vh", minHeight: 480 }}>
        {!loaded && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: TOKENS.color.surfaceRaised, color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
            Loading {world.name}…
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={buildIframeSrc(app.iframeUrl, user?.uid, idToken)}
          title={world.name}
          onLoad={() => setLoaded(true)}
          style={{ width: "100%", height: "100%", border: "none", opacity: loaded ? 1 : 0 }}
        />
      </div>
    </div>
  );
}

function StateCard({ title, detail, action }) {
  return (
    <div style={{
      padding: TOKENS.space[5], borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`,
      background: TOKENS.color.surfaceRaised, textAlign: "center", maxWidth: 480, margin: "40px auto",
    }}>
      <div style={{ fontWeight: 800, fontSize: TOKENS.font.size.lg, marginBottom: 8 }}>{title}</div>
      <div style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm, marginBottom: action ? 20 : 0, lineHeight: 1.5 }}>{detail}</div>
      {action && (
        <button onClick={action.onClick} style={{
          padding: "10px 24px", borderRadius: TOKENS.radius.pill, border: "none",
          background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 800, cursor: "pointer",
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
