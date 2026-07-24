// Sip Speak Learn — Conversation Games (Phase 4)
// Solo Mode only for now; Partner/Table Mode variants arrive in Phase 5.
// All content is static (no AI calls) — free to replay, no credit cost.
import { useState, useRef, useEffect } from "react";
import { SSL } from "./constants";
import { Icon, Btn } from "./ui";
import { SEASONS } from "./data";
import { recordGamePlayed, addSpeakingSeconds } from "./storage";
import {
  GAMES, ROULETTE_CATEGORIES, rouletteQuestionsFor,
  STORY_OPENERS, STORY_SEQUENCING_PHRASES, STORY_TWISTS,
  wouldYouRatherFor, ORDER_SCENARIOS, WHEEL_FACE, WHEEL_POINTER, ROULETTE_BG,
} from "./gamesData";

const ROUND_TARGET = 5;

function currentSeasonId() {
  const m = new Date().getMonth(); // 0=Jan
  if (m <= 1 || m === 11) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

// ── Hub ─────────────────────────────────────────────────────────────────────
export function GamesHub({ go }) {
  return (
    <>
      <span className="ssl-eyebrow">Solo Practice</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 600, margin: "6px 0 6px" }}>Conversation Games</h1>
      <p style={{ color: SSL.inkSoft, marginBottom: 22, maxWidth: 560 }}>
        Quick, playful ways to keep talking — designed for adults, not a classroom quiz.
      </p>
      <div className="ssl-grid4">
        {GAMES.map((g) => (
          <div key={g.id} className="ssl-focusable" role="button" tabIndex={0}
            onClick={() => go({ name: "game", gameId: g.id })}
            style={{ position: "relative", borderRadius: SSL.radius, overflow: "hidden", cursor: "pointer",
              aspectRatio: "4/5", minHeight: 240, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <img src={g.cover} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(10,26,46,0) 30%, rgba(10,26,46,.9) 100%)" }} />
            <div style={{ position: "relative", padding: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${g.color}55`, backdropFilter: "blur(2px)", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 10 }}>{g.icon}</div>
              <div className="ssl-serif" style={{ fontSize: 19, color: "#fff" }}>{g.name}</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.75)", marginTop: 5, lineHeight: 1.4 }}>{g.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="ssl-card" style={{ padding: 18, marginTop: 22, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ width: 20, height: 20, color: SSL.copper, flexShrink: 0 }}>{Icon.spark}</span>
        <div style={{ fontSize: 13.5, color: SSL.inkSoft }}>
          Table Mode versions of these games — playing together, in person, at a live event — arrive in Phase 5.
        </div>
      </div>
    </>
  );
}

// ── Session router ────────────────────────────────────────────────────────
export default function GameSession({ gameId, uid, go }) {
  const game = GAMES.find((g) => g.id === gameId);
  const backToHub = () => go("games");
  if (!game) return null;

  return (
    <>
      <button onClick={backToHub} className="ssl-focusable"
        style={{ display: "block", background: "none", border: "none", color: SSL.copper, fontWeight: 600, cursor: "pointer", marginBottom: 12, fontSize: 14, padding: 0 }}>
        ← Conversation Games
      </button>
      {gameId === "roulette" && <Roulette uid={uid} onDone={backToHub} />}
      {gameId === "story"    && <StoryBuilder uid={uid} onDone={backToHub} />}
      {gameId === "rather"   && <WouldYouRather uid={uid} onDone={backToHub} />}
      {gameId === "order"    && <OrderChallenge uid={uid} onDone={backToHub} />}
    </>
  );
}

// ── Shared: round timer hook ─────────────────────────────────────────────
function useTimer() {
  const [secs, setSecs] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    ref.current = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(ref.current);
  }, []);
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  return { secs, mmss, stop: () => clearInterval(ref.current) };
}

function GameHeader({ icon, label, round, total }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: SSL.copper, fontWeight: 700, fontSize: 13, letterSpacing: ".08em" }}>
        <span style={{ width: 18, height: 18 }}>{icon}</span> {label}
      </div>
      {round != null && <span className="ssl-pill" style={{ background: SSL.creamPanel, color: SSL.inkSoft }}>Round {round} of {total}</span>}
    </div>
  );
}

// ── Conversation Roulette ────────────────────────────────────────────────
function Roulette({ uid, onDone }) {
  const [cat, setCat] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [question, setQuestion] = useState(null);
  const [level, setLevel] = useState("base"); // base | easier | deeper
  const [round, setRound] = useState(0);
  const { secs, mmss, stop } = useTimer();
  const season = currentSeasonId();

  function pickQuestion(categoryId) {
    const pool = rouletteQuestionsFor(categoryId, season);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function spin() {
    if (spinning) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * ROULETTE_CATEGORIES.length);
    const target = ROULETTE_CATEGORIES[idx];
    const segment = 360 / ROULETTE_CATEGORIES.length;
    const landingAngle = 360 * 5 + (360 - (idx * segment + segment / 2));
    setRotation((r) => r - (r % 360) + landingAngle);
    setTimeout(() => {
      setSpinning(false);
      setCat(target.id);
      setQuestion(pickQuestion(target.id));
      setLevel("base");
      setRound((n) => n + 1);
    }, 2200);
  }

  function newQuestion() {
    if (!cat) return;
    setQuestion(pickQuestion(cat));
    setLevel("base");
    setRound((n) => n + 1);
  }

  function finish() {
    stop();
    recordGamePlayed(uid, "roulette");
    addSpeakingSeconds(uid, secs);
    onDone();
  }

  const catInfo = ROULETTE_CATEGORIES.find((c) => c.id === cat);
  const text = question ? (level === "easier" ? question.easier : level === "deeper" ? question.deeper : question.text) : null;

  return (
    <div className="ssl-row" style={{ flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 440px", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 460, borderRadius: SSL.radiusLg, overflow: "hidden",
          padding: "40px 0 34px", display: "flex", justifyContent: "center" }}>
          <img src={ROULETTE_BG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(10,26,46,.35)" }} />

          <div style={{ position: "relative", width: "min(82vw, 360px)", height: "min(82vw, 360px)" }}>
            <img src={WHEEL_POINTER} alt="" style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)",
              width: 52, zIndex: 2, filter: "drop-shadow(0 4px 6px rgba(0,0,0,.4))" }} />
            <img src={WHEEL_FACE} alt="Conversation Roulette wheel" style={{
              width: "100%", height: "100%", borderRadius: "50%",
              transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 2.4s cubic-bezier(.12,.72,.15,1)" : "none",
              filter: "drop-shadow(0 16px 30px rgba(0,0,0,.45))" }} />
            <button onClick={spin} disabled={spinning} className="ssl-focusable"
              style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: 84, height: 84, borderRadius: "50%", border: "none", background: "transparent",
                color: SSL.gold, fontWeight: 700, fontSize: 15, letterSpacing: ".06em", cursor: spinning ? "default" : "pointer", zIndex: 2 }}>
              {spinning ? "…" : "SPIN"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 18px", marginTop: 18, width: "100%", maxWidth: 360 }}>
          {ROULETTE_CATEGORIES.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: cat && cat !== c.id ? 0.45 : 1 }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, flexShrink: 0,
                boxShadow: cat === c.id ? `0 0 0 3px ${c.color}33` : "none" }} />
              <span style={{ fontSize: 13, fontWeight: cat === c.id ? 700 : 500, color: SSL.inkSoft }}>{c.label}</span>
            </div>
          ))}
        </div>
        {!question && <p style={{ color: SSL.textMuted, textAlign: "center", marginTop: 14, fontSize: 13.5 }}>Tap SPIN to land on a category and get your question.</p>}
      </div>

      <div style={{ flex: "1 1 420px", minWidth: 0 }}>
        <GameHeader icon={Icon.spark} label="CONVERSATION ROULETTE" round={question ? round : null} total={ROUND_TARGET} />
        {question ? (
          <div className="ssl-card" style={{ padding: 22, background: SSL.navy, border: "none", color: SSL.onNavy }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: catInfo?.color, fontWeight: 700, fontSize: 12.5, letterSpacing: ".08em" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: catInfo?.color, flexShrink: 0 }} />
              {catInfo?.label.toUpperCase()}
            </div>
            <p className="ssl-serif" style={{ fontSize: 22, color: "#fff", margin: "12px 0 16px", lineHeight: 1.35 }}>{text}</p>
            <div style={{ fontWeight: 700, fontSize: 12, color: SSL.copperLight, letterSpacing: ".08em", marginBottom: 8 }}>HELPFUL PHRASES</div>
            {question.phrases.map((p, i) => (
              <div key={i} style={{ fontSize: 14, color: SSL.onNavyMuted, padding: "5px 0" }}>· {p}</div>
            ))}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SSL.borderNavy}` }}>
              <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 18, color: "#fff" }}>{mmss}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setLevel("easier")} className="ssl-focusable" style={miniBtn(level === "easier")}>Easier</button>
                <button onClick={() => setLevel("deeper")} className="ssl-focusable" style={miniBtn(level === "deeper")}>Deeper</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="ssl-card" style={{ padding: 22, color: SSL.textMuted }}>Your question will appear here once you spin.</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Btn variant="ghost" onClick={newQuestion} disabled={!cat} style={{ flex: 1 }}>New Question</Btn>
          <Btn onClick={finish} style={{ flex: 1 }}>Finish</Btn>
        </div>
      </div>
    </div>
  );
}
const miniBtn = (active) => ({ padding: "7px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  border: `1px solid ${active ? SSL.copper : SSL.borderNavy}`, background: active ? SSL.copper : "transparent", color: "#fff" });

// ── Story Builder ─────────────────────────────────────────────────────────
function StoryBuilder({ uid, onDone }) {
  const season = currentSeasonId();
  const opener = STORY_OPENERS[season];
  const [beat, setBeat] = useState(0); // index into STORY_SEQUENCING_PHRASES
  const [twist, setTwist] = useState(null);
  const { secs, mmss, stop } = useTimer();

  const isLast = beat >= STORY_SEQUENCING_PHRASES.length - 1;

  function next() {
    const nextBeat = Math.min(STORY_SEQUENCING_PHRASES.length - 1, beat + 1);
    if (nextBeat === 2 && !twist) setTwist(STORY_TWISTS[Math.floor(Math.random() * STORY_TWISTS.length)]);
    setBeat(nextBeat);
  }

  function finish() {
    stop();
    recordGamePlayed(uid, "story");
    addSpeakingSeconds(uid, secs);
    onDone();
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <GameHeader icon={Icon.spark} label="STORY BUILDER" round={beat + 1} total={STORY_SEQUENCING_PHRASES.length} />

      <div className="ssl-card" style={{ padding: 22, background: SSL.navy, border: "none", color: SSL.onNavy }}>
        <div style={{ fontSize: 12.5, color: SSL.copperLight, fontWeight: 700, letterSpacing: ".08em" }}>{SEASONS.find(s=>s.id===season)?.icon} {opener.setting}</div>
        <p className="ssl-serif" style={{ fontSize: 20, color: "#fff", margin: "12px 0", lineHeight: 1.4 }}>
          {beat === 0 ? opener.opener : beat === 2 && twist ? twist : "Keep going — where does the story go next?"}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SSL.borderNavy}` }}>
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 18 }}>{mmss}</div>
          <span className="ssl-pill" style={{ background: "rgba(212,162,78,.18)", color: SSL.copperLight }}>Use: “{STORY_SEQUENCING_PHRASES[beat]}”</span>
        </div>
      </div>

      <p style={{ fontSize: 13.5, color: SSL.textMuted, margin: "14px 0", textAlign: "center" }}>
        Speak your part of the story out loud, starting with today's phrase — then continue.
      </p>

      <div style={{ display: "flex", gap: 10 }}>
        {!isLast ? (
          <Btn onClick={next} style={{ flex: 1 }}>Add to the Story <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span></Btn>
        ) : (
          <Btn onClick={finish} style={{ flex: 1 }}>Finish the Story <span style={{ width: 18, height: 18 }}>{Icon.check}</span></Btn>
        )}
      </div>
    </div>
  );
}

// ── Would You Rather? ────────────────────────────────────────────────────
function WouldYouRather({ uid, onDone }) {
  const season = currentSeasonId();
  const bank = useRef(shuffle(wouldYouRatherFor(season))).current;
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const { secs, mmss, stop } = useTimer();

  const q = bank[idx % bank.length];
  const isLast = idx >= 7; // 8 rounds

  function pick(side) { setPicked(side); }
  function next() { setPicked(null); setIdx((i) => i + 1); }
  function finish() {
    stop();
    recordGamePlayed(uid, "rather");
    addSpeakingSeconds(uid, secs);
    onDone();
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <GameHeader icon={Icon.spark} label="WOULD YOU RATHER?" round={idx + 1} total={8} />

      <div className="ssl-card" style={{ padding: 22, background: SSL.navy, border: "none", color: SSL.onNavy, textAlign: "center" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <OptionCard label="A" text={q.a} active={picked === "a"} onClick={() => pick("a")} />
          <div style={{ alignSelf: "center", color: SSL.copperLight, fontWeight: 700 }}>OR</div>
          <OptionCard label="B" text={q.b} active={picked === "b"} onClick={() => pick("b")} />
        </div>
        {picked && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${SSL.borderNavy}` }}>
            <div style={{ fontSize: 12.5, color: SSL.copperLight, fontWeight: 700, letterSpacing: ".08em", marginBottom: 6 }}>NOW EXPLAIN</div>
            <p style={{ fontSize: 15.5, color: "#fff" }}>{q.followUp}</p>
          </div>
        )}
        <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 15, marginTop: 16, color: SSL.onNavyMuted }}>{mmss}</div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        {!isLast ? (
          <Btn onClick={next} disabled={!picked} style={{ flex: 1 }}>Next Question <span style={{ width: 18, height: 18 }}>{Icon.arrow}</span></Btn>
        ) : (
          <Btn onClick={finish} disabled={!picked} style={{ flex: 1 }}>Finish <span style={{ width: 18, height: 18 }}>{Icon.check}</span></Btn>
        )}
      </div>
    </div>
  );
}
function OptionCard({ label, text, active, onClick }) {
  return (
    <button onClick={onClick} className="ssl-focusable" style={{ flex: "1 1 200px", textAlign: "left", padding: "16px 18px", borderRadius: 12, cursor: "pointer",
      border: `1.5px solid ${active ? SSL.copper : SSL.borderNavy}`, background: active ? "rgba(212,162,78,.14)" : "rgba(255,255,255,.04)", color: "#fff" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: SSL.copperLight, marginBottom: 4 }}>OPTION {label}</div>
      <div style={{ fontSize: 15.5, lineHeight: 1.35 }}>{text}</div>
    </button>
  );
}

// ── Order Challenge ───────────────────────────────────────────────────────
function OrderChallenge({ uid, onDone }) {
  const [active, setActive] = useState(null);
  const [done, setDone] = useState({});
  const { secs, mmss, stop } = useTimer();

  function markDone(id) {
    setDone((d) => ({ ...d, [id]: true }));
    setActive(null);
  }
  function finish() {
    stop();
    recordGamePlayed(uid, "order");
    addSpeakingSeconds(uid, secs);
    onDone();
  }

  const scenario = ORDER_SCENARIOS.find((s) => s.id === active);
  const doneCount = Object.keys(done).length;

  if (scenario) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={() => setActive(null)} className="ssl-focusable"
          style={{ display: "block", background: "none", border: "none", color: SSL.copper, fontWeight: 600, cursor: "pointer", marginBottom: 12, fontSize: 14, padding: 0 }}>
          ← All scenarios
        </button>
        <div className="ssl-card" style={{ padding: 22, background: SSL.navy, border: "none", color: SSL.onNavy }}>
          <div className="ssl-serif" style={{ fontSize: 22, color: "#fff" }}>{scenario.title}</div>
          <p style={{ fontSize: 14.5, color: SSL.onNavyMuted, marginTop: 8 }}>{scenario.setting}</p>
          <div style={{ marginTop: 12, fontSize: 15, color: "#fff" }}><strong>Task:</strong> {scenario.task}</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: SSL.copperLight, letterSpacing: ".08em", margin: "16px 0 8px" }}>USEFUL PHRASES</div>
          {scenario.phrases.map((p, i) => <div key={i} style={{ fontSize: 14, color: SSL.onNavyMuted, padding: "5px 0" }}>· {p}</div>)}
          <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 16, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${SSL.borderNavy}` }}>{mmss}</div>
        </div>
        <Btn onClick={() => markDone(scenario.id)} style={{ width: "100%", marginTop: 16 }}>I've Practised This <span style={{ width: 18, height: 18 }}>{Icon.check}</span></Btn>
      </div>
    );
  }

  return (
    <>
      <GameHeader icon={Icon.spark} label="ORDER CHALLENGE" round={doneCount} total={ORDER_SCENARIOS.length} />
      <div className="ssl-grid4">
        {ORDER_SCENARIOS.map((s) => (
          <div key={s.id} className="ssl-card ssl-focusable" role="button" tabIndex={0} onClick={() => setActive(s.id)}
            style={{ padding: 18, cursor: "pointer", background: SSL.navy, color: SSL.onNavy, border: "none", opacity: done[s.id] ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="ssl-serif" style={{ fontSize: 16.5, color: "#fff" }}>{s.title}</div>
              {done[s.id] && <span style={{ width: 16, height: 16, color: SSL.success, flexShrink: 0 }}>{Icon.check}</span>}
            </div>
            <div style={{ fontSize: 12.5, color: SSL.onNavyMuted, marginTop: 8, lineHeight: 1.4 }}>{s.setting}</div>
          </div>
        ))}
      </div>
      <Btn onClick={finish} style={{ width: "100%", maxWidth: 420, marginTop: 20 }}>Finish</Btn>
    </>
  );
}

function shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
