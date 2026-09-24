// Talk with Jona (Gemini Live beta, 2026-09-24) — a separate, additive
// realtime conversation UI. Does NOT touch GlobalJonaAssistant/"Ask Jona"
// in any way; if anything here fails, that existing pipeline is completely
// unaffected. See docs/JONA_REALTIME_VOICE_AUDIT_2026-09-24.md and
// netlify/functions/live-token.js for the architecture this implements.
//
// User-facing states are limited to Listening / Thinking / Speaking, plus
// one obvious "End conversation" — never "Gemini", "Live API", "WebSocket",
// "token", "audio stream", "STT", or "TTS" anywhere in this UI (requirement #4).
//
// Native barge-in only: interruption is detected by Google's Live API and
// reported via serverContent.interrupted — this component reacts to that
// signal by stopping local playback immediately. It never runs its own
// timer-based "is the user talking" heuristic (requirement #5).
//
// Session termination (requirement #8) is real, not cosmetic: closing this
// component (unmount), the caller's own end-conversation click, or the
// external triggers the caller passes via the `closeSignal` prop (profile
// switch, logout, route exit) all call the same endSession() path, which
// closes the Live session, stops the microphone track, and reports the
// end to the server.
import { useEffect, useRef, useState, useCallback } from "react";
import { GoogleGenAI, Modality } from "@google/genai";
import { auth } from "../lib/firebase";
import { useLang } from "../hooks/useLang";

// PCM16/16kHz input conversion — Gemini Live's documented input format.
function floatTo16BitPCM(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function base64FromInt16(int16) {
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function pcm16ToFloat32(int16) {
  const out = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
  return out;
}

// Talk with Jona speaks at 24kHz per Gemini Live's documented output rate.
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_SAMPLE_RATE  = 16000;

export default function TalkWithJona({ context, profileId, lang, onClose, closeSignal }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("connecting"); // connecting | listening | thinking | speaking | error | ended
  const [errorMsg, setErrorMsg] = useState("");

  const sessionRef       = useRef(null);
  const sessionIdRef     = useRef(null);
  const audioCtxRef      = useRef(null);
  const micStreamRef     = useRef(null);
  const micSourceRef     = useRef(null);
  const micProcessorRef  = useRef(null);
  const playCtxRef       = useRef(null);
  const playTimeRef      = useRef(0);
  const startedAtRef     = useRef(null);
  const endedRef         = useRef(false);
  const maxSecondsRef    = useRef(180);
  const hardTimeoutRef   = useRef(null);
  const scheduledSourcesRef = useRef([]);

  const reportEnd = useCallback(async (reason) => {
    if (!sessionIdRef.current) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const durationSeconds = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : null;
      await fetch("/api/live-session-end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, sessionId: sessionIdRef.current, durationSeconds, endReason: reason }),
      });
    } catch { /* best-effort logging only — never blocks the user from leaving */ }
  }, []);

  // Real, not cosmetic: stops the mic track, closes the Live session,
  // cancels any scheduled playback, and reports the end — every path
  // (button, unmount, external signal, timeout) funnels through here.
  const endSession = useCallback((reason) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (hardTimeoutRef.current) clearTimeout(hardTimeoutRef.current);

    for (const src of scheduledSourcesRef.current) { try { src.stop(); } catch { /* already stopped */ } }
    scheduledSourcesRef.current = [];

    try { micProcessorRef.current?.disconnect(); } catch { /* not connected */ }
    try { micSourceRef.current?.disconnect(); } catch { /* not connected */ }
    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    try { audioCtxRef.current?.close(); } catch { /* already closed */ }
    try { playCtxRef.current?.close(); } catch { /* already closed */ }

    try { sessionRef.current?.close(); } catch { /* already closed */ }

    setPhase("ended");
    reportEnd(reason);
  }, [reportEnd]);

  const handleEndClick = useCallback(() => {
    endSession("user_ended");
    onClose?.();
  }, [endSession, onClose]);

  // External termination triggers (requirement #8): profile switch, logout
  // — caller passes a value (e.g. `${uid}:${activeProfileId}`) that changes
  // when either happens. Skips the very first render (a ref, not state, so
  // it never itself re-triggers this effect) so mounting with an already-set
  // closeSignal doesn't immediately end the session it's meant to start.
  const prevCloseSignalRef = useRef(closeSignal);
  useEffect(() => {
    if (prevCloseSignalRef.current === closeSignal) return;
    prevCloseSignalRef.current = closeSignal;
    endSession("profile_switch");
  }, [closeSignal, endSession]);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("not_signed_in");

        const tokenRes = await fetch("/api/live-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken, profileId, pathway: context?.pathway, appName: context?.appName, lesson: context?.lesson, lang }),
        });
        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          throw new Error(err.error || "unavailable");
        }
        const minted = await tokenRes.json();
        if (cancelled) return;

        sessionIdRef.current  = minted.sessionId;
        maxSecondsRef.current = minted.maxSessionSeconds ?? 180;

        // Requirement #9 backstop — server also enforces this on the token
        // itself (expireTime), this is a client-side belt-and-braces close
        // so the UI ends the conversation cleanly rather than erroring.
        hardTimeoutRef.current = setTimeout(() => endSession("timeout"), maxSecondsRef.current * 1000);

        const ai = new GoogleGenAI({ apiKey: minted.token });
        playCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
        playTimeRef.current = 0;

        const session = await ai.live.connect({
          model: minted.model,
          config: { responseModalities: [Modality.AUDIO] },
          callbacks: {
            onopen: () => {
              if (cancelled) return;
              startedAtRef.current = Date.now();
              startMic();
              setPhase("listening");
            },
            onmessage: (message) => {
              if (cancelled) return;
              // Native barge-in signal (requirement #5) — stop local
              // playback immediately, never a hand-rolled interruption timer.
              if (message.serverContent?.interrupted) {
                for (const src of scheduledSourcesRef.current) { try { src.stop(); } catch { /* already stopped */ } }
                scheduledSourcesRef.current = [];
                playTimeRef.current = playCtxRef.current?.currentTime ?? 0;
                setPhase("listening");
                return;
              }
              const parts = message.serverContent?.modelTurn?.parts ?? [];
              for (const part of parts) {
                if (part.inlineData?.data) {
                  playChunk(part.inlineData.data);
                }
              }
              if (message.serverContent?.turnComplete) {
                setPhase((p) => (p === "speaking" ? "listening" : p));
              }
            },
            onerror: (e) => {
              if (cancelled) return;
              console.error("Talk with Jona connection error:", e?.message || e);
              setErrorMsg(t("talk_jona_error"));
              setPhase("error");
            },
            onclose: () => {
              if (cancelled) return;
              if (!endedRef.current) endSession("abnormal_disconnect");
            },
          },
        });
        if (cancelled) { try { session.close(); } catch { /* noop */ } return; }
        sessionRef.current = session;
      } catch (e) {
        if (cancelled) return;
        console.error("Talk with Jona failed to start:", e.message);
        setErrorMsg(t("talk_jona_error"));
        setPhase("error");
      }
    }

    function playChunk(base64Data) {
      const ctx = playCtxRef.current;
      if (!ctx) return;
      const binary = atob(base64Data);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const int16   = new Int16Array(bytes.buffer);
      const float32 = pcm16ToFloat32(int16);
      const buffer  = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
      buffer.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime, playTimeRef.current);
      src.start(startAt);
      playTimeRef.current = startAt + buffer.duration;
      scheduledSourcesRef.current.push(src);
      src.onended = () => {
        scheduledSourcesRef.current = scheduledSourcesRef.current.filter((s) => s !== src);
      };
      setPhase("speaking");
    }

    async function startMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, sampleRate: INPUT_SAMPLE_RATE, echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        micStreamRef.current = stream;

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        micSourceRef.current = source;
        // ScriptProcessorNode is deprecated but universally supported for
        // this exact PCM-capture shape; AudioWorklet would need a separate
        // module file for marginal benefit at this beta's scope.
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        micProcessorRef.current = processor;
        processor.onaudioprocess = (e) => {
          if (!sessionRef.current || endedRef.current) return;
          const input = e.inputBuffer.getChannelData(0);
          const pcm16 = floatTo16BitPCM(input);
          try {
            sessionRef.current.sendRealtimeInput({
              audio: { data: base64FromInt16(pcm16), mimeType: `audio/pcm;rate=${audioCtx.sampleRate}` },
            });
          } catch { /* session mid-close — drop this chunk */ }
        };
        source.connect(processor);
        // Connecting to destination is required by some browsers to keep the
        // processor node alive; onaudioprocess never writes to the output
        // buffer, so nothing is actually played back through it.
        processor.connect(audioCtx.destination);
      } catch (e) {
        console.error("Microphone access failed:", e.message);
        setErrorMsg(t("talk_jona_mic_error"));
        setPhase("error");
      }
    }

    connect();
    return () => {
      cancelled = true;
      endSession("route_exit");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label =
    phase === "connecting" ? t("talk_jona_connecting") :
    phase === "listening"  ? t("talk_jona_listening")  :
    phase === "thinking"   ? t("talk_jona_thinking")   :
    phase === "speaking"   ? t("talk_jona_speaking")   :
    phase === "error"      ? errorMsg :
    t("talk_jona_ended");

  return (
    <div
      role="dialog"
      aria-label={t("talk_jona_title")}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "linear-gradient(160deg, #2b0f24, #4a1638)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        padding: 24, textAlign: "center", gap: 28,
      }}
    >
      <img
        src="/assets/hsd/jona/jona-avatar.png"
        alt="Jona"
        style={{
          width: 140, height: 140, borderRadius: "50%", objectFit: "cover",
          boxShadow: phase === "speaking" ? "0 0 0 10px rgba(255,255,255,0.18)" : phase === "listening" ? "0 0 0 6px rgba(255,255,255,0.28)" : "0 0 0 0 rgba(255,255,255,0)",
          transition: "box-shadow 0.3s ease",
        }}
      />

      {/* Unmistakable mic-active indicator (requirement #8) — visible
          whenever the microphone is actually open, not just while Jona
          is speaking. */}
      {(phase === "listening" || phase === "thinking" || phase === "speaking") && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: 0.85 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff5c7a", display: "inline-block", animation: "pulse 1.4s ease-in-out infinite" }} />
          {t("talk_jona_mic_active")}
        </div>
      )}

      <div style={{ fontSize: 20, fontWeight: 700, minHeight: 28 }}>{label}</div>

      <button
        onClick={handleEndClick}
        style={{
          padding: "14px 32px", borderRadius: 30, border: "2px solid rgba(255,255,255,0.5)",
          background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 15, fontWeight: 800,
          cursor: "pointer", letterSpacing: 0.3,
        }}
      >
        {t("talk_jona_end")}
      </button>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
