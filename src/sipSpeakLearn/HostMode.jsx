// Sip Speak Learn — Host Mode (Phase 6)
// Create Event wizard → live multi-table Host Dashboard → Event Report.
// Table-level rotation only (instructional banner, no auto-reseating) per
// spec's own "start simple" guidance for the rotation engine.
import { useState, useEffect } from "react";
import { SSL } from "./constants";
import { Icon, Btn } from "./ui";
import { SEASONS } from "./data";
import { STAGES, rotationInstruction, getStageContent } from "./tableData";
import { createEvent, createHostController, getEventReport, saveEventTemplate } from "./hostStore";

const STAGE_LABELS = { warmup: "Warm-up", main: "Main Conversation", challenge: "Challenge", reflection: "Reflection" };
const STATUS_LABELS = {
  speaking: "Speaking", "needs-prompt": "Needs a Prompt", "finished-early": "Finished Early",
  offline: "Not Started",
};
const STATUS_COLORS = {
  speaking: SSL.success, "needs-prompt": SSL.warning, "finished-early": SSL.danger, offline: SSL.textMuted,
};

export default function HostMode({ uid, user, go }) {
  const [phase, setPhase] = useState("wizard"); // wizard | dashboard | report
  const [eventId, setEventId] = useState(null);
  const [config, setConfig] = useState(null);

  if (phase === "wizard") {
    return (
      <Wizard
        onLaunch={async (cfg) => {
          const { eventId: id } = await createEvent(uid, cfg);
          setConfig(cfg);
          setEventId(id);
          setPhase("dashboard");
        }}
        onCancel={() => go("dashboard")}
      />
    );
  }
  if (phase === "dashboard" && !eventId) return null;
  if (phase === "dashboard") {
    return (
      <Dashboard
        eventId={eventId}
        onEnded={() => setPhase("report")}
        onExit={() => go("dashboard")}
      />
    );
  }
  if (phase === "report") {
    return <Report eventId={eventId} config={config} uid={uid} go={go} />;
  }
  return null;
}

// ── Step 1-6: Create Event Wizard ───────────────────────────────────────────
const STEPS = ["Event Details", "Guest Setup", "Round Setup", "Prompts", "Rotation", "Review & Launch"];

function Wizard({ onLaunch, onCancel }) {
  const [step, setStep] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [cfg, setCfg] = useState({
    name: "", date: "", location: "", seasonId: SEASONS[0].id,
    guestCount: 24, tableCount: 6,
    roundMinutes: 2,
    rolesEnabled: true, rotationMode: "full",
  });
  const [launchError, setLaunchError] = useState(null);
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const guestsPerTable = Math.ceil(cfg.guestCount / Math.max(1, cfg.tableCount));

  async function launch() {
    setLaunching(true);
    setLaunchError(null);
    try {
      await onLaunch({ ...cfg, guestsPerTable });
    } catch {
      setLaunching(false);
      setLaunchError("Couldn't create the event right now. Check your connection and try again.");
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <span className="ssl-eyebrow">Host an Event</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 600, margin: "6px 0 18px" }}>{STEPS[step]}</h1>

      {/* Step dots */}
      <div style={{ display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <span key={s} className="ssl-pill" style={{
            background: i < step ? SSL.success : i === step ? SSL.copper : SSL.creamPanel,
            color: i <= step ? "#fff" : SSL.textMuted, fontSize: 11.5 }}>{i + 1}. {s}</span>
        ))}
      </div>

      <div className="ssl-card" style={{ padding: 26 }}>
        {step === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Event name">
              <TextInput value={cfg.name} onChange={(v) => set({ name: v })} placeholder="Winter Mix & Mingle" />
            </Field>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Field label="Date" style={{ flex: 1 }}><TextInput value={cfg.date} onChange={(v) => set({ date: v })} placeholder="e.g. Dec 14, 2026" /></Field>
              <Field label="Location" style={{ flex: 1 }}><TextInput value={cfg.location} onChange={(v) => set({ location: v })} placeholder="e.g. The Northlight Bar" /></Field>
            </div>
            <Field label="Season">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {SEASONS.map((s) => (
                  <Chip key={s.id} active={cfg.seasonId === s.id} onClick={() => set({ seasonId: s.id })}>{s.icon} {s.name.split(" ")[0]}</Chip>
                ))}
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Number of guests"><NumberInput value={cfg.guestCount} onChange={(v) => set({ guestCount: v })} min={2} /></Field>
            <Field label="Number of tables"><NumberInput value={cfg.tableCount} onChange={(v) => set({ tableCount: v })} min={1} max={20} /></Field>
            <p style={{ fontSize: 13.5, color: SSL.textMuted }}>≈ {guestsPerTable} guests per table.</p>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Round duration (minutes)"><NumberInput value={cfg.roundMinutes} onChange={(v) => set({ roundMinutes: v })} min={1} max={15} /></Field>
            <div className="ssl-card" style={{ padding: 16, background: SSL.creamPanel }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: SSL.copper, letterSpacing: ".06em", marginBottom: 8 }}>ROUND STRUCTURE</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {STAGES.map((s, i) => <Chip key={s} active>{i + 1}. {STAGE_LABELS[s]}</Chip>)}
              </div>
              <p style={{ fontSize: 12.5, color: SSL.textMuted, marginTop: 8 }}>Fixed four-stage structure for now — custom round counts are a future upgrade.</p>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: SSL.inkSoft, cursor: "pointer" }}>
              <input type="checkbox" checked={cfg.rolesEnabled} onChange={(e) => set({ rolesEnabled: e.target.checked })} />
              Enable rotating roles (Starter, Follow-up Leader, Connector, Encourager)
            </label>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 14.5, color: SSL.inkSoft }}>
              Using prepared seasonal prompts for <strong>{SEASONS.find((s) => s.id === cfg.seasonId)?.name}</strong> — every table starts with the same Warm-up question, and you can send a new one to everyone at any time from the dashboard.
            </p>
            <div className="ssl-card" style={{ padding: 16, background: SSL.navy, color: "#fff", border: "none" }}>
              <div style={{ fontSize: 11.5, color: SSL.copperLight, fontWeight: 700, letterSpacing: ".06em" }}>WARM-UP PREVIEW</div>
              <p className="ssl-serif" style={{ fontSize: 18, marginTop: 8 }}>
                {getStageContent(cfg.seasonId, "warmup").q}
              </p>
            </div>
            <p style={{ fontSize: 12.5, color: SSL.textMuted }}>Custom, per-table, and randomised prompts are a future upgrade.</p>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Rotation between rounds">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["none", "No rotation"], ["partner", "Partner rotation"], ["half", "Half-table rotation"], ["full", "Full-table rotation"]].map(([id, label]) => (
                  <RadioRow key={id} active={cfg.rotationMode === id} onClick={() => set({ rotationMode: id })} label={label} />
                ))}
              </div>
            </Field>
            <div className="ssl-card" style={{ padding: 14, background: SSL.creamPanel }}>
              <div style={{ fontSize: 12.5, color: SSL.copper, fontWeight: 700, marginBottom: 4 }}>PREVIEW INSTRUCTION</div>
              <p style={{ fontSize: 14, color: SSL.inkSoft }}>{rotationInstruction(cfg.rotationMode)}</p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SummaryRow label="Event" value={cfg.name || "Untitled event"} />
            <SummaryRow label="When / where" value={[cfg.date, cfg.location].filter(Boolean).join(" · ") || "—"} />
            <SummaryRow label="Season" value={SEASONS.find((s) => s.id === cfg.seasonId)?.name} />
            <SummaryRow label="Guests / Tables" value={`${cfg.guestCount} guests · ${cfg.tableCount} tables (~${guestsPerTable}/table)`} />
            <SummaryRow label="Round length" value={`${cfg.roundMinutes} min`} />
            <SummaryRow label="Roles" value={cfg.rolesEnabled ? "Enabled" : "Disabled"} />
            <SummaryRow label="Rotation" value={cfg.rotationMode} />
            <p style={{ fontSize: 12.5, color: SSL.textMuted, marginTop: 8 }}>
              Launching will generate an event code guests can enter from Join a Table. Printable table cards and scannable QR images are a future upgrade — for now, share the code directly.
            </p>
            {launchError && <p style={{ fontSize: 13.5, color: SSL.danger, marginTop: 4 }}>{launchError}</p>}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
        <Btn variant="ghost" onClick={step === 0 ? onCancel : () => setStep((s) => s - 1)}>
          {step === 0 ? "Cancel" : "Back"}
        </Btn>
        {step < STEPS.length - 1 ? (
          <Btn onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !cfg.name.trim()}>
            Next <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span>
          </Btn>
        ) : (
          <Btn onClick={launch} disabled={launching}>{launching ? "Launching…" : "Generate Code & Launch"}</Btn>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: SSL.copper, letterSpacing: ".06em", marginBottom: 8 }}>{label.toUpperCase()}</div>
      {children}
    </div>
  );
}
function TextInput({ value, onChange, placeholder }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${SSL.border}`, fontSize: 15, color: SSL.ink }} />;
}
function NumberInput({ value, onChange, min, max }) {
  return <input type="number" value={value} min={min} max={max}
    onChange={(e) => onChange(Math.max(min ?? 0, Math.min(max ?? 999, parseInt(e.target.value, 10) || 0)))}
    style={{ width: 120, padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${SSL.border}`, fontSize: 15, color: SSL.ink }} />;
}
function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className="ssl-focusable" style={{ padding: "8px 14px", borderRadius: 10, fontSize: 13.5, fontWeight: 600,
      cursor: onClick ? "pointer" : "default", border: `1.5px solid ${active ? SSL.copper : SSL.border}`,
      background: active ? SSL.copper : "transparent", color: active ? "#fff" : SSL.ink }}>{children}</button>
  );
}
function RadioRow({ active, onClick, label }) {
  return (
    <button onClick={onClick} className="ssl-focusable" style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left",
      padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1.5px solid ${active ? SSL.copper : SSL.border}`,
      background: active ? "rgba(212,162,78,.1)" : "transparent" }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${active ? SSL.copper : SSL.border}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: SSL.copper }} />}
      </span>
      <span style={{ fontSize: 14.5, color: SSL.ink, fontWeight: active ? 700 : 500 }}>{label}</span>
    </button>
  );
}
function SummaryRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${SSL.border}` }}>
      <span style={{ fontSize: 13, color: SSL.textMuted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, color: SSL.ink, fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Host Dashboard ───────────────────────────────────────────────────────────
function Dashboard({ eventId, onEnded, onExit }) {
  const [controller] = useState(() => createHostController(eventId));
  const [state, setState] = useState(controller.getState());
  const [now, setNow] = useState(Date.now());
  const [messageText, setMessageText] = useState("");
  const [messageTarget, setMessageTarget] = useState(null); // tableId or "all"
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    controller.start(); // (re)establish real Firestore listeners — safe under StrictMode's mount/cleanup/remount
    setState(controller.getState());
    const unsub = controller.subscribe(setState);
    return () => { unsub(); controller.destroy(); };
  }, [controller]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const ev = state.event;
  if (state.error) {
    return (
      <div style={{ maxWidth: 420, margin: "80px auto", textAlign: "center" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto 16px", color: SSL.danger }}>{Icon.help}</div>
        <h1 className="ssl-serif" style={{ fontSize: 24, fontWeight: 600 }}>Connection lost</h1>
        <p style={{ color: SSL.inkSoft, marginTop: 10 }}>We couldn't reach this event. Check your connection and try again.</p>
        <Btn onClick={onExit} style={{ marginTop: 20 }}>Back to Home</Btn>
      </div>
    );
  }
  if (!ev) return <div style={{ padding: 40, textAlign: "center", color: SSL.textMuted }}>Loading event…</div>;

  const roundStartedMs = ev.roundStartedAt?.toMillis?.();
  const roundEndsAt = roundStartedMs ? roundStartedMs + (ev.roundDurationSec || 120) * 1000 : null;
  const remaining = roundEndsAt ? Math.max(0, Math.round((roundEndsAt - now) / 1000)) : null;
  const mmss = remaining != null ? `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}` : "—";
  const stageId = STAGES[ev.stageIndex || 0];

  function sendMessage() {
    if (!messageText.trim()) return;
    if (messageTarget === "all") controller.actions.messageAllTables(messageText);
    else controller.actions.messageTable(messageTarget, messageText);
    setMessageText(""); setMessageTarget(null);
  }

  async function endEvent() {
    await controller.actions.endEvent(notes);
    onEnded();
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 className="ssl-serif" style={{ fontSize: "clamp(24px,3.4vw,32px)", fontWeight: 600 }}>{ev.name}</h1>
            <span className="ssl-pill" style={{ background: ev.status === "live" ? SSL.success : ev.status === "paused" ? SSL.warning : SSL.creamPanel,
              color: ev.status === "lobby" ? SSL.inkSoft : "#fff" }}>{ev.status === "live" ? "● LIVE" : ev.status.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 13, color: SSL.textMuted, marginTop: 2 }}>Code: <strong>{ev.code}</strong> · Guests join at "Join a Table"</div>
        </div>
        <button onClick={onExit} className="ssl-focusable" style={{ background: "none", border: "none", color: SSL.copper, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Exit dashboard</button>
      </div>

      {ev.status === "lobby" ? (
        <div className="ssl-card" style={{ padding: 30, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: SSL.inkSoft, marginBottom: 16 }}>Guests can join now with code <strong>{ev.code}</strong>. Start the event once your tables are ready.</p>
          <Btn onClick={controller.actions.startEvent}>Start Event <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span></Btn>
        </div>
      ) : (
        <>
          <div className="ssl-row" style={{ flexWrap: "wrap" }}>
            <div className="ssl-card" style={{ flex: "1 1 300px", padding: 20, background: SSL.navy, color: "#fff", border: "none" }}>
              <div style={{ fontSize: 40, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{mmss}</div>
              <div style={{ fontSize: 13, color: SSL.onNavyMuted }}>Time remaining in round</div>
              <div style={{ marginTop: 10, fontWeight: 700 }}>Round {ev.roundIndex} · {STAGE_LABELS[stageId]}</div>
            </div>
            <div style={{ flex: "2 1 400px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
              <CtrlBtn label={ev.status === "paused" ? "Resume All" : "Pause All"} onClick={ev.status === "paused" ? controller.actions.resumeAll : controller.actions.pauseAll} />
              <CtrlBtn label="Extend 2 Minutes" onClick={controller.actions.extendTwoMinutes} />
              <CtrlBtn label="Send New Question" onClick={controller.actions.sendNewQuestionToAll} />
              <CtrlBtn label="Move to Next Stage" onClick={controller.actions.moveToNextStage} primary />
              <CtrlBtn label="Message All Tables" onClick={() => setMessageTarget("all")} />
              <CtrlBtn label="End Event" onClick={() => setShowEndConfirm(true)} danger />
            </div>
          </div>

          {messageTarget && (
            <div className="ssl-card" style={{ padding: 16, marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: SSL.inkSoft, flexShrink: 0 }}>
                To {messageTarget === "all" ? "all tables" : `Table ${state.tables.find((t) => t.id === messageTarget)?.tableNumber}`}:
              </span>
              <input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="e.g. Two minutes left in this round!"
                style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: `1px solid ${SSL.border}` }} />
              <Btn onClick={sendMessage} style={{ padding: "9px 18px" }}>Send</Btn>
              <button onClick={() => setMessageTarget(null)} style={{ background: "none", border: "none", color: SSL.textMuted, cursor: "pointer" }}>✕</button>
            </div>
          )}

          {/* Table grid */}
          <div className="ssl-grid4" style={{ marginTop: 20 }}>
            {state.tables.map((t) => (
              <div key={t.id} className="ssl-card ssl-focusable" role="button" tabIndex={0} onClick={() => setMessageTarget(t.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMessageTarget(t.id); } }}
                style={{ padding: 16, cursor: "pointer", borderTop: `4px solid ${STATUS_COLORS[t.status] || SSL.textMuted}` }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>Table {t.tableNumber}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[t.status] || SSL.textMuted }} />
                  <span style={{ fontSize: 13, color: SSL.inkSoft }}>{STATUS_LABELS[t.status] || t.status}</span>
                </div>
                <div style={{ fontSize: 12.5, color: SSL.textMuted, marginTop: 4 }}>{t.participantCount || 0} guest{t.participantCount === 1 ? "" : "s"}</div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="ssl-card" style={{ padding: 16, marginTop: 20, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13.5, color: SSL.inkSoft }}><strong>{state.participants.length}</strong> guests</span>
            <span style={{ fontSize: 13.5, color: SSL.inkSoft }}><strong>{state.tables.length}</strong> tables</span>
            <span style={{ fontSize: 13.5, color: SSL.inkSoft }}><strong>{STAGES.length - (ev.stageIndex || 0) - 1}</strong> stages remaining</span>
            <span style={{ fontSize: 13.5, color: SSL.inkSoft, flex: 1 }}>Prompt requests: <strong>{ev.promptRequests || 0}</strong></span>
          </div>
        </>
      )}

      {showEndConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,26,46,.6)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="ssl-card" style={{ padding: 26, maxWidth: 420, background: "#fff" }}>
            <div className="ssl-serif" style={{ fontSize: 20 }}>End this event?</div>
            <p style={{ fontSize: 14, color: SSL.inkSoft, marginTop: 8 }}>Guests will be moved to the completion screen. Add any notes for your report below.</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Host notes (optional)…"
              style={{ width: "100%", minHeight: 80, marginTop: 10, padding: 10, borderRadius: 8, border: `1px solid ${SSL.border}`, fontSize: 14 }} />
            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowEndConfirm(false)}>Cancel</Btn>
              <Btn onClick={endEvent}>End Event</Btn>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CtrlBtn({ label, onClick, primary, danger }) {
  return (
    <button onClick={onClick} className="ssl-focusable" style={{ padding: "14px 12px", borderRadius: 12, fontSize: 13.5, fontWeight: 700,
      cursor: "pointer", border: "none", background: danger ? SSL.danger : primary ? SSL.success : SSL.navy,
      color: "#fff" }}>{label}</button>
  );
}

// ── Event Report ─────────────────────────────────────────────────────────────
function Report({ eventId, config, uid, go }) {
  const [report, setReport] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { getEventReport(eventId).then(setReport); }, [eventId]);

  function exportReport() {
    const text = `Sip Speak Learn — Event Report\n\n` +
      Object.entries(report).map(([k, v]) => `${k}: ${v ?? "—"}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sip-speak-learn-event-report.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  async function saveTemplate() {
    if (!config) return;
    await saveEventTemplate(uid, config);
    setSaved(true);
  }

  if (!report) return <div style={{ padding: 40, textAlign: "center", color: SSL.textMuted }}>Preparing report…</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 36 }}>🎉</div>
        <h1 className="ssl-serif" style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 600 }}>Event Report</h1>
        <p style={{ color: SSL.inkSoft }}>{report.name}</p>
      </div>

      <div className="ssl-grid4">
        <ReportStat label="Duration" value={report.durationMin != null ? `${report.durationMin} min` : "—"} />
        <ReportStat label="Guests" value={report.guestCount} />
        <ReportStat label="Tables" value={report.tableCount} />
        <ReportStat label="Rounds completed" value={report.roundsCompleted} />
        <ReportStat label="Prompt requests" value={report.promptRequests} />
        <ReportStat label="Confidence change"
          value={report.avgConfidenceDelta != null ? `${report.avgConfidenceDelta > 0 ? "+" : ""}${report.avgConfidenceDelta}` : "—"}
          sub={report.respondedCount ? `from ${report.respondedCount} guests` : "no responses yet"} />
      </div>

      {report.hostNotes && (
        <div className="ssl-card" style={{ padding: 18, marginTop: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: SSL.copper, letterSpacing: ".06em", marginBottom: 6 }}>HOST NOTES</div>
          <p style={{ fontSize: 14, color: SSL.inkSoft }}>{report.hostNotes}</p>
        </div>
      )}

      <p style={{ fontSize: 12.5, color: SSL.textMuted, marginTop: 14, textAlign: "center" }}>
        Private table transcripts are never recorded or stored — this report only reflects aggregate, self-reported data.
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn variant="ghost" onClick={exportReport}>Export Report</Btn>
        <Btn variant="ghost" onClick={saveTemplate} disabled={saved}>{saved ? "Template Saved ✓" : "Save as Template"}</Btn>
        <Btn onClick={() => go("dashboard")}>Back to Home</Btn>
      </div>
    </div>
  );
}
function ReportStat({ label, value, sub }) {
  return (
    <div className="ssl-card" style={{ padding: "18px 14px", textAlign: "center" }}>
      <div className="ssl-serif" style={{ fontSize: 26, color: SSL.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: SSL.textMuted, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 10.5, color: SSL.textMuted, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
