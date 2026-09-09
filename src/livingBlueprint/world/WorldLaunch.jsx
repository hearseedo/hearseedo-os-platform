import { useEffect, useRef, useState, lazy, Suspense, Component } from "react";
import { useNavigate } from "react-router-dom";
import { TOKENS } from "../../constants/tokens";
import { APPS } from "../../constants/apps";
import { auth } from "../../lib/firebase";
import { useSubscription } from "../../hooks/useSubscription";
import { useLang } from "../../hooks/useLang";
import { getWorldAccess } from "../home/worldAccess";
import { t as translate } from "../../lib/i18n";

const EikenApp = lazy(() => import("../../pages/EikenApp"));

// Mirrors components/AppModal.jsx's EikenBoundary (module-private there) —
// EIKEN is a native React component, not an iframe, so it needs its own
// error boundary rather than the generic iframe timeout/unavailable states.
// A class component can't call useLang(), so it reads the saved language
// directly (same localStorage key useLang.jsx persists to).
class EikenBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      const lang = (() => { try { return localStorage.getItem("hsd-lang") ?? "en"; } catch { return "en"; } })();
      return (
        <StateCard
          title={translate(lang, "lb_eiken_hiccup")}
          detail={translate(lang, "lb_try_again_refresh")}
          action={{ label: translate(lang, "lb_try_again"), onClick: () => this.setState({ error: null }) }}
        />
      );
    }
    return this.props.children;
  }
}

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
  const { t } = useLang();
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
      {t("lb_back_to_hsdos")}
    </button>
  );

  // Coming-soon experiences (e.g. Monkeys Unlock, Sip Speak Learn) — checked
  // before the plan-lock state, since nobody can launch these yet regardless
  // of plan; showing "requires a paid plan" here would be misleading.
  if (world.comingSoon) {
    return (
      <div>
        {BackLink}
        <StateCard title={t("lb_world_coming_soon").replace("{world}", world.name)} detail={t("lb_experience_not_launched")} />
      </div>
    );
  }

  // Permission state — never attempt the iframe if the account isn't entitled.
  if (access.status === "locked") {
    return (
      <div>
        {BackLink}
        <StateCard
          title={t("lb_world_locked").replace("{world}", world.name)}
          detail={access.reason}
          action={{ label: access.unlockLabel, onClick: () => navigate(access.unlockPath) }}
        />
      </div>
    );
  }

  // "modal" Worlds — EIKEN is embedded directly (the real component, same
  // one AppModal.jsx renders live), not an iframe. Any future modal World
  // without a known embed falls back to an honest gap message instead of a
  // blank screen.
  if (world.launch === "modal") {
    if (world.id === "eiken") {
      return (
        <div>
          {BackLink}
          <div style={{ position: "relative", borderRadius: TOKENS.radius.lg, overflow: "hidden", border: `1px solid ${TOKENS.color.border}`, height: "75vh", minHeight: 560 }}>
            <EikenBoundary>
              <Suspense fallback={
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: TOKENS.color.surfaceRaised, color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm }}>
                  {t("lb_loading_eiken")}
                </div>
              }>
                <EikenApp user={user} activeMember={null} />
              </Suspense>
            </EikenBoundary>
          </div>
        </div>
      );
    }
    return (
      <div>
        {BackLink}
        <StateCard
          title={t("lb_world_opens_dashboard").replace("{world}", world.name)}
          detail={t("lb_world_dashboard_note")}
          action={{ label: t("lb_go_to_dashboard"), onClick: () => navigate("/dashboard") }}
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
          title={t("lb_world_unavailable").replace("{world}", world.name)}
          detail={t("lb_no_launch_url")}
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
          title={t("lb_world_failed_load").replace("{world}", world.name)}
          detail={t("lb_maybe_blocked")}
          action={{ label: t("lb_open_new_tab"), onClick: () => window.open(buildIframeSrc(app.iframeUrl, user?.uid, idToken), "_blank") }}
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
            {t("lb_loading_world").replace("{world}", world.name)}
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
