// Generic activity player (item 11: "activity player/container"). Renders
// differently per activityType but is ONE component, ONE completion/
// progress integration point — not five different players.
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { auth } from "../lib/firebase";
import { FAMILY_COLORS } from "./theme";
import { getActivity, INSTRUCTIONS } from "./content";
import { recordActivityStarted, recordActivityCompleted, recordActivityAbandoned } from "./familyProgress";
import { buildFamilyJonaPrompt, buildFamilyOpeningMessage } from "./jonaFamily";
import { SELF_PROFILE_ID } from "../lib/profiles";
import { APPS } from "../constants/apps";
import AppModal from "../components/AppModal";
import FamilyError from "./FamilyError";
import FamilyLoading from "./FamilyLoading";

export default function ActivityPlayer() {
  const { activityId } = useParams();
  const { user, currentProfile } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const activity = getActivity(activityId);
  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;
  const startedRef = useRef(false);
  const [error, setError] = useState(null);
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    if (!user?.uid || !activity || startedRef.current) return;
    startedRef.current = true;
    recordActivityStarted(user.uid, profileId, activityId);
  }, [user?.uid, activity, profileId, activityId]);

  useEffect(() => () => {
    // Abandoned if the player unmounts before completion was recorded.
    if (user?.uid && activity && startedRef.current && !completedRef.current) {
      recordActivityAbandoned(user.uid, profileId, activityId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completedRef = useRef(false);
  function complete() {
    completedRef.current = true;
    recordActivityCompleted(user.uid, profileId, activityId);
    navigate(`/family/${activity.category === "hub" ? "hub" : activity.category}`);
  }

  if (!user) return <FamilyLoading />;
  if (!activity) return <FamilyError kind="unavailable" onBack={() => navigate("/family/home")} />;
  if (error) return <FamilyError kind={error} onRetry={() => setError(null)} onBack={() => navigate("/family/home")} />;

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ padding: "16px 20px" }}>
        <button onClick={() => navigate(`/family/${activity.category}`)} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
          {t("fam_back_to_home")}
        </button>
      </header>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 60px" }}>
        <div style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>{activity.icon}</div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: FAMILY_COLORS.text, textAlign: "center", marginBottom: 24 }}>
          {lang === "jp" && activity.titleJp ? activity.titleJp : activity.title}
        </h1>

        {activity.activityType === "audio" && (
          <AudioPlayer activity={activity} onError={() => setError("audio")} onComplete={complete} t={t} />
        )}

        {activity.activityType === "instructions" && (
          <InstructionsPlayer activity={activity} lang={lang} onComplete={complete} t={t} />
        )}

        {activity.activityType === "jona" && (
          <JonaPlayer activity={activity} profile={currentProfile} user={user} onError={() => setError("ai")} onComplete={complete} t={t} lang={lang} />
        )}

        {activity.activityType === "iframe_app" && (
          <IframeAppPlayer activity={activity} user={user} currentProfile={currentProfile} onComplete={complete} t={t} />
        )}
      </div>
    </div>
  );
}

function AudioPlayer({ activity, onError, onComplete, t }) {
  return (
    <div style={{ textAlign: "center" }}>
      {activity.media.imageUrl && (
        <img src={activity.media.imageUrl} alt="" style={{ width: "100%", maxWidth: 340, borderRadius: 20, marginBottom: 20 }} />
      )}
      <audio
        controls
        autoPlay
        src={activity.media.audioUrl}
        style={{ width: "100%", marginBottom: 20 }}
        onError={onError}
        onEnded={onComplete}
      />
      <button onClick={onComplete} style={primaryBtn}>{t("fam_continue")} →</button>
    </div>
  );
}

function InstructionsPlayer({ activity, lang, onComplete, t }) {
  const text = INSTRUCTIONS[activity.activityId];
  return (
    <div style={{ textAlign: "center" }}>
      {activity.media.imageUrl && (
        <img src={activity.media.imageUrl} alt="" style={{ width: "100%", maxWidth: 340, borderRadius: 20, marginBottom: 20 }} />
      )}
      {activity.media.audioUrl && <audio controls src={activity.media.audioUrl} style={{ width: "100%", marginBottom: 16 }} />}
      <p style={{ fontSize: 16, lineHeight: 1.7, color: FAMILY_COLORS.text, background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
        {lang === "jp" ? text?.jp : text?.en}
      </p>
      <button onClick={onComplete} style={primaryBtn}>{t("fam_continue")} →</button>
    </div>
  );
}

function IframeAppPlayer({ activity, user, currentProfile, onComplete, t }) {
  const app = APPS.find(a => a.id === activity.media.appId);
  const [open, setOpen] = useState(true);
  if (!app) return <FamilyError kind="unavailable" />;
  return (
    <div>
      {open && (
        <AppModal
          app={app}
          user={user}
          activeMember={currentProfile?.isVirtual ? null : currentProfile}
          onClose={() => { setOpen(false); onComplete(); }}
        />
      )}
      {!open && <button onClick={onComplete} style={primaryBtn}>{t("fam_continue")} →</button>}
    </div>
  );
}

function JonaPlayer({ activity, profile, user, onError, onComplete, t, lang }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [turns, setTurns] = useState(0);
  const requiredTurns = parseInt(activity.completionCriteria?.split(":")[1] ?? "2", 10);

  useEffect(() => {
    sendToJona([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendToJona(history) {
    setLoading(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const system = buildFamilyJonaPrompt({ activityId: activity.activityId, profileName: profile?.name, ageBand: profile?.ageBand });
      const userMsg = history.length === 0 ? buildFamilyOpeningMessage(activity.activityId) : history[history.length - 1].text;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          messages: [...history.map(h => ({ role: h.role, content: h.text })), ...(history.length === 0 ? [{ role: "user", content: userMsg }] : [])],
          idToken,
          profileId: profile?.id,
        }),
      });
      if (!res.ok) { onError(); return; }
      const data = await res.json();
      const replyEn = (data.content?.match(/REPLY_EN:\s*(.+)/)?.[1] ?? data.content ?? "").trim();
      const replyJp = (data.content?.match(/REPLY_JP:\s*(.+)/)?.[1] ?? "").trim();
      setMessages(m => [...m, { role: "assistant", text: lang === "jp" && replyJp ? replyJp : replyEn }]);
    } catch {
      onError();
    }
    setLoading(false);
  }

  function handleSend() {
    if (!input.trim()) return;
    const next = [...messages, { role: "user", text: input.trim() }];
    setMessages(next);
    setInput("");
    setTurns(t => t + 1);
    sendToJona(next);
  }

  const canComplete = turns >= requiredTurns;

  return (
    <div>
      <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 18, padding: 16, minHeight: 220, marginBottom: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            background: m.role === "user" ? FAMILY_COLORS.pinkSoft : "#f5f5f5",
            padding: "8px 14px", borderRadius: 14, maxWidth: "80%", fontSize: 14, color: FAMILY_COLORS.text,
          }}>{m.text}</div>
        ))}
        {loading && <div style={{ fontSize: 13, color: FAMILY_COLORS.textMuted }}>Jona 🐵…</div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder="..."
          style={{ flex: 1, padding: "12px 16px", borderRadius: 14, border: `2px solid ${FAMILY_COLORS.border}`, fontSize: 15 }}
        />
        <button onClick={handleSend} disabled={loading} style={{ ...primaryBtn, padding: "12px 20px" }}>→</button>
      </div>
      {canComplete && <button onClick={onComplete} style={primaryBtn}>{t("fam_continue")} →</button>}
    </div>
  );
}

const primaryBtn = {
  width: "100%", padding: 14, borderRadius: 14, border: "none",
  background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
};
