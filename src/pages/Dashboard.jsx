import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { NAV_ITEMS } from "../constants/nav";
import { logout, awardXP } from "../lib/firebase";
import { db } from "../lib/firebase";
import { doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp, collection, addDoc, deleteDoc, onSnapshot, orderBy, query, limit } from "firebase/firestore";
import { useAuth } from "../hooks/useAuth";
import { useMobile } from "../hooks/useMobile";
import { getLearnerProfile } from "../lib/learnerProfile";
import { generateRecommendations } from "../lib/recommendationEngine";
import { useSubscription } from "../hooks/useSubscription";
import { APPS } from "../constants/apps";
import AppOrbit from "../components/AppOrbit";
import AppModal from "../components/AppModal";
import AIChat from "../components/AIChat";
import WelcomeSequence from "../components/WelcomeSequence";
import ProgressBar from "../components/ProgressBar";
import ConfidenceRing from "../components/ConfidenceRing";
import LearningPath from "../components/LearningPath";
import Subscriptions from "../components/Subscriptions";
import AICoach from "../components/AICoach";
import Achievements from "../components/Achievements";
import Events from "../components/Events";
import FoundingBadge from "../components/FoundingBadge";
import WarmUp from "../components/WarmUp";
import ProgressJourney, { CEFR_META } from "../components/ProgressJourney";
import Leaderboard from "../components/Leaderboard";
import PulseFeedback from "../components/PulseFeedback";
import JonaInbox    from "../components/JonaInbox";
import WeeklyReport        from "../components/WeeklyReport";
import CelebrationOverlay, { CEL } from "../components/CelebrationOverlay";
import { useLang } from "../hooks/useLang";
import { isAccessActive, formatExpiry, daysUntilExpiry } from "../lib/accessCodeUtils";
import { JonaProvider, useJona } from "../context/JonaContext";
import FoundingBanner from "../components/FoundingBanner";

export default function Dashboard() {
  const { user, profileReady, isAdmin } = useAuth();
  const { defaultView, isUnlocked }    = useSubscription();
  const navigate           = useNavigate();
  const location           = useLocation();
  const { lang, setLang, t } = useLang();
  const isMobile           = useMobile();
  const [showWelcome, setShowWelcome] = useState(() => {
    // Only show welcome once per browser session (not on every navigation to /dashboard)
    if (sessionStorage.getItem("hsd_welcome_shown")) return false;
    return true;
  });
  const [orbitView, setOrbitView]     = useState(defaultView());
  const [selectedApp, setSelectedApp] = useState(null);
  const [activeNav, setActiveNav]     = useState("home");
  const [activeMember, setActiveMember] = useState(null); // null = viewing own profile
  const [familyMembers, setFamilyMembers] = useState([]);
  const [showPulse, setShowPulse]         = useState(false);
  const [pulseTrigger, setPulseTrigger]   = useState("general");
  const [notifications, setNotifications] = useState([]);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [daysAway,        setDaysAway]        = useState(0);
  const [showInbox,       setShowInbox]       = useState(false);
  const [showReport,      setShowReport]      = useState(false);
  const [reportWeek,      setReportWeek]      = useState(null);
  const [celebration,       setCelebration]       = useState(null);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);
  const [paymentPlan,        setPaymentPlan]        = useState("");
  const chatInputRef     = useRef(null);
  const chatContainerRef = useRef(null);
  const jonaSpeak        = useRef(null); // populated by CoachingCard when card loads

  const onJonaClick = () => {
    if (jonaSpeak.current) {
      jonaSpeak.current();
    } else {
      // fallback: focus chat if coaching not ready yet
      chatContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => chatInputRef.current?.focus(), 350);
    }
  };

  useEffect(() => {
    if (!user?.uid || isAdmin) return;
    const q = query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user?.uid, isAdmin]);

  // Detect Stripe redirect: /dashboard?payment=success&plan=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      const planId   = params.get("plan") || "";
      const planName = PLANS.find(p => p.id === planId)?.name || planId;
      setPaymentPlan(planName);
      setShowPaymentSuccess(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const dismissNotification = async (id) => {
    await updateDoc(doc(db, "users", user.uid, "notifications", id), { read: true }).catch(() => {});
  };

  const markAllRead = async () => {
    await Promise.all(
      notifications.filter(n => !n.read).map(n =>
        updateDoc(doc(db, "users", user.uid, "notifications", n.id), { read: true }).catch(() => {})
      )
    );
  };

  const handleInboxAction = async (notif) => {
    await dismissNotification(notif.id);
    setShowInbox(false);
    if (notif.action?.type === "navigate" && notif.action?.to) {
      navigate(notif.action.to);
    } else if (notif.action?.type === "open_app" && notif.action?.appId) {
      const app = APPS.find(a => a.id === notif.action.appId);
      if (app) setSelectedApp(app);
    } else if (notif.action?.type === "open_report") {
      setReportWeek(notif.action.week ?? isoWeekJST());
      setShowReport(true);
    }
  };

  function isoWeekJST(date = new Date()) {
    const jst = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
    const d   = new Date(Date.UTC(jst.getFullYear(), jst.getMonth(), jst.getDate()));
    const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  // ── Notification writers ────────────────────────────────────────────────

  // Streak milestone
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin || !notifications) return;
    const streak = user?.streak ?? 0;
    const MILESTONES = { 3: ["3-day streak!", "You're building a real habit. Keep this going."], 7: ["7 days straight!", "One full week. That's discipline, not luck."], 14: ["Two weeks running!", "You're in the top 10% of learners who actually stick with it."], 30: ["30-day streak. 🔥", "A full month of English practice. You should be proud of this."], 60: ["60 days!", "Two months of consistency. Your brain is actively rewiring for English."], 90: ["90-day streak!", "Three months. You've made English practice part of who you are."] };
    if (!MILESTONES[streak]) return;
    const key = `streak_milestone_${streak}`;
    if (notifications.some(n => n.key === key)) return;
    const [title, message] = MILESTONES[streak];
    addDoc(collection(db, "users", user.uid, "notifications"), { key, category: "streak", title, message, read: false, action: { type: "navigate", label: "See my progress", to: "/dashboard" }, createdAt: new Date().toISOString() }).catch(() => {});
  }, [user?.streak, profileReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Return after break
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    const VISIT_KEY = `hsd_last_visit_${user.uid}`;
    const last = localStorage.getItem(VISIT_KEY);
    const now  = Date.now();
    if (last) {
      const days = (now - parseInt(last, 10)) / 86400000;
      if (days >= 3) {
        const weekBucket = Math.floor(now / (7 * 86400000));
        const key = `return_break_${weekBucket}`;
        if (!notifications.some(n => n.key === key)) {
          const d = Math.floor(days);
          addDoc(collection(db, "users", user.uid, "notifications"), { key, category: "return", title: "Welcome back!", message: `It's been ${d} day${d === 1 ? "" : "s"} since you last practiced. I kept your spot warm. Ready to pick up where you left off?`, read: false, action: { type: "navigate", label: "Jump back in", to: "/dashboard" }, createdAt: new Date().toISOString() }).catch(() => {});
        }
      }
    }
    localStorage.setItem(VISIT_KEY, String(now));
  }, [user?.uid, profileReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Weekly report generator — fires once per ISO week per user
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    const week    = isoWeekJST();
    const lsKey   = `hsd_weekly_report_${user.uid}_${week}`;
    if (localStorage.getItem(lsKey)) return;
    localStorage.setItem(lsKey, "1"); // optimistic lock — avoid concurrent calls
    fetch("/api/generate-weekly-report", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        uid:   user.uid,
        week,
        name:  user.name,
        email: user.email,
        stats: {
          confidenceScore:  user.confidenceScore ?? 50,
          streak:           user.streak          ?? 0,
          xpEarned:         user.xpEarned        ?? 0,
          lessonsCompleted: user.lessonsCompleted ?? 0,
          goal:             user.goal             ?? "speak",
          role:             user.role             ?? "professional",
          plan:             user.plan             ?? "free",
        },
      }),
    }).catch(() => {});
  }, [user?.uid, profileReady, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Celebration triggers ────────────────────────────────────────────────

  function fireCelebration(key, cel) {
    const lsKey = `hsd_cel_${key}`;
    if (localStorage.getItem(lsKey)) return;
    localStorage.setItem(lsKey, "1");
    setCelebration(typeof cel === "function" ? cel() : cel);
  }

  function cefrFromScore(s) {
    if (s < 30) return "A1"; if (s < 50) return "A2"; if (s < 70) return "B1"; return "B2+";
  }

  // Streak milestones
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    const streak = user?.streak ?? 0;
    if (streak === 7)  fireCelebration(`streak_${user.uid}_7`,  CEL.streak_7);
    if (streak === 30) fireCelebration(`streak_${user.uid}_30`, CEL.streak_30);
  }, [user?.streak, profileReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // First lesson
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    if ((user?.lessonsCompleted ?? 0) >= 1) fireCelebration(`first_lesson_${user.uid}`, CEL.first_lesson);
  }, [user?.lessonsCompleted, profileReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // CEFR level-up
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    const cefr    = cefrFromScore(user?.confidenceScore ?? 0);
    const prevKey = `hsd_prev_cefr_${user.uid}`;
    const prev    = localStorage.getItem(prevKey);
    if (prev && prev !== cefr) fireCelebration(`cefr_${user.uid}_${cefr}`, CEL.new_cefr(cefr));
    localStorage.setItem(prevKey, cefr);
  }, [user?.confidenceScore, profileReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "users", user.uid, "familyMembers"), orderBy("createdAt", "asc"));
    return onSnapshot(q, snap => {
      const updated = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFamilyMembers(updated);
      setActiveMember(prev => prev ? (updated.find(m => m.id === prev.id) ?? prev) : null);
    });
  }, [user?.uid]);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? t("good_morning") : hour < 17 ? t("good_afternoon") : t("good_evening");

  // Assessment is no longer forced at login — shown as an optional card on the home tab

  // Pulse feedback trigger — show after assessment, or every 30 days for returning users
  useEffect(() => {
    if (!profileReady || !user?.uid || isAdmin) return;
    const assessmentJustDone = location.state?.assessmentJustDone;
    if (assessmentJustDone) {
      const timer = setTimeout(() => { setPulseTrigger("post_assessment"); setShowPulse(true); }, 4000);
      return () => clearTimeout(timer);
    }
    const last = parseInt(localStorage.getItem("hsd_pulse_last") ?? "0", 10);
    const daysSinceLast = (Date.now() - last) / 86400000;
    if (daysSinceLast >= 30) {
      const timer = setTimeout(() => { setPulseTrigger("general"); setShowPulse(true); }, 8000);
      return () => clearTimeout(timer);
    }
  }, [profileReady, user?.uid, isAdmin, location.state]);

  // Seed learningPath/current for users who don't have one yet
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    const ref = doc(db, "users", user.uid, "learningPath", "current");
    getDoc(ref).then(snap => {
      if (snap.exists()) return;
      // Pick best primary app: first subscribed non-family app, then "speak" as default
      const PRIORITY = ["speak", "eiken", "phonics", "wondercamp", "sipswitch", "innerkey", "career-ready", "global-ready", "speak-ready"];
      const subs = user?.subscriptions ?? [];
      const primaryApp = PRIORITY.find(id => subs.includes(id)) ?? "speak";
      setDoc(ref, { primaryApp, seededAt: new Date().toISOString() }).catch(() => {});
    }).catch(() => {});
  }, [user?.uid, profileReady, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-engagement: email + modal if away 3+ days (max once per 7 days, never for admin)
  useEffect(() => {
    if (!user?.uid || !profileReady || isAdmin) return;
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const now        = Date.now();
    const toMs       = (v) => { if (!v) return null; return (v?.toDate ? v.toDate() : new Date(v)).getTime(); };
    const lastVisit  = toMs(user.lastVisitAt);
    const lastEmail  = toMs(user.lastReengagementSentAt);
    const awayMs     = lastVisit ? now - lastVisit : Infinity;
    const cooldownMs = lastEmail  ? now - lastEmail  : Infinity;
    if (awayMs >= THREE_DAYS && cooldownMs >= SEVEN_DAYS) {
      fetch("/api/send-reengagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email:    user.email,
          name:     user.name,
          streak:   user.streak ?? 0,
          daysAway: Math.min(Math.floor(awayMs / 86400000), 30),
        }),
      }).catch(() => {});
      updateDoc(doc(db, "users", user.uid), { lastReengagementSentAt: serverTimestamp() }).catch(() => {});
      setDaysAway(Math.floor(awayMs / 86400000));
      setTimeout(() => setShowWelcomeBack(true), 1500);
    }
    const jstHour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }), 10);
    updateDoc(doc(db, "users", user.uid), { lastVisitAt: serverTimestamp(), lastActiveHour: jstHour }).catch(() => {});
  }, [user?.uid, profileReady, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isMobile) {
    return (
      <JonaProvider>
      <>
        <WarmUp />
        {showWelcome && profileReady && (
          <WelcomeSequence user={user} onComplete={() => { sessionStorage.setItem("hsd_welcome_shown", "1"); setShowWelcome(false); }} />
        )}
        <MobileDashboard
          user={user} firstName={firstName} greeting={greeting}
          activeNav={activeNav} setActiveNav={setActiveNav}
          setSelectedApp={setSelectedApp} navigate={navigate} isUnlocked={isUnlocked}
          unreadCount={unreadCount} onOpenInbox={() => setShowInbox(true)}
          onAllMissionsDone={() => setCelebration(CEL.all_missions)}
          familyMembers={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember}
        />
        <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} activeMember={activeMember} />
        {showPulse && <PulseFeedback trigger={pulseTrigger} onDismiss={() => setShowPulse(false)} />}
        {showWelcomeBack && <WelcomeBackModal user={user} daysAway={daysAway} onDismiss={() => setShowWelcomeBack(false)} />}
        {showInbox && (
          <JonaInbox
            notifications={notifications}
            onDismiss={dismissNotification}
            onDismissAll={markAllRead}
            onClose={() => setShowInbox(false)}
            onAction={handleInboxAction}
          />
        )}
        {showReport && reportWeek && (
          <WeeklyReport week={reportWeek} onClose={() => setShowReport(false)} />
        )}
        {celebration && (
          <CelebrationOverlay celebration={celebration} onDismiss={() => setCelebration(null)} />
        )}
        {showPaymentSuccess && (
          <PaymentSuccessModal
            planName={paymentPlan}
            user={user}
            onDismiss={() => setShowPaymentSuccess(false)}
            onManage={() => { setShowPaymentSuccess(false); setActiveNav("subscriptions"); }}
          />
        )}
      </>
      </JonaProvider>
    );
  }

  return (
    <JonaProvider>
    <>
      <WarmUp />
      {showWelcome && profileReady && (
        <WelcomeSequence user={user} onComplete={() => { sessionStorage.setItem("hsd_welcome_shown", "1"); setShowWelcome(false); }} />
      )}
      {showPulse && <PulseFeedback trigger={pulseTrigger} onDismiss={() => setShowPulse(false)} />}
      {showWelcomeBack && <WelcomeBackModal user={user} daysAway={daysAway} onDismiss={() => setShowWelcomeBack(false)} />}
      {showInbox && (
        <JonaInbox
          notifications={notifications}
          onDismiss={dismissNotification}
          onDismissAll={markAllRead}
          onClose={() => setShowInbox(false)}
          onAction={handleInboxAction}
        />
      )}
      {showPaymentSuccess && (
        <PaymentSuccessModal
          planName={paymentPlan}
          user={user}
          onDismiss={() => setShowPaymentSuccess(false)}
          onManage={() => { setShowPaymentSuccess(false); navigate("/dashboard#subscriptions"); }}
        />
      )}

      <div style={{
        minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", color: COLORS.text,
        animation: showWelcome ? "none" : "dashZoomIn 0.7s cubic-bezier(0.16,1,0.3,1) forwards",
      }}>
        <style>{`@keyframes dashZoomIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}`}</style>

        {/* TOP NAV */}
        <header style={{
          height: 60, background: COLORS.surface,
          borderBottom: "1px solid #1e1e1e",
          display: "flex", alignItems: "center",
          padding: "0 20px", gap: 16,
          position: "sticky", top: 0, zIndex: 50, flexShrink: 0,
        }}>
          <BrandMark />
          {activeMember ? (
            <div style={{ flex: 1, paddingLeft: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#4a0000,#e01010)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {activeMember.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>{t("viewing_member")}</div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{activeMember.name}</div>
              </div>
              <button
                onClick={() => setActiveMember(null)}
                style={{ marginLeft: 8, padding: "4px 10px", background: "transparent", border: "1px solid #333", borderRadius: 6, color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}
              >{t("back_to_my_profile")}</button>
            </div>
          ) : (
            <div style={{ flex: 1, paddingLeft: 8 }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{greeting},</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{firstName}</div>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Stat emoji="⚡" value={`${user?.confidenceScore ?? 0}%`} label={t("confidence_score")} />
            <Divider />
            <Stat emoji="🔥" value={user?.streak ?? 0} label={t("day_streak")} />
            <Divider />
            <Stat emoji="💎" value={(user?.xpEarned ?? 0).toLocaleString()} label={t("hsd_points")} />
            <Divider />
            {/* Language toggle */}
            <div style={{ display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, overflow: "hidden" }}>
              {["en", "jp"].map(l => (
                <button key={l} onClick={() => setLang(l)} style={{
                  padding: "4px 10px", fontSize: 11, fontWeight: 700, letterSpacing: 1,
                  background: lang === l ? COLORS.red : "transparent",
                  border: "none", color: lang === l ? "#fff" : COLORS.textMuted,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {l === "en" ? "EN" : "日本語"}
                </button>
              ))}
            </div>
            <div onClick={() => setShowInbox(true)} style={{ cursor: "pointer" }}>
              <NotificationBell count={unreadCount} />
            </div>
            <UserAvatar name={firstName} />
            <button
              onClick={logout}
              style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#e01010"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#2a2a2a"}
            >
              {t("sign_out")}
            </button>
          </div>
        </header>

        {/* BODY */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* SIDEBAR */}
          <aside style={{ width: 220, background: COLORS.surface, borderRight: "1px solid #1e1e1e", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
            <div style={{ padding: "14px 16px 8px", fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>
              {t("quick_launch")}
            </div>
            <nav style={{ flex: 1, padding: "4px 8px" }}>
              {NAV_ITEMS.map((item) => {
                const navLabel = t(`nav_${item.id}`) !== `nav_${item.id}` ? t(`nav_${item.id}`) : item.label;
                return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === "plans") {
                      navigate("/plans");
                      return;
                    }
                    setActiveNav(item.id);
                  }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 8px",
                    background: item.highlight ? "rgba(224,16,16,0.12)" : activeNav === item.id ? "rgba(224,16,16,0.15)" : "none",
                    border: item.highlight ? "1px solid rgba(224,16,16,0.3)" : "none",
                    borderRadius: 8,
                    color: item.highlight ? COLORS.red : activeNav === item.id ? COLORS.red : COLORS.textMuted,
                    fontSize: 13, cursor: "pointer", transition: "all 0.15s",
                    textAlign: "left", marginBottom: 2,
                    fontWeight: item.highlight ? 600 : 400,
                  }}
                  onMouseEnter={(e) => { if (activeNav !== item.id) e.currentTarget.style.background = "#1a1a1a"; }}
                  onMouseLeave={(e) => { if (activeNav !== item.id) e.currentTarget.style.background = "none"; }}
                >
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontWeight: activeNav === item.id ? 600 : 400 }}>{navLabel}</span>
                  {item.badge && (
                    <span style={{ marginLeft: "auto", background: COLORS.red, color: "#fff", fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );})}

              {/* WonderCamp teacher link */}
              <button
                onClick={() => navigate("/wondercamp")}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 8px",
                  background: "rgba(46,196,182,0.10)",
                  border: "1px solid rgba(46,196,182,0.25)",
                  borderRadius: 8,
                  color: "#2ec4b6",
                  fontSize: 13, cursor: "pointer",
                  textAlign: "left", marginBottom: 2, marginTop: 4, fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 16 }}>🌈</span>
                <span>WonderCamp</span>
              </button>
            </nav>

            {/* Badges + referral block */}
            <div style={{ margin: 8, marginBottom: 12, padding: 14, background: "#0d0d0d", border: "1px solid #222", borderRadius: 10 }}>

              {/* Founding Member badge — awarded on first payment if #1-200 */}
              {user?.isFoundingMember && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1e1e1e" }}>
                  <FoundingBadge badgeId="founding_member" size="sm" />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red }}>Founding Member</div>
                    <div style={{ fontSize: 10, color: "#555" }}>
                      #{String(user.foundingMemberNumber).padStart(3, "0")} / 200
                    </div>
                  </div>
                </div>
              )}

              {/* Contributor badge — awarded when a user's idea ships */}
              {user?.hasContributorBadge && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1e1e1e" }}>
                  <FoundingBadge badgeId="contributor" size="sm" />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4" }}>Contributor</div>
                    <div style={{ fontSize: 10, color: "#555" }}>Idea shaped the platform</div>
                  </div>
                </div>
              )}

              {/* Referral badge — earned through referrals */}
              {user?.referralBadge && user.referralBadge !== "none" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #1e1e1e" }}>
                  <FoundingBadge badgeId={user.isLegacyFounder ? "legacy_founder" : user.referralBadge} size="sm" />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C" }}>
                      {user.isLegacyFounder
                        ? (lang === "jp" ? "レガシーファウンダー" : "Legacy Founder")
                        : (lang === "jp"
                            ? { member: "メンバー", founder: "ファウンダー", ambassador: "アンバサダー", pioneer: "パイオニア", visionary: "ビジョナリー" }[user.referralBadge] ?? user.referralBadge
                            : user.referralBadge.charAt(0).toUpperCase() + user.referralBadge.slice(1))}
                    </div>
                    <div style={{ fontSize: 10, color: "#666" }}>
                      {lang === "jp" ? `有効紹介者 ${user.referralCount}人` : `${user.referralCount} active referral${user.referralCount !== 1 ? "s" : ""}`}
                    </div>
                  </div>
                </div>
              )}

              {/* Referral tiers */}
              <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>{t("referral_badges")}</div>
              {[
                { n: "50+",     label: "Ambassador",    labelJp: "アンバサダー",       color: "#aaa"    },
                { n: "100+",    label: "Pioneer",       labelJp: "パイオニア",         color: "#e01010" },
                { n: "250+",    label: "Visionary",     labelJp: "ビジョナリー",       color: "#C9A84C" },
                { n: "Top 100", label: "Legacy Founder",labelJp: "レガシーファウンダー", color: "#C9A84C" },
              ].map((badge) => {
                const active = (badge.label === "Ambassador" && user?.referralCount >= 50)
                  || (badge.label === "Pioneer" && user?.referralCount >= 100)
                  || (badge.label === "Visionary" && user?.referralCount >= 250)
                  || (badge.label === "Legacy Founder" && user?.isLegacyFounder);
                return (
                  <div key={badge.label} style={{ fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 6, opacity: active ? 1 : 0.45 }}>
                    <span style={{ fontSize: 8, color: active ? badge.color : "#333" }}>●</span>
                    <span style={{ flex: 1, color: active ? COLORS.text : COLORS.textDim }}>{badge.n} → <span style={{ color: active ? badge.color : COLORS.textDim, fontWeight: active ? 700 : 400 }}>{lang === "jp" ? badge.labelJp : badge.label}</span></span>
                  </div>
                );
              })}

              <ReferralButton user={user} />
            </div>
          </aside>

          {/* MAIN */}
          <main style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
            {activeNav === "my_family" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                  <BackBar title="My Family" onBack={() => setActiveNav("home")} />
                  <FamilyCard user={user} members={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember} />
                </div>
                <FamilyMissionCard user={user} />
                <ConfidenceCard user={user} activeMember={activeMember} />
                <Leaderboard currentUid={user?.uid} />
              </div>
            ) : activeNav === "progress" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                  <BackBar title="Progress" onBack={() => setActiveNav("home")} />
                  <LearningPath user={user} pathPrefix={activeMember ? `users/${user.uid}/familyMembers/${activeMember.id}` : null} member={activeMember ?? null} />
                </div>
                <ConfidenceCard user={user} activeMember={activeMember} />
                <MissionsCard user={user} />
                <ProgressJourney user={user} />
                <RecommendationsCard user={user} />
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                  <Achievements user={user} />
                </div>
              </div>
            ) : activeNav === "university" ? (
              <UniversitySection user={user} onBack={() => setActiveNav("home")} />
            ) : activeNav === "settings" ? (
              <SettingsView user={user} onBack={() => setActiveNav("home")} />
            ) : activeNav === "subscriptions" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title={t("my_subscriptions")} onBack={() => setActiveNav("home")} />
                <Subscriptions user={user} />
              </div>
            ) : activeNav === "learning" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title={t("nav_learning")} onBack={() => setActiveNav("home")} />
                <LearningPath user={user} pathPrefix={activeMember ? `users/${user.uid}/familyMembers/${activeMember.id}` : null} member={activeMember ?? null} />
              </div>
            ) : activeNav === "coach" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title={t("nav_coach")} onBack={() => setActiveNav("home")} />
                <AICoach user={user} />
              </div>
            ) : activeNav === "achievements" ? (
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title={t("nav_achievements")} onBack={() => setActiveNav("home")} />
                <Achievements user={user} />
              </div>
            ) : (
              <>
                <TodaysMissionHero user={user} onAppClick={setSelectedApp} onAllMissionsDone={() => setCelebration(CEL.all_missions)} />
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>{t("your_apps")}</div>
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle at 50% 50%, rgba(224,16,16,0.04) 0%, transparent 70%)" }} />
                  <AppOrbit view={orbitView} onViewChange={setOrbitView} onAppClick={setSelectedApp} activeMember={activeMember} onJonaClick={onJonaClick} />
                </div>
                <HomeChildCard user={user} members={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember} onAppClick={setSelectedApp} isUnlocked={isUnlocked} />
                <ParentReportCard user={user} activeMember={activeMember} />
                <AccessCodeCard user={user} navigate={navigate} />
                <FoundingBanner user={user} navigate={navigate} />
              </>
            )}
          </main>

          {/* RIGHT PANEL — Jona Daily Coach */}
          <aside style={{ width: 300, background: COLORS.surface, borderLeft: "1px solid #1e1e1e", padding: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flexShrink: 0 }}>
            <CoachingCard user={user} member={activeMember ?? undefined} autoPlay={!activeMember} onSpeakReady={(fn) => { jonaSpeak.current = fn; }} />
            <div ref={chatContainerRef}>
              <AIChat inputRef={chatInputRef} />
            </div>
          </aside>
        </div>
      </div>

      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} activeMember={activeMember} />
    </>
    </JonaProvider>
  );
}

// ── MOBILE DASHBOARD ──────────────────────────────────────────────────────────

function MobileDashboard({ user, firstName, greeting, activeNav, setActiveNav, setSelectedApp, navigate, isUnlocked, unreadCount, onOpenInbox, onAllMissionsDone, familyMembers, activeMember, setActiveMember }) {
  const { lang, setLang, t } = useLang();
  const BOTTOM_NAV = [
    { id: "home",      icon: "🏠",       label: "Home"     },
    { id: "apps",      icon: "🌍",       label: "Worlds"   },
    { id: "coach",     icon: "🤖",       label: "Jona"     },
    { id: "learning",  icon: "⭐",       label: "Progress" },
    { id: "my_family", icon: "👨‍👩‍👧‍👦", label: "Family"   },
  ];
  const SETTINGS_SUB_NAVS = ["settings","subscriptions","achievements","events","my_family"];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>

      {/* Mobile Header */}
      <header style={{
        height: 56, background: "#07091a",
        borderBottom: "1px solid rgba(201,168,76,0.12)",
        display: "flex", alignItems: "center",
        padding: "0 16px", gap: 12,
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <img src="/assets/logo.png" alt="HSD OS" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: COLORS.textMuted }}>{greeting},</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{firstName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* EN / JP quick toggle */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, overflow: "hidden" }}>
            {["en","jp"].map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "4px 9px", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
                background: lang === l ? "#C9A84C" : "transparent",
                color: lang === l ? "#0a0700" : "rgba(255,255,255,0.4)",
                border: "none", cursor: "pointer", transition: "all 0.15s",
              }}>{l === "en" ? "EN" : "JP"}</button>
            ))}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.red }}>🔥 {user?.streak ?? 0}</div>
            <div style={{ fontSize: 9, color: COLORS.textMuted }}>Streak</div>
          </div>
          {/* Inbox bell */}
          <button
            onClick={onOpenInbox}
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <span style={{ fontSize: 20 }}>🔔</span>
            {unreadCount > 0 && (
              <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, borderRadius: "50%", background: COLORS.red, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 0 8px rgba(224,16,16,0.5)" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </button>
          {/* Settings gear */}
          <button
            onClick={() => setActiveNav("settings")}
            style={{
              background: SETTINGS_SUB_NAVS.includes(activeNav) ? "rgba(224,16,16,0.12)" : "none",
              border: SETTINGS_SUB_NAVS.includes(activeNav) ? "1px solid rgba(224,16,16,0.3)" : "none",
              borderRadius: 8, cursor: "pointer", padding: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: SETTINGS_SUB_NAVS.includes(activeNav) ? COLORS.red : COLORS.textMuted,
              fontSize: 18, lineHeight: 1,
            }}
            aria-label="Settings"
          >⚙️</button>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #8b0000, #e01010)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, border: "2px solid #e01010" }}>
            {firstName?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Mobile Content */}
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>

        {activeNav === "home" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Blueprint prompt — shown until assessment is complete */}
            {profileReady && !user?.assessmentDone && !isAdmin && (
              <button
                onClick={() => navigate("/onboard")}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, rgba(201,168,76,0.10), rgba(201,168,76,0.04))",
                  border: "1px solid rgba(201,168,76,0.3)", borderRadius: 14,
                  padding: "16px 18px", textAlign: "left", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14,
                }}
              >
                <div style={{ fontSize: 28, flexShrink: 0 }}>🗺️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 3 }}>
                    {t("personalise_title") ?? "Build your Blueprint"}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
                    {t("personalise_desc") ?? "Tell Jona your goals — takes 2 minutes and unlocks tailored recommendations."}
                  </div>
                </div>
                <div style={{ fontSize: 18, color: "#C9A84C", flexShrink: 0 }}>→</div>
              </button>
            )}

            {/* Today's Mission hero */}
            <TodaysMissionHero user={user} onAppClick={setSelectedApp} onAllMissionsDone={onAllMissionsDone} />

            {/* Stats row */}
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { icon: "🔥", value: user?.streak ?? 0,                       label: t("day_streak")  },
                { icon: "⭐", value: (user?.xpEarned ?? 0).toLocaleString(),  label: t("hsd_points")  },
                { icon: "✅", value: user?.lessonsCompleted ?? 0,              label: t("lessons_done")},
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#C9A84C" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Daily coach */}
            <CoachingCard user={user} autoPlay />

            {/* Quick Worlds grid */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.15em", textTransform: "uppercase" }}>{t("worlds_title")}</div>
                <button onClick={() => setActiveNav("apps")} style={{ background: "none", border: "none", fontSize: 11, color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 0 }}>{t("see_all")}</button>
              </div>
              <MobileAppGrid onAppClick={setSelectedApp} isUnlocked={isUnlocked} compact />
            </div>

            {/* Parent progress report — only shown when viewing a family member */}
            {activeMember && <ParentReportCard user={user} activeMember={activeMember} />}

            {/* Access code card */}
            <AccessCodeCard user={user} navigate={navigate} />

            {/* Founding member banner */}
            <FoundingBanner user={user} navigate={navigate} />

            {/* AI Chat */}
            <AIChat />
          </div>
        )}

        {activeNav === "apps" && (
          <div style={{ position: "relative", minHeight: "100%" }}>
            {/* Constellation background */}
            <div style={{ position: "fixed", inset: 0, backgroundImage: "url('/assets/bg/constellation.png')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18, pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, padding: 16 }}>
              {/* Worlds header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: "#C9A84C", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>HSDOS</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{t("worlds_title")}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{t("worlds_sub")}</div>
              </div>
              <MobileAppGrid onAppClick={setSelectedApp} isUnlocked={isUnlocked} />
            </div>
          </div>
        )}

        {activeNav === "learning" && (
          <div style={{ position: "relative", minHeight: "100%" }}>
            {/* Constellation background */}
            <div style={{ position: "fixed", inset: 0, backgroundImage: "url('/assets/bg/constellation.png')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.12, pointerEvents: "none", zIndex: 0 }} />

            <div style={{ position: "relative", zIndex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Header */}
              <div>
                <div style={{ fontSize: 10, color: "#C9A84C", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 4 }}>HSDOS</div>
                <div style={{ fontSize: 22, fontWeight: 800 }}>{t("your_journey")}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                  {lang === "jp" ? "すべての世界での学習記録" : "Your learning record across every world."}
                </div>
              </div>

              {/* Stats strip */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { icon: "🔥", value: user?.streak ?? 0,                      label: t("day_streak")   },
                  { icon: "⭐", value: (user?.xpEarned ?? 0).toLocaleString(), label: t("hsd_points")   },
                  { icon: "✅", value: user?.lessonsCompleted ?? 0,             label: t("lessons_done") },
                ].map((s) => (
                  <div key={s.label} style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.15)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#C9A84C" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Achievement artifacts showcase */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>{t("nav_achievements")}</div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
                  {[
                    { src: "/assets/achievements/golden-key.jpg",  name: lang === "jp" ? "黄金の鍵"  : "Golden Key" },
                    { src: "/assets/achievements/crystal.jpg",      name: lang === "jp" ? "クリスタル" : "Crystal"    },
                    { src: "/assets/achievements/compass.jpg",      name: lang === "jp" ? "コンパス"  : "Compass"    },
                    { src: "/assets/achievements/lantern.jpg",      name: lang === "jp" ? "ランタン"  : "Lantern"    },
                    { src: "/assets/achievements/star.jpg",         name: lang === "jp" ? "スター"    : "Star"       },
                  ].map((a) => (
                    <div key={a.name} style={{ flexShrink: 0, width: 76, textAlign: "center" }}>
                      <div style={{ width: 76, height: 76, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(201,168,76,0.25)", background: "rgba(201,168,76,0.04)", boxShadow: "0 0 12px rgba(201,168,76,0.08)" }}>
                        <img src={a.src} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 5, lineHeight: 1.3 }}>{a.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: "rgba(201,168,76,0.1)" }} />

              {/* Progress components — each in a gold-glass card */}
              {[
                { label: lang === "jp" ? "学習パス" : "Learning Path",       node: <LearningPath user={user} />                         },
                { label: lang === "jp" ? "自信度"   : "Confidence",          node: <ConfidenceCard user={user} activeMember={activeMember} /> },
                { label: lang === "jp" ? "ミッション" : "Missions",           node: <MissionsCard user={user} />                         },
                { label: lang === "jp" ? "CEFRの旅"  : "Journey",            node: <ProgressJourney user={user} />                      },
                { label: lang === "jp" ? "おすすめ"  : "Recommendations",    node: <RecommendationsCard user={user} />                  },
              ].map((section) => (
                <div key={section.label} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px 0", fontSize: 9, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.15em", textTransform: "uppercase" }}>{section.label}</div>
                  <div style={{ padding: "8px 0 0" }}>{section.node}</div>
                </div>
              ))}

              {/* Achievements */}
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(201,168,76,0.12)", borderRadius: 14, padding: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>{t("nav_achievements")}</div>
                <Achievements user={user} />
              </div>

            </div>
          </div>
        )}

        {activeNav === "coach" && (
          <div style={{ padding: 0 }}>
            {/* Jona hero header */}
            <div style={{ position: "relative", background: "linear-gradient(180deg, rgba(201,168,76,0.06) 0%, transparent 100%)", borderBottom: "1px solid rgba(201,168,76,0.1)", marginBottom: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 0, padding: "0 16px 0 0" }}>
                {/* Full-body Jona — waving pose */}
                <img
                  src="/assets/jona/pose-waving.png"
                  alt="Jona"
                  style={{ width: 110, height: 150, objectFit: "contain", objectPosition: "bottom", flexShrink: 0, filter: "drop-shadow(0 0 20px rgba(201,168,76,0.25))" }}
                />
                <div style={{ paddingBottom: 20, flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.3 }}>Jona</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{t("jona_companion_sub")}</div>
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                    <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>Online</span>
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: 16 }}>
              <AICoach user={user} />
            </div>
          </div>
        )}

        {activeNav === "university" && (
          <div style={{ padding: 16 }}>
            <UniversitySection user={user} onBack={() => setActiveNav("home")} />
          </div>
        )}

        {activeNav === "settings" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t("more")}</div>

            {/* Nav links */}
            {[
              { id: "subscriptions", icon: "📱", label: t("my_subscriptions") },
              { id: "achievements",  icon: "🏆", label: t("nav_achievements")  },
              { id: "my_family",     icon: "👨‍👩‍👧", label: t("my_family")         },
              { id: "events",        icon: "📅", label: t("nav_events")          },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 16, background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, color: COLORS.text, fontSize: 14, cursor: "pointer", textAlign: "left" }}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
                <span style={{ marginLeft: "auto", color: COLORS.textMuted }}>›</span>
              </button>
            ))}

            <button
              onClick={() => navigate("/plans")}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: 16, background: "rgba(224,16,16,0.1)", border: "1px solid rgba(224,16,16,0.3)", borderRadius: 12, color: COLORS.red, fontSize: 14, fontWeight: 600, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ fontSize: 20 }}>⚡</span>
              <span>{t("nav_upgrade")}</span>
              <span style={{ marginLeft: "auto" }}>›</span>
            </button>

            {/* Account info */}
            <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{t("account")}</div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.9 }}>
                <div>{t("plan_label")}: <strong style={{ color: COLORS.text }}>{user?.plan ?? "Free"}</strong></div>
                <div>{t("day_streak")}: <strong style={{ color: COLORS.text }}>🔥 {user?.streak ?? 0} days</strong></div>
                <div>{t("xp_earned")}: <strong style={{ color: COLORS.gold }}>⭐ {(user?.xpEarned ?? 0).toLocaleString()}</strong></div>
                {user?.createdAt && (
                  <div>{t("member_since")}: <strong style={{ color: COLORS.text }}>{new Date(user.createdAt.seconds * 1000).toLocaleDateString("en-GB")}</strong></div>
                )}
              </div>
            </div>

            {/* Profile edit */}
            <MobileSettingsProfile user={user} />

            {/* Referral */}
            <MobileSettingsReferral user={user} navigate={navigate} />

            {/* Workbook bonus */}
            <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
                {lang === "jp" ? "ワークブックボーナスコード" : "Workbook Bonus Code"}
              </div>
              <WorkbookCodeCard user={user} />
            </div>

            {/* Language toggle */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Language / 言語</div>
              <div style={{ display: "flex", background: COLORS.card, border: "1px solid #2a2a2a", borderRadius: 12, overflow: "hidden" }}>
                {["en", "jp"].map(l => (
                  <button key={l} onClick={() => setLang(l)} style={{
                    flex: 1, padding: 14, fontSize: 13, fontWeight: 700,
                    background: lang === l ? COLORS.red : "transparent",
                    border: "none", color: lang === l ? "#fff" : COLORS.textMuted,
                    cursor: "pointer", transition: "all 0.15s",
                  }}>
                    {l === "en" ? "English" : "日本語"}
                  </button>
                ))}
              </div>
            </div>

            {/* Export data */}
            <MobileExportDelete user={user} navigate={navigate} />

            <button
              onClick={logout}
              style={{ width: "100%", padding: 14, background: "transparent", border: "1px solid #2a2a2a", borderRadius: 12, color: COLORS.textMuted, fontSize: 14, cursor: "pointer" }}
            >
              {t("sign_out")}
            </button>
          </div>
        )}

        {activeNav === "subscriptions" && (
          <div style={{ padding: 16 }}>
            <MobileBackBar title={t("my_subscriptions")} onBack={() => setActiveNav("settings")} />
            <Subscriptions user={user} />
          </div>
        )}

        {activeNav === "achievements" && (
          <div style={{ padding: 16 }}>
            <MobileBackBar title={t("nav_achievements")} onBack={() => setActiveNav("settings")} />
            <Achievements user={user} />
          </div>
        )}

        {activeNav === "events" && (
          <div style={{ padding: 16 }}>
            <MobileBackBar title={t("nav_events")} onBack={() => setActiveNav("settings")} />
            <Events user={user} />
          </div>
        )}

        {activeNav === "my_family" && (
          <div style={{ position: "relative", minHeight: "100%" }}>
            {/* Family galaxy background */}
            <div style={{ position: "fixed", inset: 0, backgroundImage: "url('/assets/bg/family-galaxy.png')", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.15, pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "relative", zIndex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <FamilyCard user={user} members={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember} />
              <FamilyMissionCard user={user} />
              <ConfidenceCard user={user} activeMember={activeMember} />
              <Leaderboard currentUid={user?.uid} />
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: 64, background: "#0c0f27",
        borderTop: "1px solid rgba(201,168,76,0.12)",
        display: "flex", alignItems: "center",
        zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {BOTTOM_NAV.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 3, background: "none", border: "none", cursor: "pointer",
                color: active ? "#C9A84C" : "rgba(255,255,255,0.38)",
                padding: "8px 0", transition: "color 0.2s",
              }}
            >
              <span style={{ fontSize: active ? 22 : 20, transition: "font-size 0.15s" }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: active ? "0.02em" : 0 }}>{item.label}</span>
              {active && <div style={{ position: "absolute", bottom: 0, width: 20, height: 2, background: "#C9A84C", borderRadius: "2px 2px 0 0" }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MobileAppGrid({ onAppClick, isUnlocked, compact }) {
  const { t } = useLang();
  const unlockedApps = APPS.filter(a => !a.comingSoon && isUnlocked(a.id));
  const lockedApps   = APPS.filter(a => !a.comingSoon && !isUnlocked(a.id));
  const soonApps     = APPS.filter(a => a.comingSoon);

  // In compact mode (home tab), show only unlocked worlds
  const displayUnlocked = compact ? unlockedApps.slice(0, 4) : unlockedApps;

  function WorldCard({ app }) {
    const unlocked = isUnlocked(app.id);
    const hasBanner = !!app.cardImage;
    return (
      <button
        onClick={() => !app.comingSoon && onAppClick(app)}
        style={{
          background: unlocked
            ? "linear-gradient(145deg, rgba(201,168,76,0.08) 0%, rgba(15,17,30,0.95) 100%)"
            : "rgba(255,255,255,0.025)",
          border: `1px solid ${unlocked ? "rgba(201,168,76,0.25)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: 16, padding: 0,
          cursor: app.comingSoon ? "default" : "pointer",
          display: "flex", flexDirection: "column", alignItems: "flex-start",
          textAlign: "left", position: "relative", overflow: "hidden",
          boxShadow: unlocked ? "0 0 20px rgba(201,168,76,0.08)" : "none",
          opacity: app.comingSoon ? 0.45 : 1,
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        {/* Cinematic banner image */}
        {hasBanner && (
          <div style={{ width: "100%", height: 90, position: "relative", overflow: "hidden", flexShrink: 0 }}>
            <img
              src={app.cardImage}
              alt=""
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                filter: unlocked ? "brightness(0.85)" : "grayscale(80%) brightness(0.35)",
                display: "block",
              }}
            />
            {/* Gradient fade into card body */}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(7,9,26,0.95) 100%)" }} />
            {/* Lock / badge overlays */}
            {app.free && (
              <span style={{ position: "absolute", top: 6, right: 6, fontSize: 8, fontWeight: 700, color: "#22c55e", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 4, padding: "2px 5px", letterSpacing: 1 }}>FREE</span>
            )}
            {app.badge && !app.free && (
              <span style={{ position: "absolute", top: 6, right: 6, fontSize: 8, fontWeight: 700, color: "#C9A84C", background: "rgba(0,0,0,0.6)", border: "1px solid rgba(201,168,76,0.4)", borderRadius: 4, padding: "2px 5px", letterSpacing: 1 }}>{app.badge}</span>
            )}
            {!unlocked && !app.free && !app.comingSoon && (
              <span style={{ position: "absolute", top: 6, right: 6, fontSize: 12, opacity: 0.7 }}>🔒</span>
            )}
          </div>
        )}

        {/* Card body */}
        <div style={{ padding: "12px 14px", width: "100%", boxSizing: "border-box", position: "relative" }}>
          {/* Gold left accent bar for unlocked — only when no banner */}
          {unlocked && !hasBanner && (
            <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 2, borderRadius: "0 2px 2px 0", background: "linear-gradient(180deg, #C9A84C, rgba(201,168,76,0.3))" }} />
          )}

          {/* Badges for no-banner cards */}
          {!hasBanner && app.free && (
            <span style={{ position: "absolute", top: 8, right: 8, fontSize: 8, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 4, padding: "2px 5px", letterSpacing: 1 }}>FREE</span>
          )}
          {!hasBanner && app.badge && !app.free && (
            <span style={{ position: "absolute", top: 8, right: 8, fontSize: 8, fontWeight: 700, color: "#C9A84C", background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 4, padding: "2px 5px", letterSpacing: 1 }}>{app.badge}</span>
          )}
          {!hasBanner && !unlocked && !app.free && !app.comingSoon && (
            <span style={{ position: "absolute", top: 8, right: 8, fontSize: 12, opacity: 0.5 }}>🔒</span>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            {/* Icon — smaller when banner is present */}
            <div style={{
              width: hasBanner ? 36 : 52, height: hasBanner ? 36 : 52,
              borderRadius: hasBanner ? 8 : 12, overflow: "hidden", flexShrink: 0,
              background: unlocked ? "rgba(201,168,76,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${unlocked ? "rgba(201,168,76,0.3)" : "rgba(255,255,255,0.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {app.image
                ? <img src={app.image} alt={app.name} style={{ width: "100%", height: "100%", objectFit: "cover", filter: unlocked ? "none" : "grayscale(90%) brightness(0.4)" }} />
                : <span style={{ fontSize: hasBanner ? 18 : 24 }}>{app.icon}</span>
              }
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: unlocked ? "#fff" : "rgba(255,255,255,0.35)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.name}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{app.desc}</div>
            </div>
          </div>

          {app.comingSoon ? (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>{t("coming_soon")}</div>
          ) : unlocked ? (
            <div style={{ fontSize: 11, color: "#C9A84C", fontWeight: 700 }}>{t("enter_world")} →</div>
          ) : (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>{t("locked")}</div>
          )}
        </div>
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Unlocked / active worlds */}
      {displayUnlocked.length > 0 && (
        <>
          {!compact && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 10 }}>{t("active_worlds")}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: compact ? 0 : 20 }}>
            {displayUnlocked.map(app => <WorldCard key={app.id} app={app} />)}
          </div>
        </>
      )}

      {/* Locked worlds — only in full view */}
      {!compact && lockedApps.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 4 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("locked_worlds")}</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {lockedApps.map(app => <WorldCard key={app.id} app={app} />)}
          </div>
        </>
      )}

      {/* Coming soon — only in full view */}
      {!compact && soonApps.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" }}>{t("coming_soon")}</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {soonApps.map(app => <WorldCard key={app.id} app={app} />)}
          </div>
        </>
      )}
    </div>
  );
}

function MobileSettingsProfile({ user }) {
  const { lang } = useLang();
  const [name,     setName]     = useState(user?.name ?? "");
  const [nickname, setNickname] = useState(user?.nickname ?? "");
  const [saved,    setSaved]    = useState(false);
  const [saving,   setSaving]   = useState(false);

  async function save() {
    if (!user?.uid || !name.trim()) return;
    setSaving(true);
    try {
      const patch = { name: name.trim(), nickname: nickname.trim() || null };
      await updateDoc(doc(db, "users", user.uid), patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  const inp = { width: "100%", boxSizing: "border-box", padding: "11px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none" };

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{lang === "jp" ? "プロフィール" : "Profile"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{lang === "jp" ? "表示名" : "Display name"}</div>
          <input value={name} onChange={e => setName(e.target.value)} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{lang === "jp" ? "ランキング表示名" : "Leaderboard nickname"}</div>
          <input value={nickname} onChange={e => setNickname(e.target.value)} maxLength={20} placeholder={lang === "jp" ? "例：英語の達人" : "e.g. EnglishAce"} style={inp} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 4 }}>{lang === "jp" ? "メールアドレス" : "Email"}</div>
          <div style={{ padding: "11px 14px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, fontSize: 13, color: COLORS.textMuted }}>{user?.email}</div>
        </div>
        <button onClick={save} disabled={saving} style={{ padding: "11px 0", background: COLORS.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          {saved ? (lang === "jp" ? "保存しました ✓" : "Saved ✓") : saving ? "…" : (lang === "jp" ? "保存する" : "Save changes")}
        </button>
      </div>
    </div>
  );
}

function MobileSettingsReferral({ user }) {
  const { lang } = useLang();
  const refLink  = `${window.location.origin}/?ref=${user?.uid?.slice(0, 8) ?? "hsd"}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(refLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        {lang === "jp" ? "紹介リンク" : "Referral Link"}
      </div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, fontFamily: "monospace", wordBreak: "break-all", padding: "10px 12px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, marginBottom: 10 }}>
        {refLink}
      </div>
      <button onClick={copy} style={{ width: "100%", padding: "10px 0", background: copied ? "#22c55e22" : "#1a1a1a", border: `1px solid ${copied ? "#22c55e44" : "#2a2a2a"}`, borderRadius: 8, color: copied ? "#22c55e" : COLORS.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        {copied ? (lang === "jp" ? "コピーしました ✓" : "Copied ✓") : (lang === "jp" ? "リンクをコピー" : "Copy link")}
      </button>
      <div style={{ marginTop: 12, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6 }}>
        {lang === "jp"
          ? "友達があなたのリンクから登録すると初年度2%オフ。有効な有料紹介で報酬が発生します。"
          : "Friends who sign up via your link get 2% off their first year. Commission kicks in at 25 active paying referrals."}
      </div>
    </div>
  );
}

function MobileExportDelete({ user, navigate }) {
  const { lang } = useLang();
  const [phase, setPhase]   = useState("idle");
  const [error, setError]   = useState("");

  async function exportData() {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const blob = new Blob([JSON.stringify({ uid: user.uid, email: user.email, ...snap.data() }, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = "hsd-my-data.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error(e); }
  }

  async function deleteAccount() {
    setPhase("deleting"); setError("");
    try {
      const { getAuth, deleteUser } = await import("firebase/auth");
      const fbAuth  = getAuth();
      const idToken = await fbAuth.currentUser.getIdToken(true);
      const res     = await fetch("/api/delete-account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }) });
      if (!res.ok) throw new Error("Failed");
      await deleteUser(fbAuth.currentUser);
      setPhase("done");
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (e) { setError(lang === "jp" ? "エラーが発生しました。" : "Something went wrong."); setPhase("idle"); }
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
        {lang === "jp" ? "データ・アカウント" : "Data & Account"}
      </div>
      <button onClick={exportData} style={{ width: "100%", padding: "11px 0", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>
        {lang === "jp" ? "データをエクスポート" : "Export my data"}
      </button>
      {phase === "idle" && (
        <button onClick={() => setPhase("confirm")} style={{ width: "100%", padding: "11px 0", background: "rgba(224,16,16,0.08)", border: "1px solid rgba(224,16,16,0.2)", borderRadius: 8, color: COLORS.red, fontSize: 13, cursor: "pointer" }}>
          {lang === "jp" ? "アカウントを削除する" : "Delete my account"}
        </button>
      )}
      {phase === "confirm" && (
        <div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
            {lang === "jp" ? "すべての学習データと進捗が完全に削除されます。元に戻せません。" : "This permanently removes all your learning data and progress. This cannot be undone."}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setPhase("idle")} style={{ flex: 1, padding: "10px 0", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
              {lang === "jp" ? "キャンセル" : "Cancel"}
            </button>
            <button onClick={deleteAccount} style={{ flex: 1, padding: "10px 0", background: COLORS.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {lang === "jp" ? "削除する" : "Delete"}
            </button>
          </div>
        </div>
      )}
      {phase === "deleting" && <div style={{ fontSize: 13, color: COLORS.textMuted }}>{lang === "jp" ? "削除中…" : "Deleting…"}</div>}
      {phase === "done"     && <div style={{ fontSize: 13, color: "#22c55e" }}>{lang === "jp" ? "削除完了。" : "Account deleted. Goodbye."}</div>}
      {error && <div style={{ fontSize: 12, color: COLORS.red, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function MobileBackBar({ title, onBack }) {
  const { t } = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>{t("back")}</button>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function BrandMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 190 }}>
      <img
        src="/assets/logo.png"
        alt="HSD OS AI"
        style={{
          width: 36, height: 36, borderRadius: 8, objectFit: "cover",
          filter: "drop-shadow(0 0 6px rgba(224,16,16,0.5))",
        }}
      />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#e01010", letterSpacing: 2 }}>HEAR SEE DO™</div>
        <div style={{ fontSize: 9, color: "#888", letterSpacing: 2 }}>OS AI</div>
      </div>
    </div>
  );
}

function Stat({ emoji, value, label }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#e01010" }}>{emoji} {value}</div>
      <div style={{ fontSize: 10, color: "#888" }}>{label}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 30, background: "#2a2a2a" }} />;
}

function NotificationBell({ count }) {
  return (
    <div style={{ position: "relative", cursor: "pointer" }}>
      <span style={{ fontSize: 20 }}>🔔</span>
      {count > 0 && (
        <div style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#e01010", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
          {count}
        </div>
      )}
    </div>
  );
}

function UserAvatar({ name }) {
  return (
    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #8b0000, #e01010)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, cursor: "pointer", border: "2px solid #e01010" }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function SectionTitle({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>{children}</div>;
}

const DAILY_MISSIONS = [
  { id: "chat",    labelKey: "send_ai_messages",  icon: "🤖", total: 3,  xp: 30  },
  { id: "streak",  labelKey: "maintain_streak",   icon: "🔥", total: 1,  xp: 20  },
  { id: "lesson",  labelKey: "complete_lesson",   icon: "📖", total: 1,  xp: 50  },
];

// ── WELCOME BACK MODAL ────────────────────────────────────────────────────────

const WBM_CHANGELOG = [
  { emoji: "🎯", title: "Today's Mission",   desc: "A daily focus card showing exactly what to practice each day." },
  { emoji: "🤖", title: "AI Coaching Card",  desc: "Jona gives you a personalised daily challenge every morning." },
  { emoji: "📬", title: "Jona Inbox",        desc: "Messages from Jona about your milestones, streaks, and progress." },
  { emoji: "✨", title: "Guided Onboarding", desc: "A 7-step setup that personalises your entire learning path." },
];

function WelcomeBackModal({ user, daysAway = 0, onDismiss }) {
  const { lang } = useLang();
  const navigate  = useNavigate();
  const jp        = lang === "jp";
  const firstName = user?.name?.split(" ")[0] ?? "there";
  const streak    = user?.streak ?? 0;

  // Tier thresholds
  const tier = daysAway >= 30 ? "long" : daysAway >= 7 ? "week" : "short";

  const TIER_CONTENT = {
    short: {
      emoji:   "👋",
      heading: jp ? `おかえり、${firstName}！` : `Welcome back, ${firstName}!`,
      body:    jp
        ? "今日のミッションが待っています。少し練習するだけで、大きな進歩が続きます。"
        : "Your daily missions are ready. A few minutes keeps your momentum going.",
      cta:     jp ? "始める →" : "Let's go →",
      onCta:   onDismiss,
    },
    week: {
      emoji:   "🤝",
      heading: jp ? `また会えて嬉しい、${firstName}。` : `Good to see you again, ${firstName}.`,
      body:    jp
        ? "ゆっくり再スタートできるよう、短めのセッションを用意しました。"
        : "I've prepared a shorter session to help you restart. No pressure — just momentum.",
      cta:     jp ? "カムバックセッションを始める →" : "Start my comeback session →",
      onCta:   onDismiss,
    },
    long: {
      emoji:   "🌟",
      heading: jp ? `おかえりなさい、${firstName}。` : `Welcome back, ${firstName}.`,
      body:    jp
        ? "しばらく経ちましたね。あなたがいない間にたくさんの新機能が追加されました。"
        : `It's been a while. We've added new experiences since you were last here.`,
      cta:     jp ? "新機能を見る →" : "Explore what's new →",
      onCta:   onDismiss,
    },
  };

  const tc = TIER_CONTENT[tier];

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, overflowY: "auto",
      }}
      onClick={onDismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(135deg, #0d0d0d 0%, #130a0a 100%)",
          border: "1px solid rgba(224,16,16,0.25)",
          borderRadius: 20, padding: "36px 32px",
          maxWidth: 440, width: "100%",
          boxShadow: "0 0 60px rgba(224,16,16,0.08)",
          position: "relative",
          animation: "wbmIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        }}
      >
        <style>{`@keyframes wbmIn{from{opacity:0;transform:translateY(20px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
        <button
          onClick={onDismiss}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#555", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
        >✕</button>

        {/* Header */}
        <div style={{ fontSize: 36, marginBottom: 14 }}>{tc.emoji}</div>
        <div style={{ fontSize: 21, fontWeight: 800, color: "#fff", marginBottom: 10, lineHeight: 1.3 }}>
          {tc.heading}
        </div>
        <p style={{ fontSize: 14, color: "#a0a0a0", lineHeight: 1.7, margin: "0 0 22px" }}>
          {tc.body}
        </p>

        {/* Tier: short — streak badge */}
        {tier === "short" && streak > 0 && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 16px", marginBottom: 22,
            background: "rgba(224,16,16,0.1)", border: "1px solid rgba(224,16,16,0.25)", borderRadius: 10,
          }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#e01010" }}>
              {jp ? `${streak}日連続 — まだ継続中！` : `${streak}-day streak — still alive!`}
            </span>
          </div>
        )}

        {/* Tier: week — progress snapshot */}
        {tier === "week" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 22 }}>
            {[
              { icon: "🔥", value: streak,                              label: jp ? "連続日数" : "Day streak"   },
              { icon: "⭐", value: (user?.xpEarned ?? 0).toLocaleString(), label: jp ? "総XP"    : "Total XP"    },
              { icon: "✅", value: user?.lessonsCompleted ?? 0,          label: jp ? "完了レッスン" : "Lessons done" },
              { icon: "📈", value: `${user?.confidenceScore ?? 0}%`,    label: jp ? "自信スコア" : "Confidence"  },
            ].map(s => (
              <div key={s.label} style={{
                background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
                padding: "14px 12px", textAlign: "center",
              }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: COLORS.red, marginBottom: 2 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "#666" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tier: long — changelog */}
        {tier === "long" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            {WBM_CHANGELOG.map(item => (
              <div key={item.title} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                padding: "12px 14px",
                background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.4 }}>{item.emoji}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#666", lineHeight: 1.55 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Primary CTA */}
        <button
          onClick={tc.onCta}
          style={{
            width: "100%", padding: "14px", marginBottom: 10,
            background: "#e01010", border: "none", borderRadius: 10,
            color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 0 20px rgba(224,16,16,0.3)",
          }}
        >
          {tc.cta}
        </button>

        {/* Secondary — founding offer */}
        <button
          onClick={() => { onDismiss(); navigate("/plans"); }}
          style={{
            width: "100%", padding: "12px",
            background: "transparent", border: "1px solid rgba(201,168,76,0.4)",
            borderRadius: 10, color: "#C9A84C",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {jp ? "⭐ ファウンダー価格を見る" : "⭐ See Founding Member offer"}
        </button>
      </div>
    </div>
  );
}

// ── HABIT GREETING ────────────────────────────────────────────────────────────

function habitGreeting(preferredTime, jstHour, jp) {
  const windows = { morning: [6, 12], afternoon: [12, 18], evening: [18, 22] };
  const range   = windows[preferredTime];
  if (!range) return null; // "ai" or unset → no habit line

  const [start, end] = range;
  const inWindow  = jstHour >= start && jstHour < end;
  const soonStart = !inWindow && jstHour >= start - 2 && jstHour < start;

  if (inWindow) {
    const msgs = {
      morning:   jp ? "おはようございます — いつもの練習時間ですね。"   : "Good morning — you're right on schedule.",
      afternoon: jp ? "こんにちは — 午後の練習時間です。"               : "Good afternoon — right in your practice window.",
      evening:   jp ? "こんばんは — この時間によく練習していますね。"   : "Good evening — you're usually active around now.",
    };
    return msgs[preferredTime] ?? null;
  }
  if (soonStart) {
    return jp ? "もうすぐあなたの練習時間です。" : "Almost time for your usual practice.";
  }
  return null;
}

// ── TODAY'S MISSION HERO ──────────────────────────────────────────────────────

function TodaysMissionHero({ user, onAppClick, onAllMissionsDone }) {
  const { t, lang } = useLang();
  const navigate    = useNavigate();
  const jp          = lang === "jp";
  const todayJST    = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const jstHour     = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo", hour: "numeric", hour12: false }), 10);
  const habitLine   = habitGreeting(user?.preferredTime, jstHour, jp);

  const [missions,    setMissions]    = useState(null);
  const [missionData, setMissionData] = useState(null);
  const [card,        setCard]        = useState(null);
  const [primaryApp,  setPrimaryApp]  = useState(null);

  // Live mission progress via snapshot
  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    return onSnapshot(ref, snap => {
      if (snap.exists()) {
        const data = snap.data();
        setMissionData(data);
        setMissions(data.missions);
        if (onAllMissionsDone && Array.isArray(data.missions) && data.missions.length > 0 && data.missions.every(m => m.done)) {
          const key = `hsd_cel_missions_${user.uid}_${todayJST}`;
          if (!localStorage.getItem(key)) {
            localStorage.setItem(key, "1");
            onAllMissionsDone();
          }
        }
      } else {
        setMissions(DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false })));
        setMissionData({});
      }
    }, () => {
      setMissions(DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false })));
    });
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Today's focus from coaching card (cached, no need for live)
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid, "coachingCards", todayJST)).then(snap => {
      if (snap.exists()) setCard(snap.data());
    }).catch(() => {});
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Primary app from learning path
  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid, "learningPath", "current")).then(snap => {
      if (snap.exists()) {
        const appId = snap.data().primaryApp;
        if (appId) {
          const app = APPS.find(a => a.id === appId);
          if (app) setPrimaryApp(app);
        }
      }
    }).catch(() => {});
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatCount   = Math.min(missionData?.chatCount   ?? 0, 3);
  const lessonCount = Math.min(missionData?.lessonCount ?? 0, 1);
  const display = (missions ?? DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false }))).map(m => ({
    ...m,
    label:   t(m.labelKey),
    current: m.done ? m.total : m.id === "chat" ? chatCount : m.id === "lesson" ? lessonCount : m.current,
  }));

  const completedCount = display.filter(m => m.done).length;
  const earnedXP       = display.filter(m => m.done).reduce((sum, m) => sum + (m.xp || 0), 0);
  const allDone        = completedCount === display.length;

  function handleContinue() {
    if (!primaryApp) return;
    const uniApps = ["career-ready", "global-ready", "speak-ready"];
    if (uniApps.includes(primaryApp.id)) {
      navigate(`/${primaryApp.id}`);
    } else {
      onAppClick(primaryApp);
    }
  }

  return (
    <div style={{
      background: "linear-gradient(135deg, #0d0d0d 0%, #130a0a 60%, #0d0d0d 100%)",
      border: "1px solid rgba(224,16,16,0.18)",
      borderRadius: 16, padding: "24px 24px 20px",
      position: "relative", overflow: "hidden",
    }}>
      {/* bg orb */}
      <div style={{ position: "absolute", top: -60, right: -40, width: 180, height: 180, borderRadius: "50%", background: "rgba(224,16,16,0.035)", pointerEvents: "none" }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: habitLine ? 4 : 8 }}>
            {jp ? "今日のミッション" : "TODAY'S MISSIONS"}
          </div>
          {habitLine && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic", marginBottom: 8, letterSpacing: 0.1 }}>
              {habitLine}
            </div>
          )}
          {card?.focus && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: "rgba(224,16,16,0.1)", border: "1px solid rgba(224,16,16,0.22)",
              fontSize: 12, fontWeight: 600, color: "#e87070",
            }}>
              🎯 {jp ? (card.focus_jp || card.focus) : card.focus}
            </div>
          )}
        </div>
        {earnedXP > 0 && (
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#22c55e" }}>+{earnedXP}</div>
            <div style={{ fontSize: 9, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase" }}>
              {jp ? "XP獲得" : "XP earned"}
            </div>
          </div>
        )}
      </div>

      {/* Mission progress bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        {display.map(m => (
          <div key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{m.icon}</span>
                <span style={{ fontSize: 12, color: m.done ? "#22c55e" : COLORS.text, textDecoration: m.done ? "line-through" : "none" }}>
                  {m.label}
                </span>
              </div>
              {m.done
                ? <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>+{m.xp} XP ✓</span>
                : <span style={{ fontSize: 10, color: COLORS.textDim }}>{m.current}/{m.total}</span>
              }
            </div>
            <ProgressBar current={m.current} total={m.total} color={m.done ? "#22c55e" : COLORS.red} />
          </div>
        ))}
      </div>

      {/* Continue CTA */}
      {primaryApp && (
        <button
          onClick={handleContinue}
          style={{
            width: "100%", padding: "13px 20px",
            background: allDone ? "linear-gradient(90deg, #166534, #15803d)" : COLORS.red,
            border: "none", borderRadius: 10,
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: allDone ? "0 0 20px rgba(34,197,94,0.25)" : "0 0 20px rgba(224,16,16,0.25)",
            transition: "box-shadow 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = allDone ? "0 0 30px rgba(34,197,94,0.4)" : "0 0 30px rgba(224,16,16,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = allDone ? "0 0 20px rgba(34,197,94,0.25)" : "0 0 20px rgba(224,16,16,0.25)"; }}
        >
          {primaryApp.image
            ? <img src={primaryApp.image} alt="" style={{ width: 20, height: 20, borderRadius: 5, objectFit: "cover", flexShrink: 0 }} />
            : <span style={{ fontSize: 16, flexShrink: 0 }}>{primaryApp.icon}</span>
          }
          <span>
            {allDone
              ? (jp ? `${primaryApp.name} — 全完了！🎉` : `${primaryApp.name} — All done! 🎉`)
              : (jp ? `${primaryApp.name}を続ける →` : `Continue ${primaryApp.name} →`)
            }
          </span>
        </button>
      )}
    </div>
  );
}

function MissionsCard({ user }) {
  const { t }    = useLang();
  const todayJST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const [missions, setMissions]     = useState(null);
  const [missionData, setMissionData] = useState(null);
  const completing = useRef(new Set());

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setMissionData(data);
        setMissions(data.missions);
      } else {
        const initial = DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false }));
        setMissions(initial);
        setMissionData({});
        setDoc(ref, { missions: initial, date: todayJST, createdAt: serverTimestamp() }).catch(() => {});
      }
    }, () => {
      setMissions(DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false })));
    });
    return unsub;
  }, [user?.uid]);

  async function completeMission(idx) {
    if (!user?.uid || !missions || missions[idx].done || completing.current.has(idx)) return;
    completing.current.add(idx);
    const updated = missions.map((m, i) => i === idx ? { ...m, current: m.total, done: true } : m);
    setMissions(updated);
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    await setDoc(ref, { missions: updated, date: todayJST }, { merge: true });
    await awardXP(user.uid, missions[idx].xp);
    completing.current.delete(idx);
  }

  // Auto-complete missions when real events are detected
  useEffect(() => {
    if (!missions || !user?.uid) return;
    const chatIdx   = missions.findIndex(m => m.id === "chat");
    const streakIdx = missions.findIndex(m => m.id === "streak");
    const lessonIdx = missions.findIndex(m => m.id === "lesson");
    if (streakIdx >= 0 && !missions[streakIdx].done && (user?.streak ?? 0) > 0) completeMission(streakIdx);
    if (chatIdx   >= 0 && !missions[chatIdx].done   && (missionData?.chatCount   ?? 0) >= 3) completeMission(chatIdx);
    if (lessonIdx >= 0 && !missions[lessonIdx].done && (missionData?.lessonCount ?? 0) >= 1) completeMission(lessonIdx);
  }, [missions, missionData, user?.streak]); // eslint-disable-line react-hooks/exhaustive-deps

  const chatCount   = Math.min(missionData?.chatCount   ?? 0, 3);
  const lessonCount = Math.min(missionData?.lessonCount ?? 0, 1);
  const display = (missions ?? DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false }))).map(m => ({
    ...m,
    label:   t(m.labelKey),
    current: m.done ? m.total : m.id === "chat" ? chatCount : m.id === "lesson" ? lessonCount : m.current,
  }));

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>{t("todays_missions")}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {display.map((m) => (
          <div key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ fontSize: 12, color: m.done ? COLORS.success : COLORS.text, textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
              </div>
              {m.done
                ? <span style={{ fontSize: 10, color: COLORS.success, fontWeight: 700 }}>+{m.xp} XP ✓</span>
                : <span style={{ fontSize: 10, color: COLORS.textDim }}>{m.current}/{m.total}</span>
              }
            </div>
            <ProgressBar current={m.current} total={m.total} color={m.done ? COLORS.success : COLORS.red} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsCard({ user }) {
  const { t }    = useLang();
  const [recs, setRecs] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    getLearnerProfile(user.uid).then(profile => {
      const r = generateRecommendations(user, profile);
      setRecs(r);
    }).catch(() => {});
  }, [user?.uid]);

  if (!recs) return null;

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>{t("jona_recommends")}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <RecItem icon="📚" label={t("todays_lesson")} text={recs.lesson} />
        <RecItem icon="⚡" label={t("challenge")} text={recs.challenge} />
        <RecItem icon="💬" label={t("conversation_topic")} text={recs.topic} />
      </div>
    </div>
  );
}

function RecItem({ icon, label, text }) {
  return (
    <div style={{ padding: "10px 12px", background: "#0d0d0d", borderRadius: 8, border: "1px solid #1a1a1a" }}>
      <div style={{ fontSize: 10, color: COLORS.red, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

function CoachingCard({ user, member, autoPlay, onSpeakReady }) {
  const [card, setCard]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [audioState, setAudioState] = useState("idle"); // idle | loading | playing
  const audioRef                = useRef(null);
  const speakRef                = useRef(null); // always points to latest speak()
  const { lang }                = useLang();
  const { subscriptions }       = useSubscription();
  const { isAdmin }             = useAuth();
  const navigate                = useNavigate();
  const { setJonaSpeaking }     = useJona();

  useEffect(() => {
    setJonaSpeaking(audioState === "playing" || audioState === "loading");
  }, [audioState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register speak function with parent so Jona orb tap can trigger it
  useEffect(() => {
    if (onSpeakReady) onSpeakReady(() => speakRef.current?.());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const jp                      = lang === "jp";
  const isKid                   = !!member;

  // Workbook bonus counts as paid
  const workbookActive = user?.workbookBonusRedeemed && (() => {
    const end = user?.workbookBonusEndDate;
    if (!end) return false;
    const d = end?.toDate ? end.toDate() : new Date(end);
    return new Date() < d;
  })();
  const isPaid = isAdmin || subscriptions.length > 0 || workbookActive;

  // Stop audio on unmount
  useEffect(() => () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setAudioState("idle");
    setCard(null);
    setLoading(true);

    const today   = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const cardRef = member
      ? doc(db, "users", user.uid, "familyMembers", member.id, "coachingCards", today)
      : doc(db, "users", user.uid, "coachingCards", today);

    getDoc(cardRef).then(async snap => {
      const cached = snap.exists() ? snap.data() : null;
      const hasJP  = (s) => s && /[぀-ゟ゠-ヿ一-鿿]/.test(s);
      const cacheValid = cached?.focus
        && hasJP(cached?.focus_jp)
        && hasJP(cached?.message_jp)
        && hasJP(cached?.challenge_jp)
        && hasJP(cached?.tip_jp);
      if (cacheValid) {
        setCard(cached);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/coaching-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(member ? {
            uid:             user.uid,
            name:            member.name?.split(" ")[0] ?? "there",
            age:             member.age ?? null,
            confidenceScore: member.confidenceScore ?? 40,
            plan:            user.plan ?? "free",
            isKid:           true,
          } : {
            uid:             user.uid,
            name:            user.name?.split(" ")[0] ?? "there",
            confidenceScore: user.confidenceScore ?? 50,
            cefr:            user.cefr ?? null,
            streak:          user.streak ?? 0,
            xpEarned:        user.xpEarned ?? 0,
            plan:            user.plan ?? "free",
          }),
        });
        if (!res.ok) throw new Error("coaching api error");
        const data = await res.json();
        if (data.focus) {
          setCard(data);
          if (hasJP(data.focus_jp)) {
            setDoc(cardRef, { ...data, generatedAt: serverTimestamp() }).catch(() => {});
          }
        }
      } catch {
        // Fail silently — card just won't show
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.uid, member?.id]);

  async function speak() {
    if (!card || !user?.uid) return;

    // Stop if already playing
    if (audioState === "playing" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setAudioState("idle");
      return;
    }
    if (audioState === "loading") return;

    setAudioState("loading");

    // Build greeting prefix
    const hour   = new Date().getHours();
    const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    const first  = user.name?.split(" ")[0] || "there";
    const jp     = lang === "jp";
    const greetLine = jp
      ? `おはようございます、${first}。今日のコーチングをお届けします。`
      : `Good ${period}, ${first}. Here's your daily coaching from Jona.`;

    const text = jp
      ? [
          greetLine,
          `今日のフォーカス：${card.focus_jp || card.focus}。`,
          card.message_jp   || card.message,
          card.challenge_jp ? `チャレンジ：${card.challenge_jp}` : null,
          card.tip_jp       ? `ヒント：${card.tip_jp}` : null,
        ].filter(Boolean).join(" ")
      : [
          greetLine,
          `Today's focus: ${card.focus}.`,
          card.message,
          card.challenge ? `Your challenge: ${card.challenge}.` : null,
          card.tip       ? `Tip: ${card.tip}.` : null,
        ].filter(Boolean).join(" ");

    try {
      const res = await fetch("/api/tts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid: user.uid, text }),
      });
      if (!res.ok) throw new Error("tts failed");

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; setAudioState("idle"); };
      audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; setAudioState("idle"); };

      setAudioState("playing");
      audio.play();
    } catch {
      setAudioState("idle");
    }
  }

  // Keep ref current so parent callback always calls latest version
  speakRef.current = speak;

  // Auto-play once per session day when card loads (paid users only)
  useEffect(() => {
    if (!autoPlay || !card || !user?.uid || !isPaid) return;
    const todayJST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const key      = `jona_greeted_${user.uid}_${todayJST}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      const delay = setTimeout(() => speakRef.current?.(), 1500);
      return () => clearTimeout(delay);
    }
  }, [card]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardTitle = isKid
    ? (jp ? `${member.name?.split(" ")[0]}のコーチ` : `${member.name?.split(" ")[0]}'s Coach`)
    : (jp ? "デイリーコーチ" : "Daily Coach");

  if (loading) return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>🧠</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", letterSpacing: 2, textTransform: "uppercase" }}>{cardTitle}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[80, 60, 90].map((w, i) => (
          <div key={i} style={{ height: 10, borderRadius: 4, background: "#1a1a1a", width: `${w}%`, animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
    </div>
  );

  if (!card) return null;

  return (
    <div style={{
      background: "linear-gradient(160deg, #020e14 0%, #061a1a 100%)",
      border: "1px solid rgba(6,182,212,0.2)",
      borderRadius: 12, padding: 16, position: "relative", overflow: "hidden",
    }}>
      <style>{`
        @keyframes monkeyTalk {
          from { transform: scale(1)    rotate(-6deg); }
          to   { transform: scale(1.18) rotate(6deg);  }
        }
      `}</style>

      <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(6,182,212,0.06)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15 }}>🧠</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", letterSpacing: 2, textTransform: "uppercase" }}>
          {cardTitle}
        </span>
        <span style={{ fontSize: 9, color: "#06b6d433", fontStyle: "italic" }}>
          {new Date().toLocaleDateString(jp ? "ja-JP" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Tokyo" })}
        </span>
        {isPaid ? (
          <button
            onClick={speak}
            title={audioState === "playing" ? "Stop" : audioState === "loading" ? "Loading…" : "Listen"}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: audioState === "loading" ? "wait" : "pointer", padding: 0, lineHeight: 0, flexShrink: 0 }}
          >
            <img
              src="/assets/monkey.png"
              alt="Listen"
              style={{
                width: 36, height: 36,
                borderRadius: "50%",
                mixBlendMode: "screen",
                filter: audioState === "playing"
                  ? "drop-shadow(0 0 10px #e01010) brightness(1.4)"
                  : audioState === "loading"
                  ? "drop-shadow(0 0 6px rgba(224,16,16,0.7)) brightness(1.2)"
                  : "drop-shadow(0 0 4px rgba(224,16,16,0.5)) brightness(1.05)",
                animation: audioState === "playing" ? "monkeyTalk 0.35s ease-in-out infinite alternate"
                  : audioState === "loading"  ? "monkeyTalk 0.7s ease-in-out infinite alternate"
                  : "none",
                transition: "filter 0.25s",
              }}
            />
          </button>
        ) : (
          <button
            onClick={() => navigate("/plans")}
            title="Upgrade to listen"
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 0, flexShrink: 0, position: "relative" }}
          >
            <img src="/assets/monkey.png" alt="Locked" style={{ width: 36, height: 36, borderRadius: "50%", mixBlendMode: "screen", filter: "grayscale(1) brightness(0.4)", opacity: 0.6 }} />
            <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🔒</span>
          </button>
        )}
      </div>

      {/* Focus — always visible */}
      <div style={{ marginBottom: 10, padding: "6px 10px", background: "rgba(6,182,212,0.1)", borderRadius: 8, border: "1px solid rgba(6,182,212,0.2)" }}>
        <div style={{ fontSize: 9, color: "#06b6d4", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
          {jp ? "今日のフォーカス" : "Today's Focus"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e0f7fa" }}>
          {jp ? (card.focus_jp || card.focus) : card.focus}
        </div>
      </div>

      {isPaid ? (
        <>
          {/* Message */}
          <div style={{ fontSize: 12, color: "#a0b4b8", lineHeight: 1.6, marginBottom: 10 }}>
            {jp ? (card.message_jp || card.message) : card.message}
          </div>

          {/* Challenge */}
          <div style={{ marginBottom: 10, padding: "8px 10px", background: "#0a1a1a", borderRadius: 8, border: "1px solid #0d2a2a" }}>
            <div style={{ fontSize: 9, color: "#06b6d4", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
              {jp ? "⚡ 2分チャレンジ" : "⚡ 2-min Challenge"}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
              {jp ? (card.challenge_jp || card.challenge) : card.challenge}
            </div>
          </div>

          {/* Tip */}
          <div style={{ fontSize: 11, color: "#4a7a80", lineHeight: 1.5, borderTop: "1px solid #0d2a2a", paddingTop: 8 }}>
            <span style={{ color: "#06b6d466", fontWeight: 700 }}>💡 </span>
            {jp ? (card.tip_jp || card.tip) : card.tip}
          </div>
        </>
      ) : (
        /* Free teaser — blurred preview + upgrade CTA */
        <div style={{ position: "relative", marginTop: 4 }}>
          <div style={{ filter: "blur(3px)", opacity: 0.4, pointerEvents: "none", userSelect: "none" }}>
            <div style={{ fontSize: 12, color: "#a0b4b8", lineHeight: 1.6, marginBottom: 10 }}>
              {card.message}
            </div>
            <div style={{ padding: "8px 10px", background: "#0a1a1a", borderRadius: 8, border: "1px solid #0d2a2a" }}>
              <div style={{ fontSize: 9, color: "#06b6d4", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>⚡ 2-min Challenge</div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{card.challenge}</div>
            </div>
          </div>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: "center" }}>
              {jp ? "フルコーチングカードはプレミアムプランで" : "Full coaching card on paid plans"}
            </div>
            <button
              onClick={() => navigate("/plans")}
              style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: COLORS.red, border: "none", borderRadius: 20, padding: "5px 14px", cursor: "pointer" }}
            >
              {jp ? "プランを見る →" : "View Plans →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UniversityAICoach({ user, lang }) {
  const [input, setInput]     = useState("");
  const [reply, setReply]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [activePrompt, setActivePrompt] = useState(null);
  const jp = lang === "jp";

  const QUICK = [
    { label: jp ? "面接練習" : "Interview Practice", prompt: "Give me a practice interview question for a Japanese university student applying for their first job in English. Then coach me on what a great answer looks like." },
    { label: jp ? "留学Q&A" : "Study Abroad Q&A",   prompt: "I'm a Japanese university student thinking about studying abroad. What's the most important English skill I need to develop first?" },
    { label: jp ? "メール作成" : "Email Help",         prompt: "Help me write a professional email in English to a professor at an overseas university asking about their research program." },
    { label: jp ? "発表練習" : "Presentation Tips",   prompt: "Give me your top tip for a Japanese university student giving their first English presentation in class." },
  ];

  async function ask(text) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setReply(null);
    try {
      const { sendMessage } = await import("../lib/claude.js");
      const msgs = [{ role: "user", content: `University student context. ${text}` }];
      const res  = await sendMessage(msgs, user);
      setReply(res);
    } catch {
      setReply(jp ? "もう一度お試しください。" : "Something went wrong. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div style={{ background: "linear-gradient(135deg, rgba(46,196,182,0.06) 0%, rgba(10,10,10,0) 70%)", border: "1px solid rgba(46,196,182,0.25)", borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(46,196,182,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🤖</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#2ec4b6" }}>{jp ? "大学生AIコーチ" : "University AI Coach"}</div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>{jp ? "面接・留学・メール・発表の英語をサポート" : "Interviews · study abroad · emails · presentations"}</div>
        </div>
      </div>

      {/* Quick prompts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {QUICK.map(q => (
          <button
            key={q.label}
            onClick={() => { setActivePrompt(q.label); ask(q.prompt); }}
            style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
              background: activePrompt === q.label && loading ? "rgba(46,196,182,0.2)" : "rgba(46,196,182,0.08)",
              border: `1px solid rgba(46,196,182,${activePrompt === q.label ? "0.5" : "0.2"})`,
              color: "#2ec4b6", transition: "all 0.15s",
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Custom input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); setActivePrompt(null); ask(input); setInput(""); } }}
          placeholder={jp ? "英語の質問を入力…" : "Ask anything about university English…"}
          style={{ flex: 1, padding: "9px 14px", borderRadius: 10, background: "#0d0d0d", border: "1px solid #2a2a2a", color: "#fff", fontSize: 13, outline: "none" }}
        />
        <button
          onClick={() => { setActivePrompt(null); ask(input); setInput(""); }}
          disabled={!input.trim() || loading}
          style={{ padding: "9px 16px", borderRadius: 10, background: input.trim() ? "#2ec4b6" : "#1a1a1a", border: "none", color: input.trim() ? "#0a1a1a" : "#444", fontWeight: 700, fontSize: 13, cursor: input.trim() ? "pointer" : "default", transition: "all 0.2s" }}
        >
          {loading ? "…" : "Ask"}
        </button>
      </div>

      {/* Response */}
      {loading && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#0d0d0d", borderRadius: 10, fontSize: 13, color: COLORS.textMuted, fontStyle: "italic" }}>
          {jp ? "考え中…" : "Thinking…"}
        </div>
      )}
      {reply && !loading && (
        <div style={{ marginTop: 14, padding: "14px 16px", background: "#0d0d0d", border: "1px solid rgba(46,196,182,0.15)", borderRadius: 10, fontSize: 13, color: "#e0e0e0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
          {reply}
          <button
            onClick={() => { setReply(null); setActivePrompt(null); }}
            style={{ display: "block", marginTop: 10, background: "none", border: "none", color: COLORS.textDim, fontSize: 11, cursor: "pointer", padding: 0 }}
          >
            {jp ? "閉じる" : "Clear"}
          </button>
        </div>
      )}
    </div>
  );
}

function UniversitySection({ user, onBack }) {
  const { lang }        = useLang();
  const navigate        = useNavigate();
  const { hasUniversity } = useSubscription();
  const subscribed      = hasUniversity();
  const jp              = lang === "jp";
  const GOLD            = COLORS.gold;

  // Recommendation card state — fires a targeted AI prompt inline
  const [recLoading, setRecLoading] = useState(false);
  const [recText, setRecText]       = useState(null);

  async function loadRecommendation() {
    if (recLoading || recText) return;
    setRecLoading(true);
    try {
      const { sendMessage } = await import("../lib/claude.js");
      const firstName = user?.name?.split(" ")[0] ?? "there";
      const msgs = [{ role: "user", content: `University student context. Name: ${firstName}. Confidence: ${user?.confidenceScore ?? 50}%. Streak: ${user?.streak ?? 0} days. Based on this profile, give ONE specific session recommendation for today — interview practice, global English, or speaking confidence. Be direct and name the exact exercise. 2–3 sentences maximum.` }];
      const res  = await sendMessage(msgs, user);
      setRecText(res);
    } catch {
      setRecText(jp ? "もう一度お試しください。" : "Couldn't load recommendation — try again.");
    }
    setRecLoading(false);
  }

  const FOCUS_CARDS = [
    {
      icon: "🎙️",
      title:   jp ? "面接練習" : "Interview Practice",
      titleJp: "面接練習",
      desc:    jp ? "AI面接官と本番さながらの練習" : "AI mock interview with real-time coaching",
      color:   "#2ec4b6",
      action:  () => navigate("/career-ready"),
      cta:     jp ? "練習開始 →" : "Start session →",
    },
    {
      icon: "📢",
      title:   jp ? "プレゼン目標" : "Presentation Goals",
      titleJp: "プレゼン目標",
      desc:    jp ? "発音・流暢さ・スピーキング自信UP" : "Pronunciation, fluency, and public speaking",
      color:   "#8b5cf6",
      action:  () => navigate("/speak-ready"),
      cta:     jp ? "スタート →" : "Start session →",
    },
    {
      icon: "🌍",
      title:   jp ? "グローバル準備" : "Career Readiness",
      titleJp: "グローバル準備",
      desc:    jp ? "留学・TOEFL・グローバルビジネス英語" : "Business email, resume, and study abroad prep",
      color:   "#f59e0b",
      action:  () => navigate("/global-ready"),
      cta:     jp ? "スタート →" : "Start session →",
    },
    {
      icon: "✨",
      title:   jp ? "AIからのおすすめ" : "AI Recommendations",
      titleJp: "AIからのおすすめ",
      desc:    jp ? "あなたの今日のセッションをJonaが提案" : "Jawna's pick for your session today",
      color:   GOLD,
      isRec:   true,
      cta:     jp ? "おすすめを見る →" : "Get my recommendation →",
    },
  ];

  if (!subscribed) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
          <BackBar title={jp ? "University+" : "University+"} onBack={onBack} />

          {/* Hero upsell — single card */}
          <div style={{
            marginTop: 8,
            background: `linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(10,10,10,0) 70%)`,
            border: `1px solid rgba(245,158,11,0.3)`,
            borderRadius: 16, padding: "28px 24px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
              {jp ? "大学生・就活向け" : "University · Career · Global"}
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, lineHeight: 1.25 }}>
              {jp ? "University+" : "University+"}
            </div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7, marginBottom: 20, maxWidth: 480 }}>
              {jp
                ? "面接練習・スピーキング自信・留学準備 — 3つのパスで就活・グローバルキャリアを徹底サポート。150 AIセッション/月。"
                : "Interview practice, speaking confidence, and study abroad prep — all three paths in one plan. 150 AI sessions per month. Founding rate locked for life."}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
              {[
                { icon: "🎙️", label: jp ? "AI面接練習"      : "AI Interview Practice" },
                { icon: "📢",  label: jp ? "スピーキング自信" : "Speaking Confidence" },
                { icon: "🌍",  label: jp ? "グローバル準備"   : "Global & Study Abroad" },
              ].map(item => (
                <div key={item.label} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "6px 14px", borderRadius: 20,
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  fontSize: 12, color: GOLD,
                }}>
                  <span>{item.icon}</span> {item.label}
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: GOLD }}>¥4,980</span>
              <span style={{ fontSize: 13, color: COLORS.textMuted }}>/mo · ¥49,800/yr</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "2px 10px", marginLeft: 4 }}>
                {jp ? "創設価格 — 永久固定" : "Founding Rate — Locked Forever"}
              </span>
            </div>

            <button
              onClick={() => navigate("/plans")}
              style={{
                padding: "13px 28px", background: GOLD, border: "none", borderRadius: 10,
                color: "#0a0a0a", fontSize: 14, fontWeight: 800, cursor: "pointer",
                boxShadow: `0 0 24px rgba(245,158,11,0.3)`,
              }}
            >
              {jp ? "University+ を始める →" : "Get University+ →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>

        {/* Header */}
        <BackBar title="University+" onBack={onBack} />
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            {jp ? "大学生・就活向け AI コーチング" : "University · Career · Global"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>
            {jp
              ? "AI面接練習・スピーキング・留学準備 — 150セッション/月"
              : "AI interview practice, speaking confidence, and global readiness — 150 sessions per month"}
          </div>
        </div>

        {/* AI Coach — quick prompts + free input */}
        <UniversityAICoach user={user} lang={lang} />

        {/* Focus cards */}
        <div style={{ marginTop: 24, marginBottom: 4 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
            {jp ? "今日のセッション" : "Today's Focus"}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {FOCUS_CARDS.map(card => (
              <div
                key={card.title}
                onClick={card.isRec ? loadRecommendation : card.action}
                style={{
                  background: "#0d0d0d",
                  border: `1px solid ${card.color}33`,
                  borderRadius: 14, padding: "18px 16px",
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = card.color + "88"; e.currentTarget.style.boxShadow = `0 0 16px ${card.color}18`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = card.color + "33"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 26, marginBottom: 10, lineHeight: 1 }}>{card.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: card.color, marginBottom: 6 }}>
                  {jp ? card.titleJp : card.title}
                </div>
                <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
                  {card.desc}
                </div>

                {card.isRec ? (
                  recLoading ? (
                    <div style={{ fontSize: 11, color: COLORS.textDim, fontStyle: "italic" }}>
                      {jp ? "考え中…" : "Thinking…"}
                    </div>
                  ) : recText ? (
                    <div style={{ fontSize: 12, color: "#e0e0e0", lineHeight: 1.6, borderTop: `1px solid ${GOLD}22`, paddingTop: 10 }}>
                      {recText}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 700, color: GOLD }}>{card.cta}</div>
                  )
                ) : (
                  <div style={{ fontSize: 12, fontWeight: 700, color: card.color }}>{card.cta}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceCard({ user, activeMember }) {
  const { t, lang } = useLang();
  const score = activeMember ? (activeMember.confidenceScore ?? 0) : (user?.confidenceScore ?? 0);
  const label = activeMember ? activeMember.name : null;
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>{label ? (lang === "jp" ? `${label}さんの自信スコア` : `${label}'s Confidence`) : t("confidence_score")}</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ConfidenceRing score={score} />
        <div>
          <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>{t("keep_it_up")}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4, lineHeight: 1.4 }}>{t("improving_daily")}</div>
          {!activeMember && (
            <button style={{ marginTop: 10, padding: "7px 12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 11, cursor: "pointer" }}>
              {t("view_insights")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ user }) {
  const { t } = useLang();
  const stats = [
    { label: t("hours_learned"),  value: user?.hoursLearned ?? 0,   icon: "⏰" },
    { label: t("lessons_done"),   value: user?.lessonsCompleted ?? 0, icon: "✅" },
    { label: t("xp_earned"),      value: (user?.xpEarned ?? 0).toLocaleString(), icon: "⭐" },
  ];
  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>{t("your_progress")}</SectionTitle>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FamilyCard({ user, members = [], activeMember, setActiveMember }) {
  const { t, lang } = useLang();
  const [showModal, setShowModal]         = useState(false);
  const [newName, setNewName]             = useState("");
  const [newAge, setNewAge]               = useState("");
  const [saving, setSaving]               = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]); // [{memberName, focus, dateId}]

  // Load recent coaching cards across all members for the activity feed
  useEffect(() => {
    if (!user?.uid || members.length === 0) return;
    let cancelled = false;
    async function load() {
      const all = [];
      for (const m of members) {
        try {
          const q    = query(collection(db, "users", user.uid, "familyMembers", m.id, "coachingCards"), orderBy("generatedAt", "desc"), limit(3));
          const snap = await getDocs(q);
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.focus) all.push({ memberName: m.name, memberId: m.id, focus: data.focus, dateId: d.id });
          });
        } catch { /* member has no coaching cards yet */ }
      }
      // Sort by dateId descending (YYYY-MM-DD) and keep top 3
      all.sort((a, b) => b.dateId.localeCompare(a.dateId));
      if (!cancelled) setRecentActivity(all.slice(0, 3));
    }
    load();
    return () => { cancelled = true; };
  }, [user?.uid, members.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync family member names to the user profile document so Jona's AI context stays fresh
  async function syncProfileSummary(updatedMembers) {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        familyMembers: updatedMembers.map(m => ({ id: m.id, name: m.name, age: m.age ?? null, confidenceScore: m.confidenceScore ?? 0 })),
      });
    } catch { /* non-critical */ }
  }

  async function addMember() {
    if (!newName.trim() || saving) return;
    if (members.length >= 5) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "users", user.uid, "familyMembers"), {
        name:            newName.trim(),
        age:             newAge ? parseInt(newAge, 10) : null,
        confidenceScore: 0,
        cefr:            null,
        assessmentDone:  false,
        createdAt:       serverTimestamp(),
      });
      // Update profile summary so useAuth & Jona context get the new member
      const next = [...members, { id: ref.id, name: newName.trim(), age: newAge ? parseInt(newAge, 10) : null, confidenceScore: 0 }];
      syncProfileSummary(next);
      setNewName("");
      setNewAge("");
      setShowModal(false);
    } catch (err) {
      console.error("Add member error:", err);
    }
    setSaving(false);
  }

  async function deleteMember(id) {
    try {
      await deleteDoc(doc(db, "users", user.uid, "familyMembers", id));
      if (activeMember?.id === id) setActiveMember(null);
      syncProfileSummary(members.filter(m => m.id !== id));
    } catch (err) {
      console.error("Delete member error:", err);
    }
    setConfirmDelete(null);
  }

  // Who needs encouragement — lowest confidenceScore among members (only show if <60% and 2+ members)
  const encourageMember = members.length >= 2
    ? members.reduce((lowest, m) => (m.confidenceScore ?? 0) < (lowest.confidenceScore ?? 0) ? m : lowest, members[0])
    : null;
  const showEncourage = encourageMember && (encourageMember.confidenceScore ?? 0) < 60;

  function daysAgoLabel(dateId) {
    try {
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
      const diff  = Math.round((new Date(today) - new Date(dateId)) / 86400000);
      if (diff <= 0) return lang === "jp" ? "今日" : "today";
      if (diff === 1) return lang === "jp" ? "昨日" : "yesterday";
      return lang === "jp" ? `${diff}日前` : `${diff}d ago`;
    } catch { return ""; }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── Family overview grid ────────────────────────────────────── */}
        <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <SectionTitle style={{ margin: 0 }}>{t("family_progress")}</SectionTitle>
            <div style={{ fontSize: 11, color: COLORS.textMuted }}>{members.length}/5 members</div>
          </div>

          {members.length === 0 ? (
            <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", padding: "16px 0" }}>
              {t("no_family")}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {members.map((m) => {
                const isActive = activeMember?.id === m.id;
                const score    = m.confidenceScore ?? 0;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: isActive ? "rgba(224,16,16,0.10)" : "transparent",
                      border: isActive ? "1px solid rgba(224,16,16,0.35)" : "1px solid transparent",
                      borderRadius: 8, padding: "8px 10px", transition: "all 0.15s",
                    }}
                  >
                    <div
                      onClick={() => { setActiveMember(isActive ? null : m); setConfirmDelete(null); }}
                      style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer", minWidth: 0 }}
                    >
                      {/* Avatar with confidence ring colour */}
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                        background: isActive ? "linear-gradient(135deg,#4a0000,#e01010)" : "linear-gradient(135deg,#1a1a1a,#2a2a2a)",
                        border: `2px solid ${isActive ? COLORS.red : (score >= 70 ? COLORS.success : score >= 40 ? COLORS.gold : "#444")}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 14, fontWeight: 700, color: isActive ? "#fff" : COLORS.text,
                      }}>
                        {m.name?.[0]?.toUpperCase()}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, display: "flex", alignItems: "center", gap: 6 }}>
                          {m.name}
                          {isActive && <span style={{ fontSize: 9, color: COLORS.red, fontWeight: 700, letterSpacing: 1 }}>VIEWING</span>}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1 }}>
                          {m.cefr
                            ? <><span style={{ color: CEFR_META[m.cefr]?.color ?? COLORS.textMuted }}>{m.cefr}</span>{" · "}{lang === "jp" ? (CEFR_META[m.cefr]?.eiken ?? "") : (CEFR_META[m.cefr]?.eikenEn ?? "")}</>
                            : t("no_assessment")}
                          {m.age ? ` · Age ${m.age}` : ""}
                        </div>
                      </div>

                      {/* Confidence pill */}
                      <div style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, flexShrink: 0,
                        background: score >= 70 ? "rgba(34,197,94,0.12)" : score >= 40 ? "rgba(245,158,11,0.12)" : "rgba(224,16,16,0.10)",
                        color: score >= 70 ? COLORS.success : score >= 40 ? COLORS.gold : COLORS.red,
                      }}>
                        {score}%
                      </div>
                    </div>

                    {/* Delete control */}
                    {confirmDelete === m.id ? (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => deleteMember(m.id)} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: COLORS.red, border: "none", color: "#fff", cursor: "pointer" }}>
                          {t("remove")}
                        </button>
                        <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "transparent", border: "1px solid #333", color: COLORS.textMuted, cursor: "pointer" }}>
                          {t("cancel")}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(m.id)}
                        style={{ flexShrink: 0, background: "none", border: "none", color: "#444", fontSize: 14, cursor: "pointer", padding: "2px 6px", lineHeight: 1, borderRadius: 4, transition: "color 0.15s" }}
                        onMouseEnter={e => { e.currentTarget.style.color = COLORS.red; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#444"; }}
                        title="Remove member"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={() => { if (members.length < 5) setShowModal(true); }}
            disabled={members.length >= 5}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "none", border: "none",
              color: members.length >= 5 ? COLORS.textDim : COLORS.red,
              fontSize: 12, cursor: members.length >= 5 ? "not-allowed" : "pointer",
              padding: "10px 0 0",
            }}
          >
            {members.length >= 5 ? "✓ 5/5 members — plan full" : `+ ${t("add_family")}`}
          </button>
        </div>

        {/* ── Who needs encouragement ─────────────────────────────────── */}
        {showEncourage && (
          <div style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ fontSize: 22, flexShrink: 0 }}>💙</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gold, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                {lang === "jp" ? "励ましが必要" : "Needs encouragement"}
              </div>
              <div style={{ fontSize: 13, color: COLORS.text, fontWeight: 600 }}>
                {encourageMember.name}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                {lang === "jp"
                  ? `自信スコア ${encourageMember.confidenceScore ?? 0}% — セッションを始めてみましょう`
                  : `Confidence at ${encourageMember.confidenceScore ?? 0}% — a short session will help`}
              </div>
            </div>
            <button
              onClick={() => setActiveMember(encourageMember)}
              style={{
                padding: "8px 14px", background: "transparent",
                border: "1px solid rgba(245,158,11,0.4)",
                borderRadius: 8, color: COLORS.gold, fontSize: 12, fontWeight: 600,
                cursor: "pointer", flexShrink: 0,
              }}
            >
              {lang === "jp" ? "開始 →" : "Start →"}
            </button>
          </div>
        )}

        {/* ── Recent family activity ──────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
              {lang === "jp" ? "最近のアクティビティ" : "Recent Achievements"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recentActivity.map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: "linear-gradient(135deg,#1a1a1a,#2a2a2a)",
                    border: "1px solid #333",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: COLORS.textMuted, flexShrink: 0,
                  }}>
                    {item.memberName?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                      {item.memberName}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.focus}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.textDim, flexShrink: 0, paddingTop: 2 }}>
                    {daysAgoLabel(item.dateId)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Add member modal ─────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400,
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 28, width: 340, display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>{t("add_family_member")}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{members.length}/5 member spots used</div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>{t("name_required")}</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Yuki"
                autoFocus
                onKeyDown={e => { if (e.key === "Enter") addMember(); }}
                style={{ width: "100%", padding: "10px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>{t("age_optional")}</label>
              <input
                value={newAge}
                onChange={e => setNewAge(e.target.value)}
                placeholder="e.g. 8"
                type="number"
                min="1"
                max="99"
                style={{ width: "100%", padding: "10px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "9px 16px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
                {t("cancel")}
              </button>
              <button
                onClick={addMember}
                disabled={!newName.trim() || saving}
                style={{ padding: "9px 20px", background: newName.trim() ? COLORS.red : "#333", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: newName.trim() ? "pointer" : "not-allowed", transition: "background 0.15s" }}
              >
                {saving ? t("adding") : t("add_member")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── WORKBOOK CODE CARD ────────────────────────────────────────────────────────
function FoundingMemberBanner({ user }) {
  const { lang } = useLang();
  const isPaid   = (user?.plan && user.plan !== "free") || user?.isFoundingMember;
  if (isPaid) return null;

  const GOLD = "#C9A84C";
  return (
    <div style={{
      background: "rgba(201,168,76,0.07)",
      border: `2px solid rgba(201,168,76,0.45)`,
      borderRadius: 16, padding: "20px 24px",
      display: "flex", gap: 16, alignItems: "flex-start",
    }}>
      <span style={{ fontSize: 28, flexShrink: 0 }}>⭐</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: GOLD, marginBottom: 4 }}>
          {lang === "jp" ? "ファウンディングメンバー — 残り枠わずか" : "Founding Member — Limited Spots Remaining"}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 12 }}>
          {lang === "jp"
            ? "最初の200名の有料メンバーは、プラン料金が永久に固定されます。値上げなし、永遠に。"
            : "The first 200 paying members lock in their price forever. No price increases — ever. Once filled, this offer closes permanently."}
        </div>
        <a
          href="/plans"
          style={{
            display: "inline-block", padding: "11px 22px",
            background: GOLD, borderRadius: 8,
            color: "#000", fontSize: 13, fontWeight: 700,
            textDecoration: "none",
          }}
        >
          {lang === "jp" ? "ファウンダーになる →" : "Claim Your Founding Spot →"}
        </a>
      </div>
    </div>
  );
}

function WorkbookCodeCard({ user }) {
  const { t, lang } = useLang();
  const { workbookDaysRemaining } = useSubscription();
  const [code, setCode]       = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [success, setSuccess] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const redeemed = user?.workbookBonusRedeemed ?? false;
  const daysLeft = workbookDaysRemaining();
  const expired  = redeemed && daysLeft === 0;
  const active   = redeemed && daysLeft > 0;

  const endDate = (() => {
    const raw = user?.workbookBonusEndDate;
    if (!raw) return null;
    const d = raw?.toDate ? raw.toDate() : new Date(raw);
    return d.toLocaleDateString(lang === "jp" ? "ja-JP" : "en-US", { year: "numeric", month: "long", day: "numeric" });
  })();

  async function handleRedeem() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const { auth } = await import("../lib/firebase");
      const idToken  = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/redeem-workbook-code", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ idToken, code: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      setSuccess(true);
      setShowInput(false);
    } catch {
      setError("Could not connect. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Don't render if user already has phonics via a paid plan
  if ((user?.subscriptions ?? []).includes("phonics") && !redeemed) return null;
  // Don't render if expired (show nothing — user should upgrade via Plans)
  if (expired) return null;

  const GOLD = "#f59e0b";

  /* ── Active trial ── */
  if (active) {
    return (
      <div style={{ background: "rgba(245,158,11,0.06)", border: `1px solid rgba(245,158,11,0.3)`, borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>📖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, marginBottom: 2 }}>
            {lang === "jp" ? "Monkey Yoga Phonics — 無料月間アクティブ" : "Monkey Yoga Phonics — Free Month Active"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted }}>
            {lang === "jp" ? `有効期限: ${endDate}` : `Access until: ${endDate}`}
            {daysLeft <= 7 && <span style={{ color: GOLD, marginLeft: 8 }}>⚠️ {daysLeft}d left</span>}
          </div>
        </div>
        <div style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 20, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#22c55e", whiteSpace: "nowrap" }}>
          ✓ {lang === "jp" ? "有効" : "Active"}
        </div>
      </div>
    );
  }

  /* ── Success flash ── */
  if (success) {
    return (
      <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 16, padding: "16px 18px", textAlign: "center", fontSize: 13, color: "#22c55e", fontWeight: 600 }}>
        ✓ {lang === "jp" ? "ワークブック特典が有効になりました！" : "Workbook bonus activated — enjoy your free month!"}
      </div>
    );
  }

  /* ── Not yet redeemed — prominent banner ── */
  return (
    <div style={{ background: "rgba(245,158,11,0.07)", border: `2px solid rgba(245,158,11,0.5)`, borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <span style={{ fontSize: 32 }}>📖</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: GOLD, marginBottom: 3 }}>
            {lang === "jp" ? "ワークブックをお持ちですか？" : "Got a Monkey Yoga Phonics Workbook?"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
            {lang === "jp"
              ? "ボーナスコードを入力して1ヶ月無料でアプリをお試しください。"
              : "Enter your bonus code and unlock 1 free month of app access."}
          </div>
        </div>
      </div>

      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          style={{
            width: "100%", padding: "13px", borderRadius: 10,
            background: GOLD, border: "none",
            color: "#000", fontSize: 14, fontWeight: 700,
            cursor: "pointer", letterSpacing: 0.3,
          }}
        >
          {lang === "jp" ? "🎁 コードを入力する" : "🎁 Redeem Workbook Code"}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleRedeem()}
            placeholder="MYP-B1-XXXX-XXX"
            autoFocus
            style={{
              background: "#111", border: `1px solid ${GOLD}66`, borderRadius: 8,
              color: COLORS.text, fontSize: 14, padding: "11px 14px",
              outline: "none", fontFamily: "monospace", letterSpacing: 2,
              width: "100%", boxSizing: "border-box",
            }}
          />
          {error && <div style={{ fontSize: 11, color: "#f87171" }}>{error}</div>}
          <button
            onClick={handleRedeem}
            disabled={loading || !code.trim()}
            style={{
              width: "100%", padding: "12px", borderRadius: 10,
              background: loading || !code.trim() ? "#333" : GOLD,
              border: "none", color: loading || !code.trim() ? COLORS.textMuted : "#000",
              fontSize: 14, fontWeight: 700, cursor: loading ? "default" : "pointer",
            }}
          >
            {loading ? (lang === "jp" ? "確認中..." : "Checking…") : (lang === "jp" ? "コードを適用する" : "Activate Code")}
          </button>
        </div>
      )}
    </div>
  );
}

function ReferralButton({ user }) {
  const [copied, setCopied] = useState(false);
  const { t } = useLang();

  async function copyLink() {
    const base = window.location.origin;
    const link = `${base}/signin?ref=${user?.uid ?? ""}&mode=signup`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy your referral link:", link);
    }
  }

  return (
    <button
      onClick={copyLink}
      style={{ width: "100%", padding: 8, background: copied ? "rgba(34,197,94,0.1)" : "transparent", border: `1px solid ${copied ? "#22c55e" : "#e01010"}`, borderRadius: 6, color: copied ? "#22c55e" : COLORS.red, fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 8, transition: "all 0.2s" }}
    >
      {copied ? t("copied") : t("copy_referral")}
    </button>
  );
}

function BackBar({ title, onBack }) {
  const { t } = useLang();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <button onClick={onBack} style={{ background: "none", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>{t("back")}</button>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

function SettingsView({ user, onBack }) {
  const { t, lang }               = useLang();
  const navigate                  = useNavigate();
  const [name, setName]           = useState(user?.name ?? "");
  const [nickname, setNickname]   = useState(user?.nickname ?? "");
  const [saved, setSaved]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deletePhase, setDeletePhase] = useState("idle"); // "idle" | "confirm" | "deleting" | "done"
  const [deleteError, setDeleteError] = useState("");

  async function saveProfile() {
    if (!user?.uid || !name.trim()) return;
    setSaving(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const patch = { name: name.trim() };
      if (nickname.trim()) patch.nickname = nickname.trim();
      else patch.nickname = null;
      await updateDoc(doc((await import("../lib/firebase")).db, "users", user.uid), patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function exportData() {
    try {
      const { getDoc, doc: fsDoc } = await import("firebase/firestore");
      const { db: fsDb } = await import("../lib/firebase");
      const snap = await getDoc(fsDoc(fsDb, "users", user.uid));
      const blob = new Blob([JSON.stringify({ uid: user.uid, email: user.email, ...snap.data() }, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = "hsd-my-data.json"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { console.error("Export error:", e); }
  }

  async function deleteAccount() {
    setDeletePhase("deleting");
    setDeleteError("");
    try {
      const { getAuth, deleteUser } = await import("firebase/auth");
      const fbAuth  = getAuth();
      const idToken = await fbAuth.currentUser.getIdToken(true);
      const res     = await fetch("/api/delete-account", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Server deletion failed");
      await deleteUser(fbAuth.currentUser);
      setDeletePhase("done");
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (e) {
      console.error("Delete account error:", e);
      setDeleteError(lang === "jp" ? "エラーが発生しました。もう一度お試しください。" : "Something went wrong. Please try again.");
      setDeletePhase("idle");
    }
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 28 }}>
      <BackBar title={t("settings")} onBack={onBack} />

      <Section label={t("profile")}>
        <Field label={t("display_name")}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            style={{ width: "100%", padding: "10px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }}
          />
        </Field>
        <Field label={lang === "jp" ? "ニックネーム（ランキング表示名）" : "Leaderboard nickname"}>
          <input
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder={lang === "jp" ? "例：英語の達人" : "e.g. EnglishAce · keeps your real name private"}
            maxLength={20}
            style={{ width: "100%", padding: "10px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
            {lang === "jp"
              ? "設定するとランキングに本名の代わりに表示されます。"
              : "Shown on the leaderboard instead of your real name. Leave blank to use your first name."}
          </div>
        </Field>
        <Field label={t("email")}>
          <div style={{ padding: "10px 14px", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, color: COLORS.textMuted, fontSize: 14 }}>{user?.email}</div>
        </Field>
        <button onClick={saveProfile} disabled={saving} style={{ marginTop: 8, padding: "10px 24px", background: COLORS.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {saved ? t("saved") : saving ? t("saving") : t("save_changes")}
        </button>
      </Section>

      <Section label={t("referral_link")}>
        <div style={{ padding: "12px 16px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 13, color: COLORS.textMuted, fontFamily: "monospace", wordBreak: "break-all" }}>
          {`${window.location.origin}/?ref=${user?.uid?.slice(0, 8) ?? "hsd"}`}
        </div>
        <ReferralButton user={user} />
        <div style={{ marginTop: 16, padding: 14, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: COLORS.textDim, marginBottom: 10, textTransform: "uppercase" }}>{t("commission_tiers")}</div>
          {[
            { range: "0–24",   badge: "Member",      badgeJp: "メンバー",       pct: "No commission yet",   pctJp: "コミッションなし"      },
            { range: "25–49",  badge: "Founder",     badgeJp: "ファウンダー",   pct: "5% recurring",        pctJp: "5% 継続報酬"           },
            { range: "50–99",  badge: "Ambassador",  badgeJp: "アンバサダー",   pct: "6% recurring",        pctJp: "6% 継続報酬"           },
            { range: "100–199",badge: "Pioneer",     badgeJp: "パイオニア",     pct: "7% recurring",        pctJp: "7% 継続報酬"           },
            { range: "200+",   badge: "Visionary",   badgeJp: "ビジョナリー",   pct: "Custom partnership",  pctJp: "カスタムパートナーシップ" },
          ].map((tier) => (
            <div key={tier.range} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: COLORS.textDim, marginBottom: 5 }}>
              <span><span style={{ color: COLORS.text, fontWeight: 600 }}>{lang === "jp" ? tier.badgeJp : tier.badge}</span> ({tier.range} {lang === "jp" ? "人" : "refs"})</span>
              <span style={{ color: COLORS.gold }}>{lang === "jp" ? tier.pctJp : tier.pct}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.textDim, lineHeight: 1.6, borderTop: "1px solid #1e1e1e", paddingTop: 10 }}>
            {lang === "jp"
              ? <>あなたのリンクから登録した友人は<span style={{ color: COLORS.gold, fontWeight: 700 }}>初年度2%オフ</span>。「有効な有料紹介」とはキャンセル・返金・停止なしの有効な有料サブスクのことです。無料・トライアルユーザーはカウントされません。バッジとコミッション率は自動更新されます。</>
              : <>Friends who sign up through your link get <span style={{ color: COLORS.gold, fontWeight: 700 }}>2% off for their first year</span>. "Active paying referrals" = active paid subscription, not cancelled, refunded, or suspended. Free and trial users do not count. Your badge and commission rate update automatically.</>
            }
          </div>
        </div>
      </Section>

      <Section label={t("share_progress")}>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
          {t("share_desc")}
        </div>
        <ParentShareButton user={user} />
      </Section>

      <Section label={lang === "jp" ? "ワークブックボーナスコード" : "Workbook Bonus Code"}>
        <WorkbookCodeCard user={user} />
      </Section>

      <Section label={t("account")}>
        <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
          <div>{t("plan_label")}: <strong style={{ color: COLORS.text }}>{user?.plan ?? "Free"}</strong></div>
          <div>{t("member_since")}: <strong style={{ color: COLORS.text }}>{user?.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString("en-GB") : "—"}</strong></div>
          <div>{t("day_streak")}: <strong style={{ color: COLORS.text }}>🔥 {user?.streak ?? 0} {lang === "jp" ? "日" : "days"}</strong></div>
          <div>{t("xp_earned")}: <strong style={{ color: COLORS.gold }}>⭐ {(user?.xpEarned ?? 0).toLocaleString()}</strong></div>
        </div>
      </Section>

      <Section label={lang === "jp" ? "プライバシーとデータ" : "Privacy & Data"}>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
          {lang === "jp"
            ? "あなたのデータをダウンロードするか、アカウントを完全に削除できます。"
            : "Download a copy of your data or permanently delete your account."}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          <button onClick={exportData} style={{ padding: "9px 18px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
            ↓ {lang === "jp" ? "データをエクスポート" : "Export my data"}
          </button>
          <a href="/privacy" style={{ padding: "9px 18px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer", textDecoration: "none" }}>
            {lang === "jp" ? "プライバシーポリシー" : "Privacy Policy"}
          </a>
        </div>

        <div style={{ background: "rgba(224,16,16,0.04)", border: "1px solid rgba(224,16,16,0.2)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            {lang === "jp" ? "危険ゾーン" : "Danger Zone"}
          </div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 12, lineHeight: 1.6 }}>
            {lang === "jp"
              ? "アカウントを削除すると、すべての学習データ、進捗、ファミリーメンバー情報が完全に消去されます。この操作は取り消せません。"
              : "Deleting your account permanently removes all your learning data, progress, and family profiles. This cannot be undone."}
          </div>

          {deletePhase === "idle" && (
            <button onClick={() => setDeletePhase("confirm")} style={{ padding: "9px 18px", background: "transparent", border: "1px solid rgba(224,16,16,0.4)", borderRadius: 8, color: COLORS.red, fontSize: 13, cursor: "pointer" }}>
              {lang === "jp" ? "アカウントを削除する" : "Delete my account"}
            </button>
          )}

          {deletePhase === "confirm" && (
            <div>
              <div style={{ fontSize: 13, color: "#ff6060", fontWeight: 600, marginBottom: 10 }}>
                {lang === "jp" ? "本当に削除しますか？この操作は元に戻せません。" : "Are you sure? This cannot be undone."}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={deleteAccount} style={{ padding: "9px 20px", background: COLORS.red, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {lang === "jp" ? "はい、削除する" : "Yes, delete everything"}
                </button>
                <button onClick={() => setDeletePhase("idle")} style={{ padding: "9px 18px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
                  {lang === "jp" ? "キャンセル" : "Cancel"}
                </button>
              </div>
            </div>
          )}

          {deletePhase === "deleting" && (
            <div style={{ fontSize: 13, color: COLORS.textMuted }}>{lang === "jp" ? "削除中…" : "Deleting your account…"}</div>
          )}

          {deletePhase === "done" && (
            <div style={{ fontSize: 13, color: "#22c55e" }}>{lang === "jp" ? "削除完了。ありがとうございました。" : "Account deleted. Goodbye."}</div>
          )}

          {deleteError && (
            <div style={{ marginTop: 8, fontSize: 12, color: "#ff6060" }}>{deleteError}</div>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>{label}</div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function ParentShareButton({ user }) {
  const { t }               = useLang();
  const [copied, setCopied] = useState(false);

  async function copyParentLink() {
    const link = `${window.location.origin}/parent/${user?.uid ?? ""}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      prompt("Copy this link for a parent or guardian:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div>
      <div style={{ padding: "10px 14px", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12, color: COLORS.textMuted, fontFamily: "monospace", wordBreak: "break-all", marginBottom: 10 }}>
        {`${window.location.origin}/parent/${user?.uid?.slice(0, 12) ?? "…"}…`}
      </div>
      <button
        onClick={copyParentLink}
        style={{
          padding: "10px 20px", borderRadius: 8, border: `1px solid ${copied ? "#22c55e" : COLORS.red}`,
          background: copied ? "rgba(34,197,94,0.08)" : "transparent",
          color: copied ? "#22c55e" : COLORS.red,
          fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
        }}
      >
        {copied ? t("link_copied") : t("copy_parent_link")}
      </button>
    </div>
  );
}

// ── WEEKLY MISSIONS ────────────────────────────────────────────────────────────

const WEEKLY_MISSIONS = [
  { id: "dinner_english", icon: "🍽️", title: "Dinner English",            titleJp: "ディナーイングリッシュ",   desc: "Say 5 English sentences together at the dinner table.",                       descJp: "夕食の席で5文の英語を一緒に話してみましょう。",              xp: 50 },
  { id: "phonics_song",   icon: "🎵", title: "Phonics Sing-Along",        titleJp: "フォニックスシングアロング", desc: "Parent and child sing one Wondercamp or Phonics song together.",              descJp: "WondercampかPhonicsの歌を親子で一緒に歌いましょう。",       xp: 40 },
  { id: "show_tell",      icon: "⭐", title: "Show Me What You Learned",   titleJp: "今週の発表",               desc: "Child teaches parent 3 English words they learned this week.",              descJp: "今週学んだ英語を3つ、子どもが親に教えてあげましょう。",      xp: 60 },
  { id: "speak_move",     icon: "🏃", title: "Speak & Move",               titleJp: "スピーク＆ムーブ",         desc: "Do 3 physical movements and say the English word out loud each time.",       descJp: "体を3つ動かして、そのたびに英語で大きな声で言いましょう。",  xp: 45 },
  { id: "eiken_check",    icon: "📝", title: "EIKEN Confidence Check",     titleJp: "英検チャレンジ",           desc: "Try one EIKEN speaking question together. Encouragement from parents counts!", descJp: "英検のスピーキング問題を一緒にチャレンジ。親の応援が力になります！", xp: 55 },
];

// ── HOME: CHILD PATH CARD ──────────────────────────────────────────────────────

function HomeChildCard({ user, members, activeMember, setActiveMember, onAppClick, isUnlocked }) {
  const { lang } = useLang();
  const navigate  = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName]           = useState("");
  const [newAge, setNewAge]             = useState("");
  const [saving, setSaving]             = useState(false);

  async function deleteMember(id) {
    try {
      await deleteDoc(doc(db, "users", user.uid, "familyMembers", id));
      if (activeMember?.id === id) setActiveMember(null);
    } catch (e) { console.error("Delete member:", e); }
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  function getPrimaryApp(member) {
    const subs = user?.subscriptions ?? [];
    const hasApp = (id) => isUnlocked(id);
    const age = member?.age ?? 10;
    if (age < 8) {
      if (hasApp("wondercamp")) return APPS.find(a => a.id === "wondercamp");
      if (hasApp("phonics"))    return APPS.find(a => a.id === "phonics");
    }
    if (age < 13) {
      if (hasApp("phonics"))    return APPS.find(a => a.id === "phonics");
      if (hasApp("eiken"))      return APPS.find(a => a.id === "eiken");
    }
    if (hasApp("eiken"))        return APPS.find(a => a.id === "eiken");
    if (hasApp("speak"))        return APPS.find(a => a.id === "speak");
    return null;
  }

  const activeProfile = activeMember;
  const primaryApp    = getPrimaryApp(activeProfile);
  const activeName    = activeProfile ? activeProfile.name : firstName;

  async function addMember() {
    if (!newName.trim() || saving) return;
    if (familyMembers.length >= 5) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "familyMembers"), {
        name: newName.trim(), age: newAge ? parseInt(newAge, 10) : null,
        confidenceScore: 0, cefr: null, assessmentDone: false,
        createdAt: serverTimestamp(),
      });
      setNewName(""); setNewAge(""); setShowAddModal(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <>
      <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
          {lang === "jp" ? "ファミリー" : "MY FAMILY"}
        </div>

        {/* Profile switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveMember(null)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 40, background: !activeMember ? COLORS.red : "transparent", border: `1px solid ${!activeMember ? COLORS.red : "#2a2a2a"}`, color: !activeMember ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
          >
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: !activeMember ? "rgba(255,255,255,0.2)" : "#1e1e1e", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
              {firstName?.[0]?.toUpperCase()}
            </span>
            {firstName}
          </button>

          {members.map(m => (
            <div key={m.id} style={{ position: "relative", display: "inline-flex" }}>
              <button
                onClick={() => setActiveMember(activeMember?.id === m.id ? null : m)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 40, background: activeMember?.id === m.id ? COLORS.red : "transparent", border: `1px solid ${activeMember?.id === m.id ? COLORS.red : "#2a2a2a"}`, color: activeMember?.id === m.id ? "#fff" : COLORS.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
              >
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: activeMember?.id === m.id ? "rgba(255,255,255,0.2)" : "#1e1e1e", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                  {m.name?.[0]?.toUpperCase()}
                </span>
                {m.name}{m.age ? <span style={{ fontSize: 10, opacity: 0.7 }}>· {m.age}</span> : null}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteMember(m.id); }}
                title="Remove"
                style={{ position: "absolute", top: -5, right: -5, width: 16, height: 16, borderRadius: "50%", background: "#222", border: "1px solid #444", color: "#aaa", fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1, zIndex: 1 }}
              >×</button>
            </div>
          ))}

          <button
            onClick={() => setShowAddModal(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 40, background: "transparent", border: "1px dashed #2a2a2a", color: COLORS.textDim, fontSize: 12, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.color = COLORS.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = COLORS.textDim; }}
          >
            + {lang === "jp" ? "子を追加" : "Add child"}
          </button>
        </div>

        {/* Active profile: lesson launcher */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "16px 0", borderTop: "1px solid #1e1e1e" }}>
          {primaryApp ? (
            <>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>
                  {lang === "jp" ? `${activeName}の今日のレッスン` : `${activeName}'s lesson today`}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{primaryApp.name}</div>
                <button
                  onClick={() => onAppClick(primaryApp)}
                  style={{ padding: "12px 28px", background: COLORS.red, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 20px rgba(224,16,16,0.35)", transition: "transform 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  ▶ {lang === "jp" ? "始める" : "Start Learning"}
                </button>
              </div>
              {primaryApp.image && (
                <img src={primaryApp.image} alt={primaryApp.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", flexShrink: 0, opacity: 0.9 }} />
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                {activeProfile ? (
                  <StatPill icon="📊" value={`${activeProfile.confidenceScore ?? 0}%`} label={lang === "jp" ? "自信" : "Confidence"} />
                ) : (
                  <>
                    <StatPill icon="🔥" value={user?.streak ?? 0} label={lang === "jp" ? "連続" : "Streak"} />
                    <StatPill icon="📊" value={`${user?.confidenceScore ?? 0}%`} label={lang === "jp" ? "自信" : "Score"} />
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
                {activeProfile
                  ? (lang === "jp" ? `${activeName}のアプリを選びましょう` : `Choose an app for ${activeName}`)
                  : (lang === "jp" ? "プランを選んで始めましょう" : "Choose a plan to start learning")}
              </div>
              <button
                onClick={() => navigate("/plans")}
                style={{ padding: "10px 20px", background: "transparent", border: `1px solid ${COLORS.red}`, borderRadius: 8, color: COLORS.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                {lang === "jp" ? "プランを見る" : "Browse Plans →"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowAddModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 28, width: 340, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{lang === "jp" ? "子どものプロフィールを追加" : "Add a Child Profile"}</div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>{lang === "jp" ? "名前 *" : "Name *"}</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Yuki" autoFocus style={{ width: "100%", padding: "10px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>{lang === "jp" ? "年齢（任意）" : "Age (optional)"}</label>
              <input value={newAge} onChange={e => setNewAge(e.target.value)} placeholder="e.g. 5" type="number" min="1" max="18" style={{ width: "100%", padding: "10px 12px", background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.text, fontSize: 14, outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: "9px 16px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 8, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>{lang === "jp" ? "キャンセル" : "Cancel"}</button>
              <button onClick={addMember} disabled={!newName.trim() || saving} style={{ padding: "9px 20px", background: newName.trim() ? COLORS.red : "#333", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, cursor: newName.trim() ? "pointer" : "not-allowed" }}>
                {saving ? (lang === "jp" ? "追加中…" : "Adding…") : (lang === "jp" ? "子を追加" : "Add Child")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatPill({ icon, value, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "6px 10px" }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.red }}>{value}</span>
      <span style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</span>
    </div>
  );
}

// ── HOME: FAMILY MISSION CARD ─────────────────────────────────────────────────

function FamilyMissionCard({ user }) {
  const { lang } = useLang();
  const [done, setDone]     = useState(false);
  const [saving, setSaving] = useState(false);

  const weekNum    = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  const mission    = WEEKLY_MISSIONS[weekNum % WEEKLY_MISSIONS.length];
  const missionKey = `family_w${weekNum}`;

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid, "missions", missionKey)).then(snap => {
      if (snap.exists() && snap.data().done) setDone(true);
    }).catch(() => {});
  }, [user?.uid, missionKey]);

  async function completeMission() {
    if (!user?.uid || done || saving) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid, "missions", missionKey), { done: true, completedAt: serverTimestamp(), missionId: mission.id }, { merge: true });
      await awardXP(user.uid, mission.xp);
      setDone(true);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 14 }}>
        {lang === "jp" ? "今週のファミリーミッション" : "THIS WEEK'S FAMILY MISSION"}
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ fontSize: 36, flexShrink: 0, lineHeight: 1 }}>{mission.icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            {lang === "jp" ? mission.titleJp : mission.title}
          </div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 14 }}>
            {lang === "jp" ? (mission.descJp ?? mission.desc) : mission.desc}
          </div>
          {done ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.success, fontSize: 13, fontWeight: 700 }}>
              ✓ {lang === "jp" ? "完了！" : "Completed!"} <span style={{ fontSize: 11, fontWeight: 400, color: COLORS.textMuted }}>+{mission.xp} XP</span>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                onClick={completeMission}
                disabled={saving}
                style={{ padding: "10px 20px", background: "transparent", border: "1px solid rgba(34,197,94,0.5)", borderRadius: 8, color: "#22c55e", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(34,197,94,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                {saving ? "…" : (lang === "jp" ? "✓ 完了する" : "✓ Mark as Done")}
              </button>
              <span style={{ fontSize: 12, color: COLORS.textDim }}>+{mission.xp} XP</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HOME: PARENT REPORT CARD ──────────────────────────────────────────────────

function ParentReportCard({ user, activeMember }) {
  const { lang } = useLang();
  const navigate  = useNavigate();

  const profile = activeMember ?? user;
  const name    = activeMember ? activeMember.name : (user?.name?.split(" ")[0] ?? "You");
  const isChild = !!activeMember;

  const confidence  = profile?.confidenceScore ?? 0;
  const streak      = isChild ? (profile?.streak ?? 0)           : (user?.streak ?? 0);
  const lessons     = isChild ? (profile?.lessonsCompleted ?? 0) : (user?.lessonsCompleted ?? 0);
  const hours       = isChild ? (profile?.hoursLearned ?? 0)     : (user?.hoursLearned ?? 0);
  const xp          = isChild ? (profile?.xpEarned ?? 0)         : (user?.xpEarned ?? 0);
  const cefr        = profile?.cefr ?? null;

  const ringSize = 72;
  const radius   = (ringSize - 8) / 2;
  const circ     = 2 * Math.PI * radius;
  const filled   = circ * (confidence / 100);

  function copyShareLink() {
    const link = `${window.location.origin}/parent/${user?.uid ?? ""}`;
    navigator.clipboard.writeText(link).catch(() => {});
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>
          {isChild
            ? (lang === "jp" ? `${name}の進捗レポート` : `${name}'s Progress Report`)
            : (lang === "jp" ? "あなたの進捗" : "Your Progress")}
        </div>
        <button
          onClick={copyShareLink}
          style={{ fontSize: 11, padding: "5px 12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.color = COLORS.red; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = COLORS.textMuted; }}
        >
          {lang === "jp" ? "リンクをコピー" : "Share Report"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        {/* Confidence ring */}
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          <svg width={ringSize} height={ringSize} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="#1e1e1e" strokeWidth={8} />
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={COLORS.red} strokeWidth={8}
              strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round"
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          </svg>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.red, marginTop: -58, position: "relative", lineHeight: `${ringSize}px` }}>
            {confidence}%
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>
            {lang === "jp" ? "自信スコア" : "Confidence"}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { icon: "🔥", value: streak,                        label: lang === "jp" ? "連続日数" : "Day streak"     },
            { icon: "✅", value: lessons,                       label: lang === "jp" ? "レッスン完了" : "Lessons done" },
            { icon: "⏰", value: `${hours}h`,                   label: lang === "jp" ? "学習時間" : "Hours learned"  },
            { icon: "⭐", value: xp.toLocaleString(),            label: lang === "jp" ? "ポイント" : "XP earned"      },
          ].map(s => (
            <div key={s.label} style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 4 }}>{s.icon} {s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Level badges + view full report */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {cefr ? (() => {
            const meta  = CEFR_META[cefr];
            const color = meta?.color ?? COLORS.red;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ textAlign: "center", background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 8, padding: "6px 14px" }}>
                  <div style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 1 }}>CEFR</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color }}>{cefr}</div>
                </div>
                <div style={{ textAlign: "center", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "5px 10px" }}>
                  <div style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 1 }}>英検</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color }}>{lang === "jp" ? meta?.eiken : meta?.eikenEn}</div>
                </div>
                <div style={{ textAlign: "center", background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "5px 10px" }}>
                  <div style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 1 }}>TOEIC</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color }}>{meta?.toeic}</div>
                </div>
              </div>
            );
          })() : (
            <div style={{ textAlign: "center", background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: COLORS.textDim, marginBottom: 2 }}>CEFR · 英検 · TOEIC</div>
              <div style={{ fontSize: 13, color: COLORS.textDim }}>—</div>
            </div>
          )}
          <button
            onClick={() => navigate(`/parent/${user?.uid ?? ""}`)}
            style={{ fontSize: 11, padding: "6px 12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.color = COLORS.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.color = COLORS.textMuted; }}
          >
            {lang === "jp" ? "全レポートを見る" : "Full report →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ACCESS CODE CARD ──────────────────────────────────────────────────────────

function AccessCodeCard({ user, navigate }) {
  const pass   = user?.accessPass;
  const active = pass && isAccessActive(pass);

  if (active) {
    const remaining = pass.aiCreditsRemaining ?? 0;
    const days      = daysUntilExpiry(pass.expiresAt);
    const isLow     = remaining > 0 && remaining <= 5;
    const isUsedUp  = remaining === 0;
    const accent    = isUsedUp ? "#e01010" : isLow ? "#f59e0b" : "#2ec4b6";
    return (
      <div style={{ background: COLORS.card, border: `1px solid ${accent}33`, borderRadius: 16, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
              Free Month Access Pass
            </div>
            <div style={{ fontSize: 10, color: COLORS.textDim }}>
              Expires {formatExpiry(pass.expiresAt)} · {days} day{days !== 1 ? "s" : ""} left
            </div>
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: `${accent}18`, border: `1px solid ${accent}44`, borderRadius: 20, padding: "3px 10px" }}>
            ACTIVE
          </span>
        </div>

        {/* Credit bar */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
            <span style={{ color: COLORS.textMuted }}>AI Practice Credits</span>
            <span style={{ color: accent, fontWeight: 700 }}>{remaining} / {pass.aiCreditsGranted ?? 30} remaining</span>
          </div>
          <div style={{ height: 5, background: "#1a1a1a", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${((remaining) / (pass.aiCreditsGranted ?? 30)) * 100}%`, background: accent, borderRadius: 3, transition: "width 0.4s" }} />
          </div>
        </div>

        {isLow && (
          <p style={{ fontSize: 12, color: "#f59e0b", margin: "8px 0 0" }}>
            {remaining} credit{remaining !== 1 ? "s" : ""} remaining — use them for your most important practice.
          </p>
        )}
        {isUsedUp && (
          <p style={{ fontSize: 12, color: "#e01010", margin: "8px 0 10px" }}>
            AI credits used up. You can still access all materials and tools until your month ends.
          </p>
        )}
        {!isUsedUp && (
          <button
            onClick={() => navigate("/access-code")}
            style={{ marginTop: 10, padding: "7px 16px", borderRadius: 8, background: "none", border: `1px solid ${accent}44`, color: accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            View Pass Details
          </button>
        )}
        {isUsedUp && (
          <button
            onClick={() => navigate("/plans")}
            style={{ marginTop: 10, padding: "7px 16px", borderRadius: 8, background: "#2ec4b6", border: "none", color: "#0a1a1a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Upgrade for More AI Practice →
          </button>
        )}
      </div>
    );
  }

  // No active pass — show CTA card
  return (
    <div style={{ background: COLORS.card, border: "1px solid rgba(46,196,182,0.2)", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>Access Code</div>
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 2 }}>Unlock your free month.</div>
        <div style={{ fontSize: 11, color: COLORS.textDim, lineHeight: 1.5 }}>
          1 month full HSDOS.AI platform access + 30 AI practice credits
        </div>
      </div>
      <button
        onClick={() => navigate("/access-code")}
        style={{ padding: "10px 20px", borderRadius: 10, background: "#2ec4b6", border: "none", color: "#0a1a1a", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
      >
        Enter Access Code
      </button>
    </div>
  );
}

/* ── Payment Success Modal ────────────────────────────────────────────────────
   Shown when Stripe redirects back with ?payment=success
────────────────────────────────────────────────────────────────────────────── */
function PaymentSuccessModal({ planName, user, onDismiss, onManage }) {
  const { lang } = useLang();
  const jp       = lang === "jp";
  const GOLD     = "#C9A84C";
  const isFoundingMember = user?.isFoundingMember;

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    const id = setTimeout(onDismiss, 12000);
    return () => clearTimeout(id);
  }, [onDismiss]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 600,
        background: "rgba(0,0,0,0.88)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onDismiss}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "linear-gradient(135deg, #0d0d0d 0%, #0a1200 100%)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderTop: "3px solid #22c55e",
          borderRadius: 20,
          padding: "36px 32px",
          maxWidth: 440, width: "100%",
          boxShadow: "0 0 80px rgba(34,197,94,0.1)",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onDismiss}
          style={{
            position: "absolute", top: 14, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "#555", fontSize: 20, lineHeight: 1,
          }}
        >×</button>

        {/* Icon */}
        <div style={{ fontSize: 52, marginBottom: 16, lineHeight: 1 }}>🎉</div>

        {/* Heading */}
        <div style={{ fontSize: 24, fontWeight: 900, color: "#22c55e", marginBottom: 8, lineHeight: 1.1 }}>
          {jp ? "ありがとうございます！" : "You're in!"}
        </div>

        {/* Plan name */}
        {planName && (
          <div style={{ fontSize: 14, color: "#888", marginBottom: 16 }}>
            {jp ? `${planName}プラン — 開始しました` : `${planName} plan — active now`}
          </div>
        )}

        {/* Founding member callout */}
        {isFoundingMember && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(201,168,76,0.08)",
            border: `1px solid ${GOLD}44`,
            borderRadius: 20, padding: "8px 16px",
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 16 }}>🏅</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>
              {jp
                ? `創設メンバー #${user.foundingMemberNumber} — 15%割引が永久に適用されます`
                : `Founding Member #${user.foundingMemberNumber} — 15% off locked forever`}
            </span>
          </div>
        )}

        {/* Body */}
        <p style={{ fontSize: 14, color: "#999", lineHeight: 1.65, margin: "0 0 28px" }}>
          {jp
            ? "すべてのアプリとAIコーチングが解放されました。今日のミッションを始めましょう。"
            : "All your apps and AI coaching sessions are ready. Start your first mission today."}
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={onDismiss}
            style={{
              flex: 1, minWidth: 140,
              padding: "13px 20px",
              background: "#22c55e", border: "none",
              borderRadius: 12, color: "#0a0a0a",
              fontSize: 14, fontWeight: 800,
              cursor: "pointer",
            }}
          >
            {jp ? "始める →" : "Start learning →"}
          </button>
          <button
            onClick={onManage}
            style={{
              flex: 1, minWidth: 140,
              padding: "13px 20px",
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: 12, color: "#666",
              fontSize: 14, fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {jp ? "プランを確認" : "View subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}
