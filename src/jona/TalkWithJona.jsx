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
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
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

// Floating-card layout (2026-09-25 UX rewrite — see requirement #1-#13 in
// the redesign brief). Jona is a companion beside the lesson now, not a
// full-screen takeover: no modal backdrop, the underlying app stays live
// and interactive, and the card is small, draggable, and collapsible.
// None of this touches the connection/session logic above — only how it's
// presented on screen.
const CARD_W = 240;
const CARD_H = 128;
const PILL_SIZE = 60;
const EDGE_MARGIN = 12;
const TOP_RESERVE = 16;
const BOTTOM_RESERVE = 90; // clears mobile bottom-nav bars and browser chrome
const DRAG_CLICK_THRESHOLD = 6; // px of movement below which a release counts as a tap, not a drag

function getViewportSize() {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  return { w: vv?.width ?? window.innerWidth, h: vv?.height ?? window.innerHeight };
}

function clampPos(x, y, w, h) {
  const { w: vw, h: vh } = getViewportSize();
  const maxX = Math.max(EDGE_MARGIN, vw - w - EDGE_MARGIN);
  const maxY = Math.max(TOP_RESERVE, vh - h - BOTTOM_RESERVE);
  return { x: Math.min(Math.max(x, EDGE_MARGIN), maxX), y: Math.min(Math.max(y, TOP_RESERVE), maxY) };
}

function defaultPos(w, h) {
  const { w: vw, h: vh } = getViewportSize();
  return clampPos(vw - w - EDGE_MARGIN, vh - h - BOTTOM_RESERVE, w, h);
}

export default function TalkWithJona({ context, profileId, lang, onClose, closeSignal }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("connecting"); // connecting | listening | thinking | speaking | error | ended
  const [errorMsg, setErrorMsg] = useState("");

  // UI-only state — position/collapse are purely visual, never touch the
  // Live session (requirement #2, #5).
  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState(null); // null until first measured on mount
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ pointerId: null, startX: 0, startY: 0, origX: 0, origY: 0, moved: 0 });

  useLayoutEffect(() => {
    setPos(defaultPos(CARD_W, CARD_H));
    const onResize = () => {
      setPos((p) => {
        if (!p) return p;
        const w = collapsed ? PILL_SIZE : CARD_W;
        const h = collapsed ? PILL_SIZE : CARD_H;
        return clampPos(p.x, p.y, w, h);
      });
    };
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-clamp (never re-center) when toggling collapsed <-> expanded, since
  // the two states have different footprints.
  useEffect(() => {
    setPos((p) => {
      if (!p) return p;
      const w = collapsed ? PILL_SIZE : CARD_W;
      const h = collapsed ? PILL_SIZE : CARD_H;
      return clampPos(p.x, p.y, w, h);
    });
  }, [collapsed]);

  const snapToNearestEdge = useCallback((p, w) => {
    const { w: vw } = getViewportSize();
    const cardCenterX = p.x + w / 2;
    const snappedX = cardCenterX < vw / 2 ? EDGE_MARGIN : vw - w - EDGE_MARGIN;
    return { x: snappedX, y: p.y };
  }, []);

  const onDragPointerDown = useCallback((e) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, moved: 0 };
    setDragging(true);
  }, [pos]);

  const onDragPointerMove = useCallback((e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.moved = Math.max(dragRef.current.moved, Math.abs(dx), Math.abs(dy));
    const w = collapsed ? PILL_SIZE : CARD_W;
    const h = collapsed ? PILL_SIZE : CARD_H;
    setPos(clampPos(dragRef.current.origX + dx, dragRef.current.origY + dy, w, h));
  }, [collapsed]);

  const onDragPointerUp = useCallback((e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;
    const wasTap = dragRef.current.moved < DRAG_CLICK_THRESHOLD;
    dragRef.current.pointerId = null;
    setDragging(false);
    if (wasTap) {
      // A tap on the collapsed pill expands it (requirement #5); a tap on
      // the expanded card's own drag handle does nothing extra.
      if (collapsed) setCollapsed(false);
      return;
    }
    const w = collapsed ? PILL_SIZE : CARD_W;
    setPos((p) => snapToNearestEdge(p, w));
  }, [collapsed, snapToNearestEdge]);

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

        // apiVersion must match live-token.js's minting call — ephemeral
        // auth tokens are v1alpha-only; connecting with the SDK's default
        // version against a v1alpha-minted token closes the session
        // immediately with no visible error (2026-09-24 production fix).
        const ai = new GoogleGenAI({ apiKey: minted.token, httpOptions: { apiVersion: "v1alpha" } });
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
            // Logged with code/reason (client-side console only, no
            // secrets) — a session that closes right after opening with no
            // user interaction is otherwise silent and hard to diagnose.
            onclose: (e) => {
              if (cancelled) return;
              console.warn("Talk with Jona session closed:", e?.code, e?.reason);
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

        // Explicit sampleRate is required here (2026-09-24 production fix)
        // — without it, AudioContext runs at the hardware default (usually
        // 44100/48000Hz), not 16000. getUserMedia's own sampleRate
        // constraint above is only a hint and browsers routinely ignore it
        // for the actual captured track. Gemini Live requires exactly
        // 16kHz PCM input; sending anything else (even correctly labeled
        // in mimeType) got the session closed by the server within about a
        // second of the mic starting — this is what fixes that.
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: INPUT_SAMPLE_RATE });
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

  const micActive = phase === "listening" || phase === "thinking" || phase === "speaking";
  if (!pos) return null; // one frame to measure the viewport before first paint

  const w = collapsed ? PILL_SIZE : CARD_W;
  const h = collapsed ? PILL_SIZE : CARD_H;

  // Floating companion card (requirement #1, #12) — no modal backdrop, no
  // inset:0; the underlying HSD app stays fully visible and interactive
  // everywhere except this small footprint. Dragging (via the header/avatar
  // row's pointer handlers below) only ever changes `pos`/`collapsed`
  // state — it never touches the session refs above.
  return (
    <div
      role="complementary"
      aria-label={t("talk_jona_title")}
      style={{
        position: "fixed", left: pos.x, top: pos.y, width: w, height: h, zIndex: 1000,
        background: "linear-gradient(160deg, #2b0f24, #4a1638)",
        borderRadius: collapsed ? "50%" : 20,
        boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
        color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: "hidden", userSelect: "none",
        transition: dragging ? "none" : "left 0.25s ease, top 0.25s ease, width 0.15s ease, height 0.15s ease",
        touchAction: "none",
      }}
    >
      {collapsed ? (
        <div
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onPointerCancel={onDragPointerUp}
          style={{
            width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: dragging ? "grabbing" : "grab", position: "relative",
          }}
        >
          <img src="/assets/hsd/jona/jona-avatar.png" alt="Jona" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          {micActive && (
            <span style={{
              position: "absolute", bottom: 2, right: 2, width: 16, height: 16, borderRadius: "50%",
              background: "#ff5c7a", border: "2px solid #2b0f24",
              animation: "hsdJonaPulse 1.4s ease-in-out infinite",
            }} />
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div
            onPointerDown={onDragPointerDown}
            onPointerMove={onDragPointerMove}
            onPointerUp={onDragPointerUp}
            onPointerCancel={onDragPointerUp}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 8px 12px",
              cursor: dragging ? "grabbing" : "grab",
            }}
          >
            <img
              src="/assets/hsd/jona/jona-avatar.png"
              alt="Jona"
              style={{
                width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
                boxShadow: phase === "speaking" ? "0 0 0 4px rgba(255,255,255,0.22)" : phase === "listening" ? "0 0 0 3px rgba(255,255,255,0.3)" : "none",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{t("talk_jona_title")}</div>
              <div style={{ fontSize: 12, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
            </div>
            {/* Collapse toggle — separate from the drag handle's own tap-to-expand
                so expanded -> collapsed is always one deliberate tap here.
                stopPropagation on pointerdown keeps the parent header's own
                drag handler from capturing this pointer and swallowing the
                click (found via manual testing, 2026-09-25). */}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setCollapsed(true)}
              aria-label={t("talk_jona_collapse")}
              title={t("talk_jona_collapse")}
              style={{ background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 8, width: 22, height: 22, color: "#fff", fontSize: 12, cursor: "pointer", flexShrink: 0, lineHeight: 1 }}
            >
              –
            </button>
          </div>

          {micActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.8, padding: "0 12px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff5c7a", display: "inline-block", animation: "hsdJonaPulse 1.4s ease-in-out infinite" }} />
              {t("talk_jona_mic_active")}
            </div>
          )}

          <div style={{ marginTop: "auto", padding: 10 }}>
            <button
              onClick={handleEndClick}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 20, border: "1px solid rgba(255,255,255,0.5)",
                background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 800,
                cursor: "pointer", letterSpacing: 0.2,
              }}
            >
              {t("talk_jona_end")}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes hsdJonaPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
