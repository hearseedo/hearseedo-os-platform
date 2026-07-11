import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { CATEGORIES } from "../speakReady/data";
import { srt } from "../speakReady/i18n";
import { getProgress, getLevelInfo, getPlacement } from "../speakReady/storage";
import PracticeSession from "../speakReady/PracticeSession";
import SavedPhrases from "../speakReady/SavedPhrases";
import Progress from "../speakReady/Progress";
import Assessment from "../speakReady/Assessment";
import PronunciationStudio from "../speakReady/PronunciationStudio";
import ListeningLab from "../speakReady/ListeningLab";

export default function SpeakReady() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { lang } = useLang();
  const [view, setView] = useState("home"); // home | practice:<id> | saved | progress | assessment | pronunciation | listening
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
  if (view === "saved") {
    return <Shell><SavedPhrases user={user} onExit={goHome} /></Shell>;
  }
  if (view === "progress") {
    return <Shell><Progress user={user} onExit={goHome} /></Shell>;
  }
  if (view === "assessment") {
    return <Shell><Assessment user={user} onFinish={goHome} onStartCategory={(id) => setView(`practice:${id}`)} /></Shell>;
  }
  if (view === "pronunciation") {
    return (
      <Shell>
        <PronunciationStudio user={user} onExit={goHome} onBadgesEarned={handleBadgesEarned} />
        <BadgeToast badge={badgeToast} lang={lang} />
      </Shell>
    );
  }
  if (view === "listening") {
    return (
      <Shell>
        <ListeningLab user={user} onExit={goHome} onBadgesEarned={handleBadgesEarned} />
        <BadgeToast badge={badgeToast} lang={lang} />
      </Shell>
    );
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
  const tr = (k) => srt(lang, k);
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a1206 0%, #0a0a0a 100%)",
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
      <span style={{ fontSize: 18 }}>🗣️</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: "#f59e0b" }}>Speak Ready</span>
      <span style={{ marginLeft: 8, fontSize: 10, color: COLORS.textDim, letterSpacing: 1 }}>{tr("university_path")}</span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
        {[{ id: "en", label: "EN" }, { id: "jp", label: "日本語" }].map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            title="Switch reading language — helps if English text is hard to follow"
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
              background: lang === l.id ? "#f59e0b" : "#1a1a1a",
              border: `1px solid ${lang === l.id ? "#f59e0b" : "#333"}`,
              color: lang === l.id ? "#1a0800" : "#fff",
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
      {srt(lang, "footer_line")}
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
        <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{srt(lang, "badge_earned")}</div>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{badgeName}</div>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
    </div>
  );
}

function Home({ user, navigate, setView, lang }) {
  const progress = getProgress(user?.uid);
  const level    = getLevelInfo(user?.uid);
  const placement = getPlacement(user?.uid);
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const totalSessions = Object.values(progress.sessionsCompleted).reduce((a, b) => a + b, 0);
  const tr = (k) => srt(lang, k);
  const jp = lang === "jp";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 16px 20px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{
          display: "inline-block", fontSize: 11, fontWeight: 700, color: "#f59e0b",
          border: "1px solid rgba(245,158,11,0.4)", borderRadius: 20, padding: "5px 14px",
          letterSpacing: 1, marginBottom: 16,
        }}>
          HSDOS.AI → University Path → Speak Ready
        </div>
        <h1 style={{ fontSize: 34, fontWeight: 900, margin: "0 0 10px", letterSpacing: -0.5 }}>Speak Ready</h1>
        <p style={{ fontSize: 16, color: "#f59e0b", fontWeight: 700, margin: "0 0 16px" }}>
          {tr("tagline")}
        </p>
        <p style={{ fontSize: 14, color: COLORS.textMuted, maxWidth: 560, margin: "0 auto 24px", lineHeight: 1.7 }}>
          {tr("home_desc")}
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            onClick={() => setView(`practice:missions`)}
            style={{ padding: "14px 30px", borderRadius: 12, background: "#f59e0b", border: "none", color: "#1a0800", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
          >
            {tr("start_practice")}
          </button>
          <button
            onClick={() => document.getElementById("sr-categories")?.scrollIntoView({ behavior: "smooth" })}
            style={{ padding: "14px 30px", borderRadius: 12, background: "none", border: "1px solid #333", color: COLORS.text, fontSize: 15, fontWeight: 700, cursor: "pointer" }}
          >
            {tr("choose_goal")}
          </button>
        </div>
      </div>

      {/* Placement assessment banner */}
      <div
        onClick={() => setView("assessment")}
        style={{
          background: placement ? COLORS.card : "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))",
          border: `1px solid ${placement ? "#1e1e1e" : "rgba(245,158,11,0.4)"}`,
          borderRadius: 14, padding: "16px 20px", marginBottom: 28, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 14,
        }}
      >
        <span style={{ fontSize: 26 }}>🧭</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>
            {placement
              ? (jp ? `あなたのレベル: ${placement.level}` : `Your level: ${placement.level}`)
              : (jp ? "無料のプレイスメント診断を受ける" : "Take the free placement assessment")}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            {placement
              ? (jp ? "もう一度受けて、成長を確認しよう" : "Retake it anytime to see how you've grown")
              : (jp ? "5分であなたに合った練習を見つけよう" : "5 minutes to find your starting point")}
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b" }}>{tr("start_arrow")}</span>
      </div>

      {/* Category cards */}
      <div id="sr-categories" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
        {CATEGORIES.map((c) => (
          <div
            key={c.id}
            onClick={() => setView(`practice:${c.id}`)}
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

      {/* Skill Labs */}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
        {jp ? "スキルラボ" : "Skill Labs"}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
        <div
          onClick={() => setView("pronunciation")}
          style={{ background: COLORS.card, border: "1px solid rgba(129,140,248,0.33)", borderRadius: 16, padding: 22, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#818cf8"; e.currentTarget.style.boxShadow = "0 0 20px rgba(129,140,248,0.22)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(129,140,248,0.33)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>👂</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{jp ? "発音スタジオ" : "Pronunciation Studio"}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
            {jp ? "お手本と聞き比べて練習しよう" : "Listen, record, and compare with a model"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#818cf8" }}>{tr("start_arrow")}</div>
        </div>
        <div
          onClick={() => setView("listening")}
          style={{ background: COLORS.card, border: "1px solid rgba(6,182,212,0.33)", borderRadius: 16, padding: 22, cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#06b6d4"; e.currentTarget.style.boxShadow = "0 0 20px rgba(6,182,212,0.22)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(6,182,212,0.33)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎧</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{jp ? "リスニングラボ" : "Listening Lab"}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
            {jp ? "様々な英語のアクセントを聞き取ろう" : "American and British accents, answered by speech"}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#06b6d4" }}>{tr("start_arrow")}</div>
        </div>
      </div>

      {/* Dashboard sections */}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 14 }}>
        {`${tr("welcome_back")}, ${firstName}`}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 28 }}>
        <DashCard icon="📅" title={tr("todays_practice")} desc={totalSessions > 0 ? `${totalSessions} ${tr("sessions_so_far")}` : tr("start_first_session")} onClick={() => setView("practice:missions")} />
        <DashCard icon="🧭" title={tr("speaking_path")} desc={tr("speaking_path_desc")} onClick={() => document.getElementById("sr-categories")?.scrollIntoView({ behavior: "smooth" })} />
        <DashCard icon="💾" title={tr("saved_phrases")} desc={tr("saved_phrases_desc")} onClick={() => setView("saved")} />
        <DashCard icon="⚡" title={tr("conversation_practice")} desc={tr("conversation_practice_desc")} onClick={() => setView("practice:quick_thinking")} />
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
