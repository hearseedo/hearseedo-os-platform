// Monkey Yoga Phonics V2 — staging preview (Stage 5).
// Same SSO embed + HSD_OS_PROGRESS wiring as AppModal.jsx uses for the live
// "phonics" app, pointed at V2 instead. This is the ONLY place V2 is wired to
// the real auth/progress system — the live phonics card/route in apps.js is
// completely untouched, so V1 keeps running exactly as it does today.
//
// Writes go through the same processAppEvent() the rest of the platform
// uses (Phase 3.4, 2026-09-12: routed through the server-authenticated
// record-engagement-event.js, which verifies the ID token and the
// profile's ownership before writing) — so this can never touch another
// account's, or another child's, data.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { auth } from "../lib/firebase";
import { processAppEvent } from "../lib/appEvents";
import { PHONICS_V2_URL } from "../lib/phonicsV2PreviewFlag";

function buildIframeSrc(url, uid, idToken) {
  if (!url || !uid) return url;
  const u = new URL(url);
  u.searchParams.set("sso_token", uid);
  u.searchParams.set("staging", "1"); // tells V2 to accept the SSO params + emit progress
  if (idToken) u.searchParams.set("id_token", idToken);
  return u.toString();
}

export default function PhonicsV2Preview() {
  const { user } = useAuth();
  const [idToken, setIdToken] = useState(null);
  const [log, setLog] = useState([]);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    auth.currentUser.getIdToken().then(setIdToken).catch(() => {});
  }, []);

  useEffect(() => {
    function onMessage(e) {
      const data = e.data;
      if (!data || data.type !== "HSD_OS_PROGRESS" || !user?.uid) return;
      setLog((l) => [{ at: new Date().toLocaleTimeString(), ...data }, ...l].slice(0, 20));
      processAppEvent(user.uid, data);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [user?.uid]);

  if (!user) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Sign in first to preview V2.</div>;
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div
        style={{
          position: "fixed", top: 0, left: 0, right: 340, background: "#7c3aed", color: "#fff",
          fontSize: 12, padding: "4px 10px", textAlign: "center", zIndex: 10,
        }}
      >
        STAGING PREVIEW — signed in as {user.email} · writes go to this account's real learnerProfile only
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 24 }}>
        {idToken ? (
          <iframe
            ref={iframeRef}
            title="Monkey Yoga Phonics V2 preview"
            src={buildIframeSrc(PHONICS_V2_URL, user.uid, idToken)}
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        ) : (
          <div style={{ padding: 40 }}>Loading session…</div>
        )}
      </div>
      <div style={{ width: 340, flexShrink: 0, background: "#111", color: "#d7ffd7", padding: 12, overflowY: "auto", fontSize: 12, paddingTop: 24 }}>
        <h2 style={{ color: "#fff", fontSize: 14, margin: "0 0 8px" }}>HSD_OS_PROGRESS events</h2>
        {log.length === 0 && <div style={{ color: "#888" }}>Complete a lesson section in V2 to see events here.</div>}
        {log.map((e, i) => (
          <div key={i} style={{ borderBottom: "1px solid #333", padding: "6px 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            <div style={{ color: "#888" }}>{e.at}</div>
            {JSON.stringify(e, null, 2)}
          </div>
        ))}
      </div>
    </div>
  );
}
