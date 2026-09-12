import { useEffect, useRef, useState, lazy, Suspense, Component } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useSubscription } from "../hooks/useSubscription";
import { useLang } from "../hooks/useLang";
import { auth } from "../lib/firebase";
import { processAppEvent } from "../lib/appEvents";
import { recordCurriculumProgressEvent } from "../family/curriculumProgress";
import { isPlausibleProgressPayload } from "../lib/progressMessageHandler";

const EikenApp = lazy(() => import("../pages/EikenApp"));

class EikenBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ height: "100%", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40, textAlign: "center" }}>
          <span style={{ fontSize: 40 }}>🐵</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Eiken AI Coach had a hiccup</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, maxWidth: 300, lineHeight: 1.6 }}>Please close this and try opening the app again. If the problem persists, try refreshing the page.</div>
          <button onClick={() => this.setState({ error: null })} style={{ padding: "12px 24px", background: "#e01010", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Try Again</button>
        </div>
      );
    }
    return this.props.children;
  }
}


// Security correction (Phase A/B review, 2026-09-10) — Firebase bearer
// tokens no longer travel in the URL for apps that implement the secure
// postMessage handshake (app.usesSecureHandshake: true, currently only
// Monkey Yoga V2). Those apps receive identity exclusively via the
// HSD_OS_READY -> HSD_OS_AUTH exchange below. Every other app keeps its
// existing sso_token/id_token-in-URL behavior completely unchanged — this
// is opt-in per app specifically so apps we haven't audited/updated can't
// be silently broken by this change.
//
// curriculumTarget (optional) lets a caller route straight to a specific
// Book/Lesson/section inside a sub-app instead of just its home screen —
// e.g. HSD Family opening Monkey Yoga V2 at the learner's actual curriculum
// position. profileId is the HSD Family learner profile ("self" or a
// familyMembers/{id}) — distinct from uid, and is a ROUTING HINT only,
// never treated as proof of authorization by anything that receives it.
function buildIframeSrc(url, uid, idToken, profileId, curriculumTarget, secure) {
  if (!url || !uid) return url;
  const u = new URL(url);
  if (!secure) {
    u.searchParams.set("sso_token", uid);
    if (idToken) u.searchParams.set("id_token", idToken);
  }
  if (profileId) u.searchParams.set("profile_id", profileId);
  if (curriculumTarget?.bookId) u.searchParams.set("book", String(curriculumTarget.bookId));
  if (curriculumTarget?.lessonId) u.searchParams.set("lesson", curriculumTarget.lessonId);
  if (curriculumTarget?.section) u.searchParams.set("section", curriculumTarget.section);
  return u.toString();
}

export default function AppModal({ app, onClose, user, activeMember, curriculumTarget }) {
  // SELF_PROFILE_ID ("self") mirrors src/lib/profiles.js's convention —
  // activeMember is null for the account owner's own (virtual) profile, so
  // without this fallback the owner's phonics progress would have no
  // profile_id at all and collide with nothing/be unattributable.
  const profileId = activeMember?.id ?? "self";
  const { isUnlocked } = useSubscription();
  const { t } = useLang();
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [idToken, setIdToken] = useState(null);
  const [ikbAcknowledged, setIkbAcknowledged] = useState(
    () => sessionStorage.getItem("ikb_disclaimer_ack") === "1"
  );


  // Fetch a fresh ID token when the modal opens — used by sub-apps for secure SSO
  useEffect(() => {
    if (!auth.currentUser) return;
    auth.currentUser.getIdToken().then(setIdToken).catch(() => {});
  }, [app?.id]);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  // Curriculum-progress sync status (correction, 2026-09-10). null = nothing
  // to report; { data } = the exact HSD_OS_PROGRESS payload (same eventId)
  // whose automatic retries were all exhausted — kept so "Retry now" can
  // resend the identical event rather than losing or re-deriving it. This
  // never reflects a confirmed duplicate (that's a successful sync) or a
  // non-retryable failure (nothing the family can do would fix it, so
  // nothing actionable is shown — it's logged for us to investigate).
  const [syncIssue, setSyncIssue] = useState(null);

  // Reset loader when app changes — all hooks must be before any early return
  useEffect(() => { setIframeLoaded(false); setIframeBlocked(false); setSyncIssue(null); }, [app?.id]);

  // Career Ready, Global Ready, and Speak Ready are native in-app pages, not iframe sub-apps — redirect instead of rendering the modal
  useEffect(() => {
    if (app?.id === "career-ready") {
      navigate("/career-ready");
      onClose();
    }
    if (app?.id === "global-ready") {
      navigate("/global-ready");
      onClose();
    }
    if (app?.id === "speak-ready") {
      navigate("/speak-ready");
      onClose();
    }
  }, [app?.id]);

  // Apps with launchMode "external" open in a new tab (with SSO token attached)
  // instead of an iframe modal — e.g. The HSD Album, a standalone static site.
  const externalOpenedRef = useRef(null);
  useEffect(() => {
    if (app?.launchMode !== "external") { externalOpenedRef.current = null; return; }
    if (externalOpenedRef.current === app.id) return;
    if (!user?.uid) return;

    if (idToken) {
      externalOpenedRef.current = app.id;
      window.open(buildIframeSrc(app.iframeUrl, user.uid, idToken, profileId, curriculumTarget, app?.usesSecureHandshake), "_blank", "noopener,noreferrer");
      onClose();
    } else {
      // Give the fresh-ID-token fetch a moment before opening without it.
      const timer = setTimeout(() => {
        if (externalOpenedRef.current === app.id) return;
        externalOpenedRef.current = app.id;
        window.open(buildIframeSrc(app.iframeUrl, user.uid, idToken, profileId, curriculumTarget, app?.usesSecureHandshake), "_blank", "noopener,noreferrer");
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [app?.id, app?.launchMode, user?.uid, idToken]);

  // Blank the iframe before closing — ends iOS scroll session so page scrolls again after
  function handleClose() {
    if (iframeRef.current) {
      try { iframeRef.current.src = "about:blank"; } catch {}
    }
    onClose();
  }

  // Detect iframe blocked — if no load after 20s, show fallback
  useEffect(() => {
    if (!app?.iframeUrl || iframeLoaded) return;
    const timer = setTimeout(() => setIframeBlocked(true), 20000);
    return () => clearTimeout(timer);
  }, [app?.id, app?.iframeUrl, iframeLoaded]);

  // Reacts to recordCurriculumProgressEvent()'s honest result (correction,
  // 2026-09-10, refined 2026-09-10 staging fix). Never assumes success.
  // `ok:true` (fresh write OR a confirmed duplicate) clears any prior
  // warning — FamilyParentView already only ever shows what's actually in
  // Firestore, so there's nothing optimistic to correct here, just the
  // banner. A `recoverable:true` result (every automatic retry exhausted)
  // shows the "still saving" banner with a manual retry. A non-retryable
  // failure (bad data, auth/permission/server bug — nothing a retry could
  // fix) is never silently discarded either: it shows a restrained,
  // non-actionable failure message instead, and is logged without the
  // event's own contents (no uid/profileId/lessonId in the console).
  function syncCurriculumStatus(eventData, curriculumSync) {
    if (!curriculumSync) return; // not a curriculum-aware event — nothing to report
    if (curriculumSync.ok) { setSyncIssue(null); return; } // fresh write OR confirmed duplicate — both are "synchronized"
    if (!curriculumSync.recoverable) {
      // Non-retryable failure (validation/auth/permission/server bug) — never
      // silently discarded, but never logged with the event's own contents
      // (lessonId/profileId/etc.) either; a category-only note is enough for
      // a developer to notice without exposing anything sensitive.
      console.warn("[curriculum-sync] non-retryable failure — see server logs for detail");
      setSyncIssue({ data: eventData, kind: "failed" });
      return;
    }
    setSyncIssue({ data: eventData, kind: "recoverable" });
  }

  // Manual retry (item 3: "allow the user to retry without losing the
  // attempt") — resends the EXACT SAME event object kept in syncIssue via
  // recordCurriculumProgressEvent() directly, NOT processAppEvent(). Only
  // the curriculum-progress write is idempotent (guarded by eventId) —
  // going back through processAppEvent() would also re-run the generic
  // learnerProfiles XP/engagement/skill update, which is NOT idempotent and
  // would double-count on every retry.
  async function retrySync() {
    if (!syncIssue || !user?.uid) return;
    const result = await recordCurriculumProgressEvent(user.uid, syncIssue.data.profileId ?? profileId, syncIssue.data);
    syncCurriculumStatus(syncIssue.data, result);
  }

  // postMessage bridge. Security correction (Phase A/B review): every
  // incoming message is now checked against the sub-app's own origin AND
  // must actually originate from this modal's own iframe window — a page
  // from any other origin, or a message merely claiming to be from the
  // iframe, is silently dropped before its type/fields are even inspected.
  // Every reply goes to that exact origin — "*" is never used for anything
  // that carries auth data.
  useEffect(() => {
    if (!app || !app.iframeUrl) return;
    const unlocked = isUnlocked(app.id);
    if (!unlocked) return;

    let expectedOrigin = null;
    try { expectedOrigin = new URL(app.iframeUrl).origin; } catch { /* malformed iframeUrl — no messages will validate, safe default */ }

    const handleMessage = async (e) => {
      if (!expectedOrigin || e.origin !== expectedOrigin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;

      const data = e.data;
      if (!data || typeof data !== "object" || typeof data.type !== "string") return;
      if (data.type !== "HSD_OS_READY" && data.type !== "HSD_OS_PROGRESS") return; // reject unknown message types

      if (data.type === "HSD_OS_READY") {
        const authPayload = {
          type:      "HSD_OS_AUTH",
          token:     user?.uid ?? "",
          studentId: user?.uid ?? "",
          profileId,
        };
        // Secure-handshake apps (Monkey Yoga V2) receive the real ID token
        // here instead of via the URL — see buildIframeSrc above.
        if (app?.usesSecureHandshake && idToken) authPayload.idToken = idToken;
        iframeRef.current?.contentWindow?.postMessage(authPayload, expectedOrigin);
      }

      if (data.type === "HSD_OS_PROGRESS" && user?.uid && isPlausibleProgressPayload(data)) {
        // Phase 3.4 (2026-09-12): the legacy users/{uid}/appProgress/{module}
        // client write that used to happen here has been removed outright —
        // an audit (docs/PHASE_3_3_DIAGNOSTICS.md, docs/PHASE_3_4_DATA_MODEL.md)
        // confirmed nothing anywhere in this codebase ever reads that
        // collection, so it was a pure, permanently-denied write with no
        // reader to preserve. processAppEvent() now routes engagement/skill
        // tracking through a server-authenticated endpoint instead of a
        // direct (also-denied) client Firestore write — see
        // src/lib/appEvents.js and netlify/functions/record-engagement-event.js.
        //
        // Fall back to this modal's own profileId if the sub-app didn't
        // echo one back — never leave a progress event unattributed to a
        // specific child.
        const enrichedEvent = { ...data, module: data.module ?? app.id, profileId: data.profileId ?? profileId };
        const result = await processAppEvent(user.uid, enrichedEvent);
        syncCurriculumStatus(enrichedEvent, result?.curriculumSync);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [app?.id, app?.iframeUrl, user?.uid, profileId, idToken]);

  if (!app || app.id === "career-ready" || app.id === "global-ready" || app.id === "speak-ready" || app.launchMode === "external") return null;

  const unlocked = isUnlocked(app.id);
  const accent   = app.accent ?? COLORS.red;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.92)",
        display: "flex", flexDirection: "column",
      }}
      onClick={handleClose}
    >
      {/* Header bar */}
      <div
        style={{
          height: 52, background: COLORS.surface,
          borderBottom: `1px solid ${accent}33`,
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 12, flexShrink: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {app.image
          ? <img src={app.image} alt={app.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          : <span style={{ fontSize: 22 }}>{app.icon}</span>
        }
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, display: "flex", alignItems: "center", gap: 8 }}>
            {app.name}
            {app.free && <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "1px 6px", letterSpacing: 1 }}>FREE</span>}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>{app.desc}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={handleClose}
          style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
        {app.id === "innerkey" && !ikbAcknowledged ? (
          <IkbDisclaimer onAccept={() => {
            sessionStorage.setItem("ikb_disclaimer_ack", "1");
            setIkbAcknowledged(true);
          }} onClose={handleClose} />
        ) : app.comingSoon ? (
          <ComingSoon app={app} accent={accent} t={t} />
        ) : unlocked ? (
          app.id === "eiken" ? (
            <EikenBoundary>
              <Suspense fallback={<div style={{ height: "100%", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted, fontSize: 13 }}>{t("loading")} Eiken AI Coach…</div>}>
                <EikenApp key={activeMember?.id || "self"} user={user} activeMember={activeMember} />
              </Suspense>
            </EikenBoundary>
          ) : app.iframeUrl ? (
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              {!iframeLoaded && (
                <div style={{
                  position: "absolute", inset: 0, background: "#0a0a0a",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  gap: 16, zIndex: 1,
                }}>
                  <div style={{
                    width: 40, height: 40, border: `3px solid ${accent}33`,
                    borderTop: `3px solid ${accent}`,
                    borderRadius: "50%", animation: "spin 0.8s linear infinite",
                  }} />
                  <div style={{ fontSize: 13, color: COLORS.textMuted }}>{t("loading")} {app.name}…</div>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
              {iframeBlocked ? (
                <div style={{
                  height: "100%", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 20,
                  background: COLORS.bg, padding: 40, textAlign: "center",
                }}>
                  <div style={{ fontSize: 40 }}>{app.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{app.name}</div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted, maxWidth: 300, lineHeight: 1.6 }}>
                    {t("app_best_in_window")}
                  </div>
                  <a
                    href={buildIframeSrc(app.iframeUrl, user?.uid, idToken, profileId, curriculumTarget, app?.usesSecureHandshake)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "14px 32px", borderRadius: 10, background: accent,
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      textDecoration: "none", display: "inline-block",
                    }}
                  >
                    {app.name} →
                  </a>
                </div>
              ) : idToken ? (
                <iframe
                  ref={iframeRef}
                  src={buildIframeSrc(app.iframeUrl, user?.uid, idToken, profileId, curriculumTarget, app?.usesSecureHandshake)}
                  title={app.name}
                  onLoad={() => setIframeLoaded(true)}
                  style={{ width: "100%", height: "100%", border: "none", background: "#0a0a0a", display: "block" }}
                  allow="microphone; camera; autoplay; fullscreen; storage-access"
                />
              ) : null}
              {/* Curriculum-progress sync status (correction, 2026-09-10,
                  refined in the staging fix) — non-blocking: the child keeps
                  playing either way. Never shown for a confirmed duplicate
                  (that's a success). Two distinct, honest states:
                  "recoverable" — every automatic retry exhausted, offers a
                  manual retry of the exact same event; "failed" — a
                  non-retryable failure (validation/auth/permission/server
                  bug) that a retry cannot fix, shown as a restrained
                  message with no retry affordance, so the family isn't
                  invited to retry something that will only fail again. */}
              {syncIssue && (
                <div style={{
                  position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 2,
                  background: "rgba(20,20,20,0.92)", border: `1px solid ${accent}55`,
                  borderRadius: 10, padding: "10px 14px",
                  display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                }}>
                  <span style={{ fontSize: 13, color: "#fff", flex: 1 }}>
                    {syncIssue.kind === "failed"
                      ? (t("progress_sync_failed") || "Progress could not be saved. Please reopen the activity or contact support.")
                      : (t("progress_sync_pending") || "Still saving progress — we'll keep trying.")}
                  </span>
                  {syncIssue.kind !== "failed" && (
                    <button
                      onClick={retrySync}
                      style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      {t("retry") || "Retry now"}
                    </button>
                  )}
                  <button
                    onClick={() => setSyncIssue(null)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#ccc", fontSize: 12, cursor: "pointer" }}
                  >
                    {t("dismiss") || "Dismiss"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <ComingSoon app={app} accent={accent} t={t} />
          )
        ) : (
          <LockedView app={app} accent={accent} t={t} />
        )}
      </div>
    </div>
  );
}

function ComingSoon({ app, accent, t }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
      background: COLORS.bg, padding: 40, textAlign: "center",
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: 16,
        border: `2px solid ${accent}`,
        overflow: "hidden",
        animation: "glowPulse 3s ease-in-out infinite",
        boxShadow: `0 0 20px ${accent}44`,
      }}>
        {app.image
          ? <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: `${accent}11` }}>{app.icon}</span>
        }
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{app.name}</div>
      <div style={{ fontSize: 15, color: accent, fontWeight: 600 }}>{t("launching_soon")}</div>
      <div style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 340, lineHeight: 1.6 }}>
        {t("early_access_list")}<br />
        {t("notify_when_live")}
      </div>
      <div style={{
        marginTop: 8, padding: "10px 20px",
        background: `${accent}11`, border: `1px solid ${accent}44`,
        borderRadius: 8, fontSize: 12, color: accent, letterSpacing: 1,
      }}>
        {t("access_confirmed")}
      </div>
    </div>
  );
}

function IkbDisclaimer({ onAccept, onClose }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      background: COLORS.bg, overflow: "auto",
    }}>
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        padding: "32px 24px 24px", maxWidth: 560, margin: "0 auto", width: "100%",
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>🔑</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, marginBottom: 6, textAlign: "center" }}>
          The Inner Key Blueprint™
        </div>
        <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 24 }}>
          Please read before entering
        </div>

        <div style={{
          background: "rgba(224,16,16,0.06)", border: "1px solid rgba(224,16,16,0.2)",
          borderRadius: 12, padding: "20px 20px", marginBottom: 20, width: "100%",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e01010", marginBottom: 10, letterSpacing: 0.5 }}>
            NOT THERAPY OR MEDICAL ADVICE
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
            The Inner Key Blueprint™ is an educational self-reflection tool. It is not therapy, counselling, psychiatric treatment, or medical advice. The creator is not a licensed healthcare or mental-health professional.
          </div>
        </div>

        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
          <strong style={{ color: COLORS.text }}>Your responsibility:</strong> Decisions or actions you take based on your personal interpretation of content in this app are your own. They do not constitute instructions or endorsements from Hear See Do™.
        </div>

        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 16 }}>
          <strong style={{ color: COLORS.text }}>AI responses</strong> within this app may not fully understand your circumstances. Do not rely on them for safety-critical decisions.
        </div>

        <div style={{
          background: "rgba(224,16,16,0.10)", border: "1px solid rgba(224,16,16,0.35)",
          borderRadius: 10, padding: "14px 16px", marginBottom: 24, width: "100%",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#e01010", lineHeight: 1.6 }}>
            If you are experiencing a mental-health crisis, thoughts of self-harm, or an immediate danger — close this app and contact local emergency services or a crisis-support line immediately.
          </div>
        </div>

        <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 24, textAlign: "center", lineHeight: 1.6 }}>
          Full details in our{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#e01010" }}>Terms of Service</a>
          {" "}and{" "}
          <a href="/disclaimer" target="_blank" rel="noopener noreferrer" style={{ color: "#e01010" }}>Educational Disclaimer</a>.
        </div>

        <button
          onClick={onAccept}
          style={{
            width: "100%", padding: "15px", background: "#f59e0b",
            border: "none", borderRadius: 10, color: "#000",
            fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12,
          }}
        >
          I understand — Enter The Inner Key Blueprint™
        </button>

        <button
          onClick={onClose}
          style={{
            width: "100%", padding: "12px", background: "transparent",
            border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.textMuted,
            fontSize: 13, cursor: "pointer",
          }}
        >
          Go back
        </button>
      </div>
    </div>
  );
}

function LockedView({ app, accent, t }) {
  return (
    <div style={{
      height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 20,
      background: COLORS.bg, padding: 40, textAlign: "center",
    }}>
      {/* Greyed app icon */}
      <div style={{
        width: 80, height: 80, borderRadius: 16,
        border: "2px solid #2a2a2a", overflow: "hidden",
        filter: "grayscale(1) opacity(0.4)",
      }}>
        {app.image
          ? <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 36, display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#1a1a1a" }}>{app.icon}</span>
        }
      </div>

      <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text }}>{app.name}</div>
      <div style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 360, lineHeight: 1.6 }}>
        {t("not_in_plan")}
      </div>

      {/* Primary upgrade CTA */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 340 }}>
        <a
          href="/plans"
          style={{
            display: "block", padding: "14px",
            background: COLORS.red, borderRadius: 10,
            color: "#fff", fontSize: 14, fontWeight: 700,
            textAlign: "center", textDecoration: "none",
            boxShadow: "0 0 20px rgba(224,16,16,0.35)",
          }}
        >
          {t("upgrade")} — unlock {app.name}
        </a>

        {/* Founding member offer */}
        <div style={{
          background: "rgba(197,163,12,0.07)",
          border: "1px solid rgba(197,163,12,0.35)",
          borderRadius: 10, padding: "14px 16px", textAlign: "left",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            ⭐ Founding Member Offer
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
            The first 200 paying members lock in their plan price forever — no price increases, ever. Spots are limited and won't reopen.
          </div>
          <a
            href="/plans"
            style={{
              display: "block", padding: "10px",
              background: "#C9A84C", borderRadius: 8,
              color: "#000", fontSize: 13, fontWeight: 700,
              textAlign: "center", textDecoration: "none",
            }}
          >
            Become a Founding Member →
          </a>
        </div>

        <a
          href="/plans"
          style={{
            display: "block", padding: "11px",
            background: "transparent", border: "1px solid #2a2a2a",
            borderRadius: 8, color: COLORS.textMuted,
            fontSize: 13, textAlign: "center", textDecoration: "none",
          }}
        >
          {t("view_all_plans")}
        </a>
      </div>
    </div>
  );
}
