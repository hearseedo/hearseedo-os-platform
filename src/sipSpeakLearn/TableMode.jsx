// Sip Speak Learn — Table Mode (Phase 5)
// Join → Lobby → live Table screen (full-bleed, no app nav) → Complete.
// Backed by eventStore's live (Firestore) or demo (local) controller.
import { useState, useEffect, useRef } from "react";
import { SSL, CONFIDENCE_LEVELS } from "./constants";
import { Icon, Btn } from "./ui";
import { SEASONS } from "./data";
import {
  joinEventByCode, createLiveController, createDemoController,
  STAGES, ROLES, rotationInstruction,
} from "./eventStore";

const STAGE_LABELS = { warmup: "Warm-up", main: "Main Conversation", challenge: "Challenge", reflection: "Reflection" };

export default function TableMode({ uid, user, go }) {
  const [controller, setController] = useState(null);
  const [state, setState] = useState(null);
  const [joinError, setJoinError] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!controller) return;
    setState(controller.getState());
    const unsub = controller.subscribe(setState);
    return () => { unsub(); controller.destroy?.(); };
  }, [controller]);

  async function handleJoinCode(code) {
    setJoining(true); setJoinError(null);
    const res = await joinEventByCode(code);
    setJoining(false);
    if (!res.ok) {
      setJoinError(res.reason);
      return;
    }
    setController(createLiveController(res.eventId, user));
  }

  function startDemo(seasonId, opts) {
    setController(createDemoController(seasonId, opts));
  }

  function leaveEvent() {
    controller?.actions.leave();
    controller?.destroy?.();
    setController(null);
    setState(null);
    setJoinError(null);
  }

  if (!controller) {
    return <JoinScreen onJoinCode={handleJoinCode} onStartDemo={startDemo} joining={joining} error={joinError} go={go} />;
  }

  if (!state) return null;

  if (state.phase === "error" || state.phase === "ended") {
    return <ErrorScreen reason={state.error || "ended"} onBack={leaveEvent} />;
  }
  if (state.phase === "lobby") {
    return <Lobby state={state} actions={controller.actions} onLeave={leaveEvent} />;
  }
  if (state.phase === "table") {
    return <TableScreen state={state} actions={controller.actions} onLeave={leaveEvent} />;
  }
  if (state.phase === "complete") {
    return <Complete actions={controller.actions} onFinish={leaveEvent} go={go} />;
  }
  return <div style={{ padding: 40, textAlign: "center", color: SSL.textMuted }}>Connecting…</div>;
}

// ── Join ────────────────────────────────────────────────────────────────────
function JoinScreen({ onJoinCode, onStartDemo, joining, error, go }) {
  const [code, setCode] = useState("");
  const [showDemo, setShowDemo] = useState(false);
  const [season, setSeason] = useState(SEASONS[0].id);
  const [rolesEnabled, setRolesEnabled] = useState(true);

  const ERR = {
    not_found: "We couldn't find an event with that code. Double-check with your host.",
    ended: "This event has already ended.",
    offline: "Couldn't connect right now — check your connection and try again.",
    invalid: "Enter a valid event code.",
  };

  return (
    <>
      <span className="ssl-eyebrow">Table Mode</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 600, margin: "6px 0 6px" }}>Join a Table</h1>
      <p style={{ color: SSL.inkSoft, marginBottom: 22, maxWidth: 560 }}>
        Enter the event code your host shared, or scan the table QR code.
      </p>

      <div className="ssl-card" style={{ padding: 24, maxWidth: 440 }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: SSL.copper, letterSpacing: ".08em", marginBottom: 10 }}>EVENT CODE</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. G7K2Q" maxLength={8}
            style={{ flex: 1, padding: "13px 16px", borderRadius: 12, border: `1.5px solid ${SSL.border}`,
              fontSize: 18, letterSpacing: ".08em", fontWeight: 700, textAlign: "center", color: SSL.ink }} />
          <Btn onClick={() => onJoinCode(code)} disabled={joining || !code.trim()}>
            {joining ? "Joining…" : "Join"}
          </Btn>
        </div>
        {error && <p style={{ color: SSL.danger, fontSize: 13.5, marginTop: 10 }}>{ERR[error] || ERR.not_found}</p>}
      </div>

      <div className="ssl-card" style={{ padding: 24, maxWidth: 440, marginTop: 18 }}>
        <button onClick={() => setShowDemo((s) => !s)} className="ssl-focusable"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: SSL.ink }}>Try a Demo Table</span>
          <span style={{ width: 18, height: 18, color: SSL.copper, transform: showDemo ? "rotate(90deg)" : "none" }}>{Icon.arrow}</span>
        </button>
        <p style={{ fontSize: 13, color: SSL.textMuted, marginTop: 6 }}>No host needed — practise the full Table Mode experience solo.</p>

        {showDemo && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: SSL.copper, letterSpacing: ".06em", marginBottom: 8 }}>SEASON</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {SEASONS.map((s) => (
                <button key={s.id} onClick={() => setSeason(s.id)} className="ssl-focusable"
                  style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
                    border: `1.5px solid ${season === s.id ? SSL.copper : SSL.border}`,
                    background: season === s.id ? SSL.copper : "transparent", color: season === s.id ? "#fff" : SSL.ink }}>
                  {s.icon} {s.name.split(" ")[0]}
                </button>
              ))}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: SSL.inkSoft, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" checked={rolesEnabled} onChange={(e) => setRolesEnabled(e.target.checked)} />
              Enable rotating roles (Starter, Follow-up Leader, Connector, Encourager)
            </label>
            <Btn onClick={() => onStartDemo(season, { rolesEnabled, rotationMode: "full" })} style={{ width: "100%" }}>
              Start Demo Table <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span>
            </Btn>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 20 }}>
        <Btn variant="ghost" onClick={() => go("dashboard")}>Back to Home</Btn>
        <button onClick={() => go("host")} className="ssl-focusable"
          style={{ background: "none", border: "none", color: SSL.copper, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>
          Hosting an event? Start here →
        </button>
      </div>
    </>
  );
}

// ── Lobby ───────────────────────────────────────────────────────────────────
function Lobby({ state, actions, onLeave }) {
  const [confidence, setConfidence] = useState(null);
  const picked = confidence != null;

  function pick(v) {
    setConfidence(v);
    actions.submitConfidenceBefore(v);
  }

  return (
    <div style={{ maxWidth: 480, margin: "50px auto", textAlign: "center" }}>
      <div className="ssl-pill" style={{ background: SSL.creamPanel, color: SSL.copper, marginBottom: 16 }}>
        {state.isDemo ? "DEMO" : "LOBBY"}
      </div>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,4vw,36px)", fontWeight: 600 }}>{state.eventName || "You're in!"}</h1>
      <p style={{ color: SSL.inkSoft, marginTop: 10, lineHeight: 1.6 }}>
        {state.tableNumber
          ? `You're seated at Table ${state.tableNumber} with a color of ${state.color}.`
          : "Finding you a seat…"}
      </p>

      <div className="ssl-card" style={{ padding: 20, marginTop: 22, textAlign: "center" }}>
        <div style={{ fontWeight: 700, fontSize: 12.5, color: SSL.copper, letterSpacing: ".08em", marginBottom: 12 }}>
          HOW CONFIDENT DO YOU FEEL RIGHT NOW?
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {CONFIDENCE_LEVELS.map((c) => (
            <button key={c.value} onClick={() => pick(c.value)} className="ssl-focusable"
              style={{ padding: "10px 8px", borderRadius: 12, cursor: "pointer", minWidth: 78,
                border: `1.5px solid ${confidence === c.value ? SSL.copper : SSL.border}`,
                background: confidence === c.value ? SSL.copper : "transparent", color: confidence === c.value ? "#fff" : SSL.ink }}>
              <div style={{ fontSize: 18 }}>{c.emoji}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>{c.label}</div>
            </button>
          ))}
        </div>
      </div>

      <p style={{ color: SSL.inkSoft, marginTop: 18, fontSize: 14 }}>
        {state.isDemo ? "Whenever you're ready, enter the table to begin." : "Waiting for your host to start the event…"}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
        <Btn variant="ghost" onClick={onLeave}>Leave</Btn>
        {state.isDemo && (
          <Btn onClick={actions.enterTable} disabled={!picked}>Enter Table <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span></Btn>
        )}
      </div>
    </div>
  );
}

// ── Error ───────────────────────────────────────────────────────────────────
function ErrorScreen({ reason, onBack }) {
  const COPY = {
    not_found: ["Event not found", "We couldn't find that event. Check the code with your host, or try again."],
    ended: ["Event has ended", "This event has already wrapped up. Thanks for stopping by!"],
    offline: ["Connection lost", "We couldn't reach the event. Check your connection and try again."],
  };
  const [title, body] = COPY[reason] || COPY.not_found;
  return (
    <div style={{ maxWidth: 440, margin: "80px auto", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, margin: "0 auto 16px", color: SSL.danger }}>{Icon.help}</div>
      <h1 className="ssl-serif" style={{ fontSize: 26, fontWeight: 600 }}>{title}</h1>
      <p style={{ color: SSL.inkSoft, marginTop: 10 }}>{body}</p>
      <Btn onClick={onBack} style={{ marginTop: 22 }}>Back to Join</Btn>
    </div>
  );
}

// ── Table Screen (full-bleed overlay — no app nav during a live session) ───
function TableScreen({ state, actions, onLeave }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.round(((state.roundEndsAt || now) - now) / 1000));
  const mmss = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  const role = ROLES.find((r) => r.id === state.role);
  const stageId = STAGES[state.stageIndex];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: SSL.navyDeep, color: SSL.onNavy,
      overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", width: "100%", padding: "22px 28px 60px", flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span className="ssl-pill" style={{ background: SSL.copper, color: "#fff", fontSize: 15, padding: "8px 16px" }}>
              TABLE {state.tableNumber}
            </span>
            <div>
              <div className="ssl-serif" style={{ fontSize: 20, color: "#fff" }}>{state.eventName}</div>
              <div style={{ fontSize: 12.5, color: SSL.onNavyMuted }}>Round {state.roundIndex} · {state.color} table</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 28, fontVariantNumeric: "tabular-nums", color: "#fff" }}>
              <span style={{ width: 24, height: 24 }}>{Icon.clock}</span>{mmss}
            </div>
            <button onClick={onLeave} className="ssl-focusable"
              style={{ background: "none", border: `1px solid ${SSL.borderNavy}`, color: SSL.onNavyMuted, borderRadius: 10, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              Leave
            </button>
          </div>
        </div>

        {state.broadcastMessage && (
          <div style={{ textAlign: "center", background: "rgba(212,162,78,.16)", border: `1px solid ${SSL.copper}`,
            borderRadius: 12, padding: "12px 18px", marginBottom: 18, color: "#fff", fontSize: 15, fontWeight: 600 }}>
            📣 {state.broadcastMessage}
          </div>
        )}

        <div className="ssl-row" style={{ flexWrap: "wrap" }}>
          {/* Role panel */}
          {state.rolesEnabled && (
            <div style={{ flex: "0 0 260px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copperLight, letterSpacing: ".08em", marginBottom: 12, textAlign: "center" }}>YOUR ROLE</div>
              {ROLES.map((r) => (
                <div key={r.id} className="ssl-card" style={{ padding: "14px 16px", marginBottom: 8,
                  background: r.id === state.role ? "rgba(212,162,78,.16)" : "rgba(255,255,255,.04)",
                  border: `1.5px solid ${r.id === state.role ? SSL.copper : SSL.borderNavy}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, fontSize: 15.5, color: "#fff" }}>{r.name}</span>
                    {r.id === state.role && <span className="ssl-pill" style={{ background: SSL.copper, color: "#fff", fontSize: 10.5 }}>YOU</span>}
                  </div>
                  <div style={{ fontSize: 13, color: SSL.onNavyMuted, marginTop: 3 }}>{r.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Main question */}
          <div style={{ flex: "1 1 420px", minWidth: 0 }}>
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: SSL.copperLight, letterSpacing: ".1em", marginBottom: 10 }}>
              ROUND {state.roundIndex} · {STAGE_LABELS[stageId].toUpperCase()}
            </div>
            <div className="ssl-card" style={{ background: "#fff", padding: "40px 32px", textAlign: "center" }}>
              <p className="ssl-serif" style={{ fontSize: "clamp(24px,3.4vw,34px)", color: SSL.ink, lineHeight: 1.3, margin: 0 }}>{state.question.text}</p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 24 }}>
                {state.question.phrases.map((p, i) => (
                  <span key={i} className="ssl-pill" style={{ background: SSL.creamPanel, color: SSL.inkSoft, fontSize: 14, padding: "9px 16px" }}>{p}</span>
                ))}
              </div>
            </div>

            {state.showRotation && (
              <div style={{ textAlign: "center", marginTop: 16, fontSize: 15, color: SSL.gold }}>
                ✨ Next: {rotationInstruction(state.rotationMode)}
              </div>
            )}

            {/* Controls */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginTop: 20 }}>
              <BigBtn icon={Icon.repeat} label="Another Question" onClick={actions.anotherQuestion} />
              <BigBtn label="Make It Easier" onClick={actions.makeEasier} active={state.question.level === "easier"} />
              <BigBtn label="Go Deeper" onClick={actions.makeDeeper} active={state.question.level === "deeper"} />
              <BigBtn icon={Icon.check} label="We're Finished" onClick={actions.weAreFinished} primary disabled={state.finished} />
            </div>
          </div>
        </div>

        {/* Stage progress */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 32, flexWrap: "wrap" }}>
          {STAGES.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="ssl-pill" style={{
                background: i < state.stageIndex ? SSL.success : i === state.stageIndex ? SSL.copper : "transparent",
                border: i > state.stageIndex ? `1px solid ${SSL.borderNavy}` : "none",
                color: i <= state.stageIndex ? "#fff" : SSL.onNavyMuted, fontSize: 12.5 }}>
                {i < state.stageIndex ? "✓ " : ""}{STAGE_LABELS[s]}
              </span>
              {i < STAGES.length - 1 && <span style={{ width: 20, height: 1, background: SSL.borderNavy }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BigBtn({ icon, label, onClick, primary, active, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="ssl-focusable"
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "18px 14px", borderRadius: 14,
        fontSize: 15, fontWeight: 700, cursor: disabled ? "default" : "pointer", minHeight: 58,
        border: `1.5px solid ${active ? SSL.copper : primary ? SSL.success : SSL.borderNavy}`,
        background: active ? SSL.copper : primary ? SSL.success : "rgba(255,255,255,.05)",
        color: "#fff", opacity: disabled ? 0.55 : 1 }}>
      {icon && <span style={{ width: 18, height: 18 }}>{icon}</span>} {disabled && primary ? "Waiting for other tables…" : label}
    </button>
  );
}

// ── Complete ────────────────────────────────────────────────────────────────
function Complete({ actions, onFinish, go }) {
  const [confidence, setConfidence] = useState(null);
  function pick(v) {
    setConfidence(v);
    actions.submitConfidenceAfter(v);
  }
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: SSL.cream, overflowY: "auto" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 40 }}>🥂</div>
        <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,3.6vw,38px)", fontWeight: 600, marginTop: 8 }}>Event complete.</h1>
        <p style={{ color: SSL.inkSoft, marginTop: 8 }}>Thanks for talking, listening, and showing up. That's the whole point.</p>

        <div className="ssl-card" style={{ padding: 22, marginTop: 26, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: SSL.copper, letterSpacing: ".08em", marginBottom: 14 }}>HOW CONFIDENT DO YOU FEEL NOW?</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {CONFIDENCE_LEVELS.map((c) => (
              <button key={c.value} onClick={() => pick(c.value)} className="ssl-focusable"
                style={{ padding: "12px 10px", borderRadius: 12, cursor: "pointer", minWidth: 88,
                  border: `1.5px solid ${confidence === c.value ? SSL.copper : SSL.border}`,
                  background: confidence === c.value ? SSL.copper : "transparent", color: confidence === c.value ? "#fff" : SSL.ink }}>
                <div style={{ fontSize: 20 }}>{c.emoji}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 3 }}>{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 12.5, color: SSL.textMuted, marginTop: 14 }}>
          Table conversations are never recorded or shared — this reflection is just for you.
        </p>

        <Btn onClick={() => { onFinish(); go("dashboard"); }} style={{ marginTop: 20 }}>Back to Home</Btn>
      </div>
    </div>
  );
}
