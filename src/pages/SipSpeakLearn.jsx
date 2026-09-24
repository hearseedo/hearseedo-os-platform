// Sip Speak Learn — native app page (Phase 1: App Shell)
// Route: /sip-speak-learn (feature-flagged, not in production nav yet).
// Internal view router: welcome · dashboard · seasons · season · lesson · games · events · progress · saved
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { SSL } from "../sipSpeakLearn/constants";
import { SSLStyles, Icon, Ring, Btn } from "../sipSpeakLearn/ui";
import { SEASONS, SEASON_MAP, LESSONS_BY_SEASON, LESSON_DURATION_MIN, lessonThumb } from "../sipSpeakLearn/data";
import { getStats, seasonProgress, lessonState } from "../sipSpeakLearn/storage";
import Lesson from "../sipSpeakLearn/Lesson";
import SavedExpressions from "../sipSpeakLearn/SavedExpressions";
import GameSession, { GamesHub } from "../sipSpeakLearn/Games";
import { GAMES } from "../sipSpeakLearn/gamesData";
import TableMode from "../sipSpeakLearn/TableMode";
import HostMode from "../sipSpeakLearn/HostMode";
import { profileScopedStorageUid } from "../lib/profileScope";

const NAV = [
  { id: "dashboard", label: "Home",     icon: Icon.home },
  { id: "seasons",   label: "Seasons",  icon: Icon.seasons },
  { id: "games",     label: "Conversation Games", short: "Games", icon: Icon.games },
  { id: "events",    label: "Events",   icon: Icon.events },
  { id: "progress",  label: "Progress", icon: Icon.progress },
  { id: "saved",     label: "Saved",    icon: Icon.saved },
];

export default function SipSpeakLearn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid;
  // Profile-scoped identifier for PERSONAL LEARNING PROGRESS only (P0,
  // 2026-09-24 — removes the previous "guest" localStorage fallback, which
  // had no legitimate use: this route is auth-gated, so a real uid is
  // always present here). Deliberately NOT used for TableMode/HostMode
  // below — those write real Firestore docs whose security rules check
  // request.auth.uid directly (hostUid), so they keep receiving the real,
  // unscoped `uid` — Table/Host Mode is a real-identity multiplayer
  // feature, not a per-profile learning-progress concept.
  const storageUid = profileScopedStorageUid(uid, user?.activeProfileId);
  const firstName = (user?.name || user?.displayName || "there").split(" ")[0];

  // view is either a nav id, "welcome", or a nested { name, ... }
  // Entry-friction fix (2026-09-24): the Welcome splash used to show on
  // EVERY visit, even for a returning user who already knows they want
  // Solo Practice — "Home -> tap app -> app opens" shouldn't need a second
  // "Enter"/mode-picker tap once HSD already knows this person has been
  // here before. Skip straight to the dashboard when there's any existing
  // progress; a genuinely first-time learner still sees Welcome once.
  const [view, setView] = useState(() => {
    const stats = getStats(storageUid);
    const hasHistory = stats.completed > 0 || stats.speakingMinutes > 0 || stats.savedCount > 0 || stats.conversationsCompleted > 0;
    return hasHistory ? "dashboard" : "welcome";
  });
  const go = (v) => { setView(v); window.scrollTo?.(0, 0); };

  // ── Welcome (full-bleed, no chrome) ──
  if (view === "welcome") {
    return (
      <div className="ssl-root">
        <SSLStyles />
        <Welcome onEnter={() => go("dashboard")} exitPlatform={() => navigate("/dashboard")} go={go} />
      </div>
    );
  }

  const activeTab = typeof view === "string" ? view : view.name;

  return (
    <div className="ssl-root">
      <SSLStyles />
      <MobileTop />
      <div className="ssl-shell">
        <Sidebar active={activeTab} onNav={go} firstName={firstName} onProfile={() => navigate("/dashboard")} />
        <main className="ssl-main">
          <div className="ssl-page">
            {/* storageUid (P0, 2026-09-24): personal learning progress is
                profile-scoped. TableMode/HostMode below deliberately keep
                the real `uid` — see the storageUid comment above. */}
            {activeTab === "dashboard" && <Dashboard uid={storageUid} firstName={firstName} go={go} />}
            {activeTab === "seasons"   && <Seasons go={go} uid={storageUid} />}
            {typeof view === "object" && view.name === "season" && <Season seasonId={view.seasonId} uid={storageUid} go={go} />}
            {typeof view === "object" && view.name === "lesson" && (
              <Lesson seasonId={view.seasonId} n={view.n} uid={storageUid}
                onExit={(completed) => go(completed ? { name: "season", seasonId: view.seasonId, done: view.n } : { name: "season", seasonId: view.seasonId })} />
            )}
            {activeTab === "games" && typeof view === "string" && <GamesHub go={go} />}
            {typeof view === "object" && view.name === "game" && <GameSession gameId={view.gameId} uid={storageUid} go={go} />}
            {activeTab === "events"   && <TableMode uid={uid} user={user} go={go} />}
            {activeTab === "host"     && <HostMode uid={uid} user={user} go={go} />}
            {activeTab === "progress" && <ProgressView uid={storageUid} go={go} />}
            {activeTab === "saved"    && <SavedExpressions uid={storageUid} go={go} />}
          </div>
        </main>
      </div>
      <MobileNav active={activeTab} onNav={go} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────── Layout chrome ──
function Sidebar({ active, onNav, firstName, onProfile }) {
  return (
    <aside className="ssl-sidebar">
      <div className="ssl-logo"><img src="/ssl/ssl-logo.png" alt="Sip Speak Learn" /></div>
      <nav className="ssl-nav">
        {NAV.map((n) => (
          <button key={n.id} className={`ssl-navItem ssl-focusable ${active === n.id ? "active" : ""}`}
            onClick={() => onNav(n.id)} aria-current={active === n.id ? "page" : undefined}>
            {n.icon}<span>{n.label}</span>
          </button>
        ))}
      </nav>
      <div className="ssl-navSpacer" />
      <button className="ssl-profile ssl-focusable" onClick={onProfile}
        style={{ background: "none", border: "none", cursor: "pointer", width: "100%" }}>
        <div className="ssl-avatar">{firstName[0]?.toUpperCase()}</div>
        <div style={{ textAlign: "left" }}>
          <div className="nm">{firstName}</div>
          <div className="sub">HSD OS · Back to hub</div>
        </div>
      </button>
    </aside>
  );
}

function MobileTop() {
  return (
    <div className="ssl-mobileTop">
      <img src="/ssl/ssl-logo-horizontal.png" alt="Sip Speak Learn" />
    </div>
  );
}

function MobileNav({ active, onNav }) {
  return (
    <nav className="ssl-mobileNav">
      {NAV.map((n) => (
        <button key={n.id} className={active === n.id ? "active" : ""} onClick={() => onNav(n.id)}>
          {n.icon}<span>{n.short || n.label}</span>
        </button>
      ))}
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────── Welcome ──
function Welcome({ onEnter, exitPlatform, go }) {
  const modes = [
    { id: "solo", title: "Solo Practice", icon: Icon.chat, onClick: onEnter, sub: "Available now" },
    { id: "table", title: "Table Mode", icon: Icon.events, onClick: () => go("events"), sub: "Available now" },
    { id: "host", title: "Host an Event", icon: Icon.spark, onClick: () => go("host"), sub: "Available now" },
  ];
  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden",
      background: `#0a1a2e url('/ssl/ssl-welcome-hero.jpg') center/cover no-repeat` }}>
      {/* Animated background video (falls back to the poster image above) */}
      <video
        src="/ssl/ssl-welcome-hero.mp4"
        poster="/ssl/ssl-welcome-hero.jpg"
        autoPlay loop muted playsInline preload="auto"
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />
      {/* Legibility overlay */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0,
        background: "linear-gradient(rgba(10,26,46,.5), rgba(10,26,46,.78))" }} />

      <header style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px" }}>
        <img src="/ssl/ssl-logo-horizontal.png" alt="Sip Speak Learn" style={{ height: 46 }} />
        <button onClick={exitPlatform} className="ssl-focusable"
          style={{ background: "none", border: "none", color: SSL.onNavy, fontWeight: 600, fontSize: 15, cursor: "pointer" }}>
          Back to HSD OS
        </button>
      </header>

      <div style={{ position: "relative", zIndex: 1, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 32px", maxWidth: 1180, margin: "0 auto", width: "100%" }}>
        <h1 className="ssl-serif" style={{ color: "#f6f0e6", fontSize: "clamp(40px, 7vw, 76px)", lineHeight: 1.02, fontWeight: 600, maxWidth: 720 }}>
          Good drinks.<br />Great conversations.
        </h1>
        <p style={{ color: SSL.copperLight, fontSize: "clamp(18px,2.4vw,24px)", marginTop: 18, fontWeight: 500 }}>
          Choose your way to speak.
        </p>
        <div style={{ marginTop: 30 }}>
          <Btn onClick={onEnter} style={{ fontSize: 17, padding: "16px 34px" }}>Enter the Café</Btn>
        </div>

        <div className="ssl-grid4" style={{ gridTemplateColumns: "repeat(3,1fr)", marginTop: 40, maxWidth: 860 }}>
          {modes.map((m) => (
            <button key={m.id} onClick={m.onClick} className="ssl-focusable"
              style={{ background: "rgba(10,26,46,.5)", border: `1px solid ${SSL.borderNavy}`, borderRadius: 16,
                padding: "26px 20px", color: SSL.onNavy, cursor: "pointer", textAlign: "center",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 12, backdropFilter: "blur(3px)" }}>
              <span style={{ width: 40, height: 40, color: SSL.copperLight }}>{m.icon}</span>
              <span className="ssl-serif" style={{ fontSize: 22, color: "#f6f0e6" }}>{m.title}</span>
              <span style={{ fontSize: 12.5, color: SSL.onNavyMuted, fontWeight: 600 }}>{m.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", height: 84 }}>
        {SEASONS.map((s) => (
          <button key={s.id} onClick={() => { onEnter(); }} className="ssl-focusable"
            style={{ flex: 1, position: "relative", border: "none", cursor: "pointer", overflow: "hidden",
              backgroundImage: `url('${s.strip}')`, backgroundSize: "cover", backgroundPosition: "center" }}>
            <span style={{ position: "absolute", inset: 0, background: "rgba(10,26,46,.45)" }} />
            <span style={{ position: "relative", color: "#fff", fontWeight: 700, letterSpacing: ".16em",
              fontSize: 13, textTransform: "uppercase" }}>{s.name.split(" ")[0]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────── Dashboard ──
function Dashboard({ uid, firstName, go }) {
  const stats = getStats(uid);
  const resume = stats.lastLesson ? SEASON_MAP[stats.lastLesson.seasonId] : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 className="ssl-serif" style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 600 }}>Ready to speak, {firstName}?</h1>
      </div>

      <div className="ssl-row" style={{ marginTop: 24, alignItems: "stretch", flexWrap: "wrap" }}>
        {/* Left column */}
        <div style={{ flex: "1 1 620px", minWidth: 0 }}>
          {/* Resume banner */}
          <div className="ssl-card ssl-resume" style={{ background: SSL.navy, border: "none", borderRadius: SSL.radiusLg, overflow: "hidden" }}>
            <div className="thumb" style={{ backgroundImage: `url('${resume?.image || SEASONS[3].image}')` }} />
            <div style={{ flex: 1, minWidth: 160, color: SSL.onNavy }}>
              <div className="ssl-serif" style={{ fontSize: 22, color: "#fff" }}>
                {resume ? `Continue ${resume.name.split(" ")[0]}` : "Start your first lesson"}
              </div>
              <div style={{ fontSize: 13.5, color: SSL.onNavyMuted, marginTop: 3 }}>
                {resume ? `Lesson ${stats.lastLesson.n} · ${resume.name}` : "Pick a season below and begin."}
              </div>
            </div>
            <Btn onClick={() => resume ? go({ name: "lesson", seasonId: stats.lastLesson.seasonId, n: stats.lastLesson.n }) : go("seasons")}>
              {resume ? "Resume" : "Browse"}
            </Btn>
          </div>

          {/* Season cards */}
          <div className="ssl-grid4" style={{ marginTop: 22 }}>
            {SEASONS.map((s) => {
              const sp = seasonProgress(uid, s.id);
              return (
                <div key={s.id} className="ssl-seasonCard" onClick={() => go({ name: "season", seasonId: s.id })}
                  role="button" tabIndex={0}>
                  {/* season cover */}
                  <img src={s.image} alt={s.name} />
                  <div className="ov" />
                  <div className="cap">
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: s.accent,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, marginBottom: 8 }}>{s.icon}</div>
                    <div className="ssl-serif" style={{ fontSize: 21 }}>{s.name}</div>
                    <div style={{ fontSize: 12.5, opacity: .85, marginTop: 2 }}>
                      {sp.done > 0 ? `${sp.done}/${sp.total} lessons` : "8 lessons"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Games row */}
          <h2 className="ssl-serif" style={{ fontSize: 26, marginTop: 34, marginBottom: 14 }}>Conversation Games</h2>
          <div className="ssl-grid4">
            {GAMES.map((g) => (
              <button key={g.id} onClick={() => go({ name: "game", gameId: g.id })} className="ssl-card ssl-focusable"
                style={{ padding: "22px 14px", cursor: "pointer", textAlign: "center", background: SSL.creamCard,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{g.icon}</span>
                <span className="ssl-serif" style={{ fontSize: 16.5, lineHeight: 1.2 }}>{g.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="ssl-card" style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: SSL.inkSoft, marginBottom: 14 }}>Confidence Journey</div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Ring pct={stats.confidencePct} color={SSL.teal} track={SSL.creamPanel}>
                <div className="ssl-serif" style={{ fontSize: 34, color: SSL.ink }}>{stats.confidencePct}%</div>
              </Ring>
            </div>
            <div style={{ fontSize: 13, color: SSL.textMuted, marginTop: 12 }}>You're building great momentum.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Stat n={stats.conversationsCompleted} label="conversations" />
              <Stat n={stats.speakingMinutes} label="min speaking" />
            </div>
          </div>

          <div className="ssl-card" style={{ padding: 22, background: SSL.navy, border: "none", color: SSL.onNavy }}>
            <div className="ssl-pill" style={{ background: SSL.copper, color: "#fff", marginBottom: 10 }}>NEW</div>
            <div className="ssl-serif" style={{ fontSize: 20, color: "#fff" }}>Table Mode & Host tools are live</div>
            <p style={{ fontSize: 13.5, color: SSL.onNavyMuted, margin: "8px 0 14px", lineHeight: 1.5 }}>
              Join a live table with an event code, try a demo table solo, or host your own multi-table conversation event.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn variant="onNavy" onClick={() => go("events")}>Join a Table</Btn>
              <Btn variant="onNavy" onClick={() => go("host")}>Host an Event</Btn>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ n, label }) {
  return (
    <div style={{ flex: 1, background: SSL.creamPanel, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
      <div className="ssl-serif" style={{ fontSize: 22, color: SSL.ink }}>{n}</div>
      <div style={{ fontSize: 11.5, color: SSL.textMuted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────── Seasons ──
function Seasons({ go, uid }) {
  return (
    <>
      <span className="ssl-eyebrow">Four seasons · 32 conversations</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(30px,4vw,44px)", fontWeight: 600, margin: "6px 0 22px" }}>Choose your season</h1>
      <div className="ssl-grid4">
        {SEASONS.map((s) => {
          const sp = seasonProgress(uid, s.id);
          return (
            <div key={s.id} className="ssl-seasonCard" onClick={() => go({ name: "season", seasonId: s.id })} role="button" tabIndex={0}>
              <img src={s.image} alt={s.name} />
              <div className="ov" />
              <div className="cap">
                <div className="ssl-serif" style={{ fontSize: 22 }}>{s.name}</div>
                <div style={{ fontSize: 13, opacity: .88, marginTop: 4 }}>{s.tagline}</div>
                <div style={{ fontSize: 12, opacity: .8, marginTop: 8 }}>{sp.done}/{sp.total} completed</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────── Season (lesson select) ──
function Season({ seasonId, uid, go }) {
  const s = SEASON_MAP[seasonId];
  const lessons = LESSONS_BY_SEASON[seasonId];
  const sp = seasonProgress(uid, seasonId);

  return (
    <>
      <button onClick={() => go("seasons")} className="ssl-focusable"
        style={{ background: "none", border: "none", color: SSL.copper, fontWeight: 600, cursor: "pointer", marginBottom: 12, fontSize: 14 }}>
        ← All seasons
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="ssl-serif" style={{ fontSize: "clamp(30px,4.5vw,48px)", fontWeight: 600 }}>{s.name}</h1>
          <p style={{ color: SSL.inkSoft, fontSize: 16, marginTop: 6 }}>{s.description}</p>
        </div>
        <Btn variant="ghost" onClick={() => alert("Workbook downloads arrive in Phase 2.")}>
          <span style={{ width: 18, height: 18 }}>{Icon.download}</span> Download Workbook
        </Btn>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "18px 0 24px" }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{sp.done} of {sp.total} lessons completed</div>
        <div style={{ flex: 1, maxWidth: 420, height: 8, background: SSL.creamPanel, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${sp.pct}%`, height: "100%", background: SSL.copper }} />
        </div>
      </div>

      <div className="ssl-grid4">
        {lessons.map((l) => {
          const state = lessonState(uid, l.id);
          return (
            <div key={l.id} className={`ssl-lessonCard ${state === "not-started" ? "" : ""}`}
              onClick={() => go({ name: "lesson", seasonId, n: l.n })} role="button" tabIndex={0}>
              <div className="ssl-lessonThumb" style={{ background: `linear-gradient(135deg, ${s.accent}55, ${SSL.navy})` }}>
                <img src={lessonThumb(l.id)} alt="" loading="lazy"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                <div className="grad" />
                <div style={{ position: "absolute", top: 10, left: 12, width: 30, height: 30, borderRadius: "50%",
                  background: "rgba(255,255,255,.15)", color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", fontWeight: 700, fontSize: 14, border: "1px solid rgba(255,255,255,.3)" }}>{l.n}</div>
                {state === "completed" && (
                  <div style={{ position: "absolute", top: 10, right: 12, width: 26, height: 26, borderRadius: "50%",
                    background: SSL.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ width: 15, height: 15 }}>{Icon.check}</span>
                  </div>
                )}
              </div>
              <div className="ssl-lessonBody">
                <div className="ssl-serif" style={{ fontSize: 17, color: "#fff", lineHeight: 1.2 }}>{l.theme}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: SSL.onNavyMuted, marginTop: 8 }}>
                  <span style={{ width: 14, height: 14 }}>{Icon.clock}</span> {LESSON_DURATION_MIN}
                </div>
                {state === "in-progress" && (
                  <div style={{ marginTop: 10 }}>
                    <span className="ssl-pill" style={{ background: SSL.copper, color: "#fff" }}>Resume</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────── Progress ──
function ProgressView({ uid, go }) {
  const stats = getStats(uid);
  return (
    <>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 600, marginBottom: 6 }}>Your Confidence Journey</h1>
      <p style={{ color: SSL.inkSoft, marginBottom: 24 }}>Progress here is about confidence, participation and communication — never scores or streaks.</p>
      <div className="ssl-grid4">
        <MetricCard big={`${stats.confidencePct}%`} label="Confidence" />
        <MetricCard big={stats.completed} label={`of ${stats.totalLessons} lessons`} />
        <MetricCard big={stats.speakingMinutes} label="minutes speaking" />
        <MetricCard big={stats.conversationsCompleted} label="conversations" />
      </div>
      <div className="ssl-card" style={{ padding: 24, marginTop: 20 }}>
        <div className="ssl-serif" style={{ fontSize: 20 }}>Season progress</div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {SEASONS.map((s) => {
            const sp = seasonProgress(uid, s.id);
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 120, fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                <div style={{ flex: 1, height: 8, background: SSL.creamPanel, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: `${sp.pct}%`, height: "100%", background: s.accent }} />
                </div>
                <div style={{ width: 44, textAlign: "right", fontSize: 13, color: SSL.textMuted }}>{sp.done}/{sp.total}</div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function MetricCard({ big, label }) {
  return (
    <div className="ssl-card" style={{ padding: "22px 18px", textAlign: "center" }}>
      <div className="ssl-serif" style={{ fontSize: 34, color: SSL.ink }}>{big}</div>
      <div style={{ fontSize: 13, color: SSL.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────── Placeholder ──
function Placeholder({ title, phase, blurb, icon, go }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "60px 20px", minHeight: "60vh" }}>
      <div style={{ width: 56, height: 56, color: SSL.copper, marginBottom: 18 }}>{icon}</div>
      <span className="ssl-pill" style={{ background: SSL.creamPanel, color: SSL.copper, marginBottom: 14 }}>{phase}</span>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,4vw,38px)", fontWeight: 600 }}>{title}</h1>
      <p style={{ color: SSL.inkSoft, maxWidth: 460, marginTop: 12, lineHeight: 1.6 }}>{blurb}</p>
      <Btn variant="ghost" onClick={() => go("dashboard")} style={{ marginTop: 24 }}>Back to Home</Btn>
    </div>
  );
}
