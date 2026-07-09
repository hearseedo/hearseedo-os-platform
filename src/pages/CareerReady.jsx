import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { CATEGORIES } from "../careerReady/data";
import { crt } from "../careerReady/i18n";
import { getProgress, getLevelInfo } from "../careerReady/storage";
import PracticeSession from "../careerReady/PracticeSession";
import ResumeTool from "../careerReady/ResumeTool";
import SavedAnswers from "../careerReady/SavedAnswers";
import Progress from "../careerReady/Progress";

export default function CareerReady() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();
  const [view, setView] = useState("home"); // home | practice:<id> | resume | saved | progress
  const [badgeToast, setBadgeToast] = useState(null);

  const goHome = () => setView("home");

  const handleBadgesEarned = (badges) => {
    if (!badges?.length) return;
    setBadgeToast(badges[0]);
    setTimeout(() => setBadgeToast(null), 4000);
  };

  if (view.startsWith("practice:")) {
    const categoryId = view.split(":")[1];
    return (
      <Shell>
        <PracticeSession categoryId={categoryId} user={user} onExit={goHome} onBadgesEarned={handleBadgesEarned} />
        <BadgeToast badge={badgeToast} lang={lang} />
      </Shell>
    );
  }
  if (view === "resume") {
    return (
      <Shell>
        <ResumeTool user={user} onExit={goHome} onBadgesEarned={handleBadgesEarned} />
        <BadgeToast badge={badgeToast} lang={lang} />
      </Shell>
    );
  }
  if (view === "saved") {
    return <Shell><SavedAnswers user={user} onExit={goHome} /></Shell>;
  }
  if (view === "progress") {
    return <Shell><Progress user={user} onExit={goHome} /></Shell>;
  }

  return (
    <Shell>
      <Home user={user} navigate={navigate} setView={setView} lang={lang} />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <TopBar />
      {children}
      <Footer />
    </div>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const { lang, setLang } = useLang();
  const tr = (k) => crt(lang, k);
  return (
    <div style={{
      background: "linear-gradient(135deg, #0a1a1a 0%, #0a0a0a 100%)",
      borderBottom: "1px solid #1e1e1e", padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50,
    }}>
      <button
        onClick={() => navigate("/dashboard")}
        style={{ background: "none", border: "none", color: COLORS.textMuted, fontSize: 13, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}
      >
        ← HSDOS.AI
      </button>
      <div style={{ width: 1, height: 18, background: "#2a2a2a" }} />
      <img src="/assets/icon-career-ready.png" alt="Career Ready" style={{ width: 26, height: 26, borderRadius: 7 }} />
      <span style={{ fontSize: 13, fontWeight: 800, color: "#2ec4b6" }}>Career Ready</span>
      <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.textDim, letterSpacing: 1 }}>{tr("university_path")}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
        {[{ id: "en", label: "EN" }, { id: "jp", label: "日本語" }].map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            title="Switch reading language — helps if English text is hard to follow"
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: lang === l.id ? "#2ec4b6" : "#1a1a1a",
              border: `1px solid ${lang === l.id ? "#2ec4b6" : "#333"}`,
              color: lang === l.id ? "#00201d" : "#fff",
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Footer() {
  const { lang } = useLang();
  return (
    <div style={{ textAlign: "center", padding: "28px 16px 40px", color: COLORS.textDim, fontSize: 11 }}>
      {crt(lang, "footer_line")}
    </div>
  );
}

function BadgeToast({ badge, lang }) {
  if (!badge) return null;
  const badgeName = lang === "jp" && badge.nameJp ? badge.nameJp : badge.name;
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      background: "#161616", border: `1px solid ${COLORS.gold}66`, borderRadius: 14,
      padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, zIndex: 300,
      boxShadow: `0 0 24px ${COLORS.gold}33`, animation: "fadeIn 0.3s ease",
    }}>
      <span style={{ fontSize: 26 }}>{badge.icon}</span>
      <div>
        <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{crt(lang, "badge_earned")}</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{badgeName}</div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}

function Home({ user, navigate, setView, lang }) {
  const progress = getProgress(user?.uid);
  const level    = getLevelInfo(user?.uid);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const totalSessions = Object.values(progress.sessionsCompleted).reduce((a, b) => a + b, 0);
  const tr = (k) => crt(lang, k);
  const jp = lang === "jp";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 16px 20px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{
          display: "inline-block", fontSize: 11, fontWeight: 700, color: "#2ec4b6",
          border: "1px solid rgba(46,196,182,0.4)", borderRadius: 20, padding: "5px 14px",
          letterSpacing: 1, marginBottom: 16,
        }}>
          HSDOS.AI → University Path → Career Ready
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 10px", letterSpacing: -0.5 }}>Career Ready</h1>
        <p style={{ fontSize: 16, color: "#2ec4b6", fontWeight: 700, margin: "0 0 16px" }}>
          {tr("tagline")}
        </p>
        <p style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.7 }}>
          {tr("home_desc")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setView(`practice:interview`)}
            style={{ padding: "14px 30px", borderRadius: 12, background: "#2ec4b6", border: "none", color: "#00201d", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
          >
            {tr("start_practice")}
          </button>
          <button
            onClick={() => document.getElementById("cr-categories")?.scrollIntoView({ behavior: "smooth" })}
            style={{ padding: "14px 30px", borderRadius: 12, background: "none", border: "1px solid #333", color: COLORS.text, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            {tr("choose_goal")}
          </button>
        </div>
      </div>

      {/* Category cards */}
      <div id="cr-categories" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 36 }}>
        {CATEGORIES.map((c) => (
          <div
            key={c.id}
            onClick={() => setView(c.id === "resume" ? "resume" : `practice:${c.id}`)}
            style={{
              background: COLORS.card, border: `1px solid ${c.color}33`, borderRadius: 16,
              padding: 22, cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.boxShadow = `0 0 20px ${c.color}22`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = `${c.color}33`; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ fontSize: 32, marginBottom: 12 }}>{c.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{jp && c.nameJp ? c.nameJp : c.name}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 14 }}>{jp && c.descJp ? c.descJp : c.desc}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.color }}>{tr("start_arrow")}</div>
          </div>
        ))}
      </div>

      {/* Dashboard sections */}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
        {`${tr("welcome_back")}, ${firstName}`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
        <DashCard icon="📅" title={tr("todays_practice")} desc={totalSessions > 0 ? `${totalSessions} ${tr("sessions_so_far")}` : tr("start_first_session")} onClick={() => setView("practice:interview")} />
        <DashCard icon="🧭" title={tr("career_path")} desc={tr("career_path_desc")} onClick={() => document.getElementById("cr-categories")?.scrollIntoView({ behavior: "smooth" })} />
        <DashCard icon="💾" title={tr("saved_answers")} desc={tr("saved_answers_desc")} onClick={() => setView("saved")} />
        <DashCard icon="✉️" title={tr("resume_email_tools")} desc={tr("resume_email_tools_desc")} onClick={() => setView("resume")} />
        <DashCard icon="📈" title={tr("confidence_progress")} desc={`Level ${level.level}: ${jp && level.nameJp ? level.nameJp : level.name}`} onClick={() => setView("progress")} />
      </div>
    </div>
  );
}

function DashCard({ icon, title, desc, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16, cursor: "pointer", transition: "all 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#333"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1e1e1e"; }}
    >
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.4 }}>{desc}</div>
    </div>
  );
}
