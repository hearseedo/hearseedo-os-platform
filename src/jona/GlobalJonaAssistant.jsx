// Global Jona Assistant (2026-09-24) — the reusable, droppable component
// referenced throughout this brief: "Jona should be available inside the
// apps," "reusable platform component," "Global Jona Assistant." One Jona
// across HSD OS AI — this is the single implementation meant to eventually
// sit inside every app (EIKEN, WonderCamp, Career Ready, etc.), not a
// one-off built for this demo.
//
// Two modes, same component:
//  - Real mode (default): calls the live sendMessage() (lib/claude.js),
//    the same backend AIChat.jsx already uses — genuinely functional
//    wherever a real, signed-in user drops it in.
//  - Demo mode (`demoScript` prop): for the public, no-auth ecosystem
//    demo — canned, pre-written answers to the suggested prompts, no live
//    AI/Firestore call, same "demos must not depend on live services"
//    principle as src/familyDemo. Only used where demoScript is passed.
//
// `context` — { pathway, appName, lesson } — is threaded into the real
// backend call via sendMessage's new optional context param, so Jona's
// answer is grounded in what the learner is actually looking at instead
// of a generic reply. This is the "understand the context of the
// experience" requirement.
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { sendMessage } from "../lib/claude";
import { useJonaVoice } from "../hooks/useJonaVoice";
import TalkWithJona from "./TalkWithJona";

// Talk with Jona (Gemini Live beta, 2026-09-24) — feature-flagged, visible
// only when useAuth()'s isAdmin is true (same OWNER_EMAILS allowlist
// live-token.js independently re-checks server-side). This client-side
// check only controls whether the button is SHOWN; the real, unbypassable
// gate is server-side — a non-admin account is rejected there even if this
// check were somehow circumvented.

// Lets any button anywhere in the app open the assistant without prop-
// drilling — e.g. EikenApp's dashboard "Chat with Jona" CTA lives several
// components away from where <GlobalJonaAssistant/> itself is mounted.
const OPEN_EVENT = "hsd:open-jona";
export function openGlobalJona() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export default function GlobalJonaAssistant({ context, suggestedPrompts, demoScript, accent = "#e0559c", bottomOffset = 20, anchor = "fixed", freeText = true, voiceMode = "full", lang }) {
  // freeText=false (2026-09-24) — for young-child apps (Phonics V2, ages
  // 4-8): tap a suggested prompt only, no free-text input to an AI. Caller
  // must pass suggestedPrompts in this mode.
  // anchor: "fixed" (default) docks to the browser viewport — right for a
  // page that fills the window. "absolute" docks to the nearest positioned
  // ancestor instead — for an app rendered inside a constrained box (e.g.
  // EikenApp's phone-frame shell inside AppModal), so the bubble sits at
  // that box's corner instead of the far corner of the whole browser
  // window. Caller must give that ancestor position:relative.
  // voiceMode (P0-A, 2026-09-24): "full" (talk + listen, the default — for
  // surfaces where free-text already exists), "outputOnly" (Jona can speak
  // its reply, but no microphone input — pairs with freeText=false apps so
  // young children keep tapping prompts rather than free-talking to an AI),
  // "off" (no voice at all). Configurable per call site so this one
  // component can serve every pathway/age without another rewrite.
  const { user, isAdmin } = useAuth();
  // Talk with Jona (Gemini Live beta) is its own overlay, separate from the
  // chat panel below — opening it does not close/replace "Ask Jona"; they
  // are two independent entry points per requirement #4's ⌨️/🎙 framing.
  const [talkOpen, setTalkOpen] = useState(false);
  const { t, lang: uiLang } = useLang();
  // I18n fix (2026-09-24): this component's own chrome (buttons, labels,
  // placeholders) was entirely hardcoded English regardless of the app's
  // language setting — a real English/Japanese inconsistency the beta
  // simplicity QA flagged. `lang` prop stays available as an explicit
  // override (voice STT/TTS language); UI text always follows the app's
  // actual language setting via useLang().
  const effectiveLang = lang ?? uiLang;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  // Voice in demo mode (2026-09-24 fix): demoScript replies are a small,
  // fixed set of pre-written lines, not open-ended AI text — synthesizing
  // them is bounded, predictable cost (unlike a live AI call), so an
  // anonymous demo visitor gets a stable placeholder identifier instead of
  // being silently denied voice just for not being signed in. This still
  // goes through the same server-side per-account abuse cap
  // (netlify/functions/tts.js) as every other caller.
  const voiceUid = user?.uid || (demoScript ? "eco-demo-guest" : undefined);
  const voice = useJonaVoice({ uid: voiceUid, lang: effectiveLang, mode: voiceMode });
  // Voice is on by default whenever voiceMode allows it — this is meant to
  // be a core interaction, not an opt-in buried behind a toggle — but a
  // mute control still needs to exist for a shared/public device or a
  // moment that just needs to be quiet.
  const [voiceOn, setVoiceOn] = useState(voiceMode !== "off");

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Logout while Talk with Jona is open must end that session, not leave it
  // silently connected (requirement #8) — TalkWithJona's own closeSignal
  // only fires on a UID/profile CHANGE, which a sign-out to `user === null`
  // wouldn't otherwise produce, so unmounting it here is the actual close.
  useEffect(() => {
    if (!user && talkOpen) setTalkOpen(false);
  }, [user, talkOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    const next = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setError("");

    if (demoScript) {
      // Scripted demo path — no live call. Falls back to a friendly
      // generic line if this exact prompt wasn't scripted, so the demo
      // never looks broken for an unscripted question.
      setSending(true);
      await new Promise((r) => setTimeout(r, 500));
      const reply = demoScript[trimmed] ?? demoScript._default ?? "Good question — in the real app I'd help you with exactly that, right here.";
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      setSending(false);
      // voiceUid gives an anonymous demo visitor a stable placeholder
      // identifier (see its own comment above) so this actually plays —
      // still bounded/rate-capped server-side either way.
      if (voiceOn) voice.speak(reply);
      return;
    }

    if (!user) {
      setError(t("jona_sign_in"));
      return;
    }
    setSending(true);
    try {
      // safetyToken (2026-09-24): non-null only when chat.js's own
      // server-side risk classification fired on this exact message —
      // lets the reply's audio bypass the normal TTS rate cap, single-use.
      let safetyToken = null;
      const reply = await sendMessage(next, user, effectiveLang, context, (meta) => { safetyToken = meta.safetyToken; });
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
      if (voiceOn) voice.speak(reply, safetyToken);
    } catch (e) {
      setError(e.message ?? t("jona_error_fallback"));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Talk with Jona (Gemini Live beta) — a separate full-screen overlay,
          entirely independent of the chat panel below. If it's open, it
          owns the screen; closing it (its own End conversation button)
          returns here with nothing else disturbed. */}
      {talkOpen && (
        <TalkWithJona
          context={context}
          profileId={user?.activeProfileId}
          lang={effectiveLang}
          onClose={() => setTalkOpen(false)}
          closeSignal={user ? `${user.uid}:${user.activeProfileId}` : null}
        />
      )}

      {/* Floating launcher — never covers content, stays bottom-right */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t("jona_close") : t("jona_ask")}
        style={{
          position: anchor, bottom: bottomOffset, right: 20, zIndex: 999,
          width: 60, height: 60, borderRadius: "50%", border: "none", cursor: "pointer",
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          boxShadow: `0 6px 20px ${accent}66`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", padding: 0,
        }}
      >
        {open ? (
          <span style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>✕</span>
        ) : (
          <img src="/assets/hsd/jona/jona-avatar.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </button>

      {open && (
        <div
          style={{
            position: anchor, bottom: bottomOffset + 72, right: 20, zIndex: 999,
            width: anchor === "absolute" ? "calc(100% - 40px)" : "min(360px, calc(100vw - 40px))",
            maxHeight: anchor === "absolute" ? "min(460px, calc(100% - 140px))" : "min(520px, calc(100vh - 140px))",
            background: "#fff", borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}
        >
          <div style={{ background: accent, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/assets/hsd/jona/jona-avatar.png" alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Jona</div>
              <div style={{ fontSize: 11, opacity: 0.85 }}>{context?.appName ? t("jona_helping_with").replace("{appName}", context.appName) : t("jona_guide_generic")}</div>
            </div>
            {/* Talk with Jona (Gemini Live beta, requirement #13) — admin-only
                for now, same allowlist live-token.js enforces server-side. */}
            {isAdmin && voiceMode !== "off" && !demoScript && (
              <button
                onClick={() => { setOpen(false); setTalkOpen(true); }}
                aria-label={t("talk_jona_title")}
                title={t("talk_jona_title")}
                style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8, padding: "0 8px", height: 28, fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", flexShrink: 0 }}
              >
                🎙
              </button>
            )}
            {voiceMode !== "off" && (
              <button
                onClick={() => { if (voiceOn) voice.stopSpeaking(); setVoiceOn((v) => !v); }}
                aria-label={voiceOn ? t("jona_mute_on") : t("jona_mute_off")}
                title={voiceOn ? t("jona_mute_on") : t("jona_mute_off")}
                style={{ background: "rgba(255,255,255,0.18)", border: "none", borderRadius: 8, width: 28, height: 28, fontSize: 13, color: "#fff", cursor: "pointer", flexShrink: 0 }}
              >
                {voiceOn ? "🔊" : "🔇"}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 160 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
                {context?.lesson
                  ? t("jona_greeting_lesson").replace("{lesson}", context.lesson)
                  : t("jona_greeting_generic")}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%", padding: "9px 13px", fontSize: 13, lineHeight: 1.5,
                  borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.role === "user" ? accent : "#f4f0f2",
                  color: m.role === "user" ? "#fff" : "#1a1a1a",
                }}
              >
                {m.text}
              </div>
            ))}
            {sending && <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>{t("jona_thinking")}</div>}
            {!sending && voice.speaking && <div style={{ fontSize: 12, color: "#999", fontStyle: "italic" }}>🔊 {t("jona_speaking")}</div>}
            {/* Autoplay-block fallback (2026-09-24 fix) — browsers can
                silently refuse to autoplay Jona's spoken reply; this is
                the one direct, synchronous tap that reliably works
                everywhere, since it IS the user gesture the browser
                needed. */}
            {voice.blockedAudio && (
              <button
                onClick={voice.playBlockedAudio}
                style={{
                  alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 20,
                  border: `1px solid ${accent}55`, background: `${accent}11`, color: accent, cursor: "pointer",
                }}
              >
                🔊 {t("jona_tap_to_hear")}
              </button>
            )}
            {error && <div style={{ fontSize: 12, color: "#c23a3a" }}>{error}</div>}
            <div ref={bottomRef} />
          </div>

          {suggestedPrompts?.length > 0 && (freeText ? messages.length === 0 : !sending) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 14px 10px" }}>
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{ fontSize: 11.5, padding: "6px 10px", borderRadius: 20, border: `1px solid ${accent}55`, background: `${accent}11`, color: accent, cursor: "pointer", fontWeight: 700 }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {freeText && (
            <div style={{ padding: 10, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
              {voice.sttEnabled && voice.sttSupported && (
                <button
                  onClick={() => voice.startListening((transcript) => send(transcript))}
                  disabled={sending || voice.listening}
                  aria-label={t("jona_talk")}
                  title={t("jona_talk")}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: `1px solid ${accent}55`, flexShrink: 0,
                    background: voice.listening ? accent : `${accent}11`, color: voice.listening ? "#fff" : accent,
                    fontSize: 15, cursor: sending ? "default" : "pointer",
                  }}
                >
                  🎙️
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={voice.listening ? t("jona_listening") : t("jona_input_placeholder")}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 10, border: "1px solid #ddd", fontSize: 13, outline: "none" }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || sending}
                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: input.trim() ? accent : "#eee", color: input.trim() ? "#fff" : "#999", fontWeight: 700, fontSize: 13, cursor: input.trim() ? "pointer" : "default" }}
              >
                {t("jona_send")}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
