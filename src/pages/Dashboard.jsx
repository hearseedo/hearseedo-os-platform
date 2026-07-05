import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { COLORS } from "../constants/colors";
import { NAV_ITEMS } from "../constants/nav";
import { logout, awardXP } from "../lib/firebase";
import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, addDoc, deleteDoc, onSnapshot, orderBy, query } from "firebase/firestore";
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
import { useLang } from "../hooks/useLang";

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
  const [showPulse, setShowPulse]     = useState(false);
  const [pulseTrigger, setPulseTrigger] = useState("general");
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user?.uid || isAdmin) return;
    const q = query(collection(db, "users", user.uid, "notifications"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user?.uid, isAdmin]);

  const unreadNotif = notifications.find(n => !n.read);

  const dismissNotification = async (id) => {
    await updateDoc(doc(db, "users", user.uid, "notifications", id), { read: true }).catch(() => {});
  };

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

  // Redirect new users to setup — skip if already set up, has any subscription, or is admin
  useEffect(() => {
    if (!profileReady) return;
    const hasSub      = (user?.subscriptions ?? []).length > 0;
    const alreadySetup = user?.assessmentDone || user?.setupDone || hasSub || isAdmin;
    if (user && !alreadySetup && !location.state?.assessmentJustDone) {
      navigate("/setup");
    }
  }, [user, profileReady, isAdmin, navigate, location.state]);

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

  if (isMobile) {
    return (
      <>
        <WarmUp />
        {showWelcome && profileReady && (
          <WelcomeSequence user={user} onComplete={() => { sessionStorage.setItem("hsd_welcome_shown", "1"); setShowWelcome(false); }} />
        )}
        <MobileDashboard
          user={user} firstName={firstName} greeting={greeting}
          activeNav={activeNav} setActiveNav={setActiveNav}
          setSelectedApp={setSelectedApp} navigate={navigate} isUnlocked={isUnlocked}
        />
        <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} />
        {showPulse && <PulseFeedback trigger={pulseTrigger} onDismiss={() => setShowPulse(false)} />}
        {unreadNotif && <ContributorBanner notification={unreadNotif} onDismiss={dismissNotification} />}
      </>
    );
  }

  return (
    <>
      <WarmUp />
      {showWelcome && profileReady && (
        <WelcomeSequence user={user} onComplete={() => { sessionStorage.setItem("hsd_welcome_shown", "1"); setShowWelcome(false); }} />
      )}
      {showPulse && <PulseFeedback trigger={pulseTrigger} onDismiss={() => setShowPulse(false)} />}
      {unreadNotif && <ContributorBanner notification={unreadNotif} onDismiss={dismissNotification} />}

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
            <NotificationBell count={0} />
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
              <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                <BackBar title="My Family" onBack={() => setActiveNav("home")} />
                <FamilyCard user={user} members={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember} />
              </div>
            ) : activeNav === "progress" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                  <BackBar title="Progress" onBack={() => setActiveNav("home")} />
                  <LearningPath user={user} pathPrefix={activeMember ? `users/${user.uid}/familyMembers/${activeMember.id}` : null} member={activeMember ?? null} />
                </div>
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24 }}>
                  <Achievements user={user} />
                </div>
              </div>
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
                <HomeChildCard user={user} members={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember} onAppClick={setSelectedApp} isUnlocked={isUnlocked} />
                <FamilyMissionCard user={user} />
                <ParentReportCard user={user} activeMember={activeMember} />
                <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 16, padding: 24, position: "relative", overflow: "hidden" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>{t("your_apps")}</div>
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "radial-gradient(circle at 50% 50%, rgba(224,16,16,0.04) 0%, transparent 70%)" }} />
                  <AppOrbit view={orbitView} onViewChange={setOrbitView} onAppClick={setSelectedApp} activeMember={activeMember} />
                </div>
              </>
            )}
          </main>

          {/* RIGHT PANEL */}
          <aside style={{ width: 280, background: COLORS.surface, borderLeft: "1px solid #1e1e1e", padding: 16, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", flexShrink: 0 }}>
            <CoachingCard user={user} />
            <ProgressJourney user={user} />
            <Leaderboard currentUid={user?.uid} />
            <MissionsCard user={user} />
            <RecommendationsCard user={user} />
            <ConfidenceCard user={user} activeMember={activeMember} />
            <WorkbookCodeCard user={user} />
            <ProgressCard user={user} />
            <FamilyCard user={user} members={familyMembers} activeMember={activeMember} setActiveMember={setActiveMember} />
          </aside>
        </div>
      </div>

      <AppModal app={selectedApp} onClose={() => setSelectedApp(null)} user={user} />
    </>
  );
}

// ── MOBILE DASHBOARD ──────────────────────────────────────────────────────────

function MobileDashboard({ user, firstName, greeting, activeNav, setActiveNav, setSelectedApp, navigate, isUnlocked }) {
  const { lang, setLang, t } = useLang();
  const BOTTOM_NAV = [
    { id: "home",     icon: "🏠", label: t("home")  },
    { id: "apps",     icon: "⚡", label: t("apps")  },
    { id: "learning", icon: "🗺️", label: t("path")  },
    { id: "coach",    icon: "🤖", label: t("coach") },
    { id: "settings", icon: "⚙️", label: t("more")  },
  ];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, display: "flex", flexDirection: "column", fontFamily: "system-ui, sans-serif" }}>

      {/* Mobile Header */}
      <header style={{
        height: 56, background: COLORS.surface,
        borderBottom: "1px solid #1e1e1e",
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
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.red }}>🔥 {user?.streak ?? 0}</div>
            <div style={{ fontSize: 9, color: COLORS.textMuted }}>Streak</div>
          </div>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, #8b0000, #e01010)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, border: "2px solid #e01010" }}>
            {firstName?.[0]?.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Mobile Content */}
      <main style={{ flex: 1, overflowY: "auto", paddingBottom: 80 }}>

        {activeNav === "home" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Stats row */}
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { icon: "🔥", value: user?.streak ?? 0,                       label: t("day_streak")  },
                { icon: "⭐", value: (user?.xpEarned ?? 0).toLocaleString(),  label: t("hsd_points")  },
                { icon: "✅", value: user?.lessonsCompleted ?? 0,              label: t("lessons_done")},
              ].map((s) => (
                <div key={s.label} style={{ flex: 1, background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.red }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: COLORS.textMuted }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Daily Missions */}
            <MissionsCard user={user} />

            {/* Quick app grid */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>{t("my_apps")}</div>
              <MobileAppGrid onAppClick={setSelectedApp} isUnlocked={isUnlocked} />
            </div>

            {/* AI Chat */}
            <AIChat />
          </div>
        )}

        {activeNav === "apps" && (
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>{t("all_apps")}</div>
            <MobileAppGrid onAppClick={setSelectedApp} isUnlocked={isUnlocked} showAll />
          </div>
        )}

        {activeNav === "learning" && (
          <div style={{ padding: 16 }}>
            <LearningPath user={user} />
          </div>
        )}

        {activeNav === "coach" && (
          <div style={{ padding: 16 }}>
            <AICoach user={user} />
          </div>
        )}

        {activeNav === "settings" && (
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{t("more")}</div>

            {[
              { id: "subscriptions", icon: "📱", label: t("my_subscriptions") },
              { id: "achievements",  icon: "🏆", label: t("nav_achievements")  },
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

            <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7 }}>
                <div>Plan: <strong style={{ color: COLORS.text }}>{user?.plan ?? "Free"}</strong></div>
                <div>Streak: <strong style={{ color: COLORS.text }}>🔥 {user?.streak ?? 0} days</strong></div>
                <div>Total XP: <strong style={{ color: COLORS.gold }}>⭐ {(user?.xpEarned ?? 0).toLocaleString()}</strong></div>
              </div>
            </div>

            {/* Language toggle — mobile */}
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
      </main>

      {/* Bottom Navigation */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        height: 64, background: COLORS.surface,
        borderTop: "1px solid #1e1e1e",
        display: "flex", alignItems: "center",
        zIndex: 100,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}>
        {BOTTOM_NAV.map((item) => {
          const active = activeNav === item.id || (item.id === "settings" && ["subscriptions","achievements","events"].includes(activeNav));
          return (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 4, background: "none", border: "none", cursor: "pointer",
                color: active ? COLORS.red : COLORS.textMuted,
                padding: "8px 0",
              }}
            >
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 400 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function MobileAppGrid({ onAppClick, isUnlocked, showAll = false }) {
  const apps = showAll ? APPS : APPS.slice(0, 6);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {apps.map((app) => {
        const unlocked = isUnlocked(app.id);
        return (
          <button
            key={app.id}
            onClick={() => onAppClick(app)}
            style={{
              background: COLORS.card, border: `1px solid ${unlocked ? app.accent + "44" : "#1e1e1e"}`,
              borderRadius: 16, padding: 16, cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
              textAlign: "left", position: "relative", overflow: "hidden",
              boxShadow: unlocked ? `0 0 16px ${app.accent}22` : "none",
            }}
          >
            {app.free && (
              <span style={{ position: "absolute", top: 8, right: 8, fontSize: 8, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "2px 5px", letterSpacing: 1 }}>FREE</span>
            )}
            {!unlocked && !app.free && (
              <span style={{ position: "absolute", top: 8, right: 8, fontSize: 14 }}>🔒</span>
            )}
            {app.image
              ? <img src={app.image} alt={app.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", filter: unlocked ? "none" : "grayscale(1) opacity(0.5)" }} />
              : <span style={{ fontSize: 32 }}>{app.icon}</span>
            }
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: unlocked ? COLORS.text : COLORS.textMuted, lineHeight: 1.3 }}>{app.name}</div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2, lineHeight: 1.4 }}>{app.desc}</div>
            </div>
          </button>
        );
      })}
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

function ContributorBanner({ notification, onDismiss }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 200,
      background: "linear-gradient(135deg, #010e12, #021a22)",
      borderBottom: "1px solid rgba(6,182,212,0.3)",
      padding: "14px 20px",
      display: "flex", alignItems: "flex-start", gap: 14,
      boxShadow: "0 4px 30px rgba(6,182,212,0.15)",
      animation: "cBannerIn 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
    }}>
      <style>{`@keyframes cBannerIn{from{transform:translateY(-100%)}to{transform:translateY(0)}}`}</style>
      <div style={{ fontSize: 26, flexShrink: 0 }}>💌</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
          Message from Jonathan
        </div>
        <div style={{ fontSize: 14, color: "#e0e0e0", lineHeight: 1.6 }}>
          {notification.message}
        </div>
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        style={{
          flexShrink: 0, background: "rgba(6,182,212,0.15)",
          border: "1px solid rgba(6,182,212,0.4)", borderRadius: 8,
          color: "#06b6d4", fontSize: 12, fontWeight: 700,
          padding: "6px 14px", cursor: "pointer",
        }}
      >
        ✓ Got it
      </button>
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

function MissionsCard({ user }) {
  const { t }    = useLang();
  const todayJST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  const [missions, setMissions] = useState(null);
  const [completing, setCompleting] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        setMissions(snap.data().missions);
      } else {
        const initial = DAILY_MISSIONS.map(m => ({ ...m, label: m.labelKey, current: 0, done: false }));
        setMissions(initial);
        setDoc(ref, { missions: initial, date: todayJST, createdAt: serverTimestamp() }).catch(() => {});
      }
    }).catch(() => {
      setMissions(DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false })));
    });
  }, [user?.uid]);

  async function completeMission(idx) {
    if (!user?.uid || missions[idx].done) return;
    setCompleting(idx);
    const updated = missions.map((m, i) => i === idx ? { ...m, current: m.total, done: true } : m);
    setMissions(updated);
    const ref = doc(db, "users", user.uid, "missions", todayJST);
    await setDoc(ref, { missions: updated, date: todayJST }, { merge: true });
    await awardXP(user.uid, missions[idx].xp);
    setCompleting(null);
  }

  const display = (missions ?? DAILY_MISSIONS.map(m => ({ ...m, current: 0, done: false }))).map(m => ({ ...m, label: t(m.labelKey) }));
  const streakMission = display.find(m => m.id === "streak");
  if (streakMission && !streakMission.done && (user?.streak ?? 0) > 0) {
    // Auto-complete streak mission if user has a streak
    const idx = display.findIndex(m => m.id === "streak");
    if (idx >= 0 && !display[idx].done && missions) {
      completeMission(idx);
    }
  }

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>{t("todays_missions")}</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {display.map((m, i) => (
          <div key={m.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ fontSize: 12, color: m.done ? COLORS.success : COLORS.text, textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
              </div>
              {m.done
                ? <span style={{ fontSize: 10, color: COLORS.success, fontWeight: 700 }}>+{m.xp} XP ✓</span>
                : <button onClick={() => completeMission(i)} disabled={completing === i} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: "transparent", border: `1px solid #2a2a2a`, color: COLORS.textMuted, cursor: "pointer" }}>
                    {completing === i ? "…" : t("mission_done")}
                  </button>
              }
            </div>
            <ProgressBar current={m.done ? m.total : m.current} total={m.total} color={m.done ? COLORS.success : COLORS.red} />
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

function CoachingCard({ user }) {
  const [card, setCard]       = useState(null);
  const [loading, setLoading] = useState(true);
  const { lang }              = useLang();
  const jp                    = lang === "jp";

  useEffect(() => {
    if (!user?.uid) return;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

    getDoc(doc(db, "users", user.uid, "coachingCards", today)).then(async snap => {
      const cached = snap.exists() ? snap.data() : null;
      // Require focus_jp to contain actual Japanese characters — guards against
      // stale cache entries where focus_jp accidentally stored English text.
      const hasJP = (s) => s && /[぀-ゟ゠-ヿ一-鿿]/.test(s);
      if (cached?.focus && hasJP(cached?.focus_jp)) {
        setCard(cached);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/coaching-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
          // Only persist when bilingual — so incomplete cards re-fetch next time
          if (hasJP(data.focus_jp)) {
            setDoc(doc(db, "users", user.uid, "coachingCards", today), {
              ...data, generatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      } catch {
        // Fail silently — card just won't show
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.uid]);

  if (loading) return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14 }}>🧠</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", letterSpacing: 2, textTransform: "uppercase" }}>Daily Coach</span>
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
      <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%", background: "rgba(6,182,212,0.06)", pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15 }}>🧠</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", letterSpacing: 2, textTransform: "uppercase" }}>
          {jp ? "デイリーコーチ" : "Daily Coach"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#06b6d433", fontStyle: "italic" }}>
          {new Date().toLocaleDateString(jp ? "ja-JP" : "en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "Asia/Tokyo" })}
        </span>
      </div>

      {/* Focus */}
      <div style={{ marginBottom: 10, padding: "6px 10px", background: "rgba(6,182,212,0.1)", borderRadius: 8, border: "1px solid rgba(6,182,212,0.2)" }}>
        <div style={{ fontSize: 9, color: "#06b6d4", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>
          {jp ? "今日のフォーカス" : "Today's Focus"}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#e0f7fa" }}>
          {jp ? (card.focus_jp || card.focus) : card.focus}
        </div>
      </div>

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
  const { t } = useLang();
  const [showModal, setShowModal]     = useState(false);
  const [newName, setNewName]         = useState("");
  const [newAge, setNewAge]           = useState("");
  const [saving, setSaving]           = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // member id armed for delete

  async function addMember() {
    if (!newName.trim() || saving) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", user.uid, "familyMembers"), {
        name:           newName.trim(),
        age:            newAge ? parseInt(newAge, 10) : null,
        confidenceScore: 0,
        cefr:           null,
        assessmentDone: false,
        createdAt:      serverTimestamp(),
      });
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
    } catch (err) {
      console.error("Delete member error:", err);
    }
    setConfirmDelete(null);
  }

  return (
    <>
      <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
        <SectionTitle>{t("family_progress")}</SectionTitle>
        {members.length === 0 ? (
          <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", padding: "12px 0" }}>{t("no_family")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  background: activeMember?.id === m.id ? "rgba(224,16,16,0.12)" : "transparent",
                  border: activeMember?.id === m.id ? "1px solid rgba(224,16,16,0.4)" : "1px solid transparent",
                  borderRadius: 8, padding: "8px 10px", transition: "all 0.15s",
                }}
              >
                {/* Clickable area — switches active member */}
                <div
                  onClick={() => { setActiveMember(activeMember?.id === m.id ? null : m); setConfirmDelete(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer", minWidth: 0 }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#4a0000,#e01010)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {m.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>
                      {m.cefr
                        ? <><span style={{ color: CEFR_META[m.cefr]?.color ?? COLORS.textMuted }}>{m.cefr}</span>{" · "}{lang === "jp" ? (CEFR_META[m.cefr]?.eiken ?? "") : (CEFR_META[m.cefr]?.eikenEn ?? "")}{" · TOEIC "}{CEFR_META[m.cefr]?.toeic ?? ""}</>
                        : t("no_assessment")}
                      {m.age ? ` · ${t("age_label")} ${m.age}` : ""}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted }}>{m.confidenceScore ?? 0}%</div>
                </div>

                {/* Delete button */}
                {confirmDelete === m.id ? (
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    <button
                      onClick={() => deleteMember(m.id)}
                      style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: COLORS.red, border: "none", color: "#fff", cursor: "pointer" }}
                    >
                      {t("remove")}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      style={{ fontSize: 10, padding: "3px 8px", borderRadius: 5, background: "transparent", border: "1px solid #333", color: COLORS.textMuted, cursor: "pointer" }}
                    >
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
            ))}
          </div>
        )}
        <button
          onClick={() => setShowModal(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: COLORS.red, fontSize: 12, cursor: "pointer", padding: "10px 0 0" }}
        >
          + {t("add_family")}
        </button>
      </div>

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
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>{t("name_required")}</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Yuki"
                autoFocus
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

  // Don't render anything if user already has phonics via a paid plan
  if ((user?.subscriptions ?? []).includes("phonics") && !redeemed) return null;

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      <SectionTitle>🎒 {lang === "jp" ? "ワークブック特典コード" : "Workbook Bonus Code"}</SectionTitle>

      {/* Active trial */}
      {active && (
        <div>
          <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 700, marginBottom: 6 }}>
            ✓ {lang === "jp" ? "Monkey Yoga Phonics 1ヶ月無料アクセス中" : "Monkey Yoga Phonics — Free Month Active"}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8 }}>
            {lang === "jp" ? `有効期限: ${endDate}` : `Access until: ${endDate}`}
          </div>
          {daysLeft <= 7 && (
            <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#f59e0b", marginBottom: 8 }}>
              ⚠️ {lang === "jp" ? `残り${daysLeft}日です。プランを選択して続けましょう。` : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining. Choose a plan to keep your access.`}
            </div>
          )}
        </div>
      )}

      {/* Expired */}
      {expired && (
        <div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
            {lang === "jp" ? "無料体験期間が終了しました。" : "Your free month has ended."}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.6 }}>
            {lang === "jp"
              ? "引き続きご利用いただくには、プランをお選びください。まだファウンダー枠がある場合は、生涯15%割引のConfidence Founderになれます。"
              : "Choose a paid plan to continue. If Founder spots are still open, you can become a Confidence Founder and save 15% for life."}
          </div>
          <a href="https://hsdos.ai/pricing" target="_blank" rel="noreferrer"
            style={{ display: "block", padding: "10px", background: COLORS.red, borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 700, textAlign: "center", textDecoration: "none", marginBottom: 6 }}>
            {lang === "jp" ? "プランを見る" : "View Plans"}
          </a>
        </div>
      )}

      {/* Success flash */}
      {success && (
        <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#22c55e", lineHeight: 1.6 }}>
          {lang === "jp"
            ? "ワークブック特典が有効になりました。Monkey Yoga Phonics アプリを1ヶ月無料でご利用いただけます。"
            : "Your workbook bonus has been activated. You now have 1 free month of Monkey Yoga Phonics app access."}
        </div>
      )}

      {/* Not yet redeemed */}
      {!redeemed && !success && (
        <>
          <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.6, marginBottom: 10 }}>
            {lang === "jp"
              ? "Monkey Yoga Phonics ワークブックをご購入いただき、ありがとうございます！ワークブック特典コードを入力すると、アプリを1ヶ月無料でご利用いただけます。"
              : "Have a Monkey Yoga Phonics workbook? Enter your bonus code to unlock 1 free month of app access."}
          </div>
          {!showInput ? (
            <button
              onClick={() => setShowInput(true)}
              style={{ background: "none", border: `1px solid ${COLORS.red}`, borderRadius: 8, color: COLORS.red, fontSize: 12, fontWeight: 700, padding: "8px 14px", cursor: "pointer", width: "100%" }}>
              {lang === "jp" ? "コードを入力する" : "Enter Workbook Code"}
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleRedeem()}
                placeholder="MYP-B1-XXXX-XXX"
                style={{
                  background: "#111", border: "1px solid #333", borderRadius: 8,
                  color: COLORS.text, fontSize: 13, padding: "9px 12px",
                  outline: "none", fontFamily: "monospace", letterSpacing: 1,
                  width: "100%", boxSizing: "border-box",
                }}
              />
              {error && <div style={{ fontSize: 11, color: "#f87171" }}>{error}</div>}
              <button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                style={{
                  background: loading ? "#333" : COLORS.red, border: "none", borderRadius: 8,
                  color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px",
                  cursor: loading ? "default" : "pointer", opacity: (!code.trim() && !loading) ? 0.5 : 1,
                }}>
                {loading ? (lang === "jp" ? "確認中..." : "Checking…") : (lang === "jp" ? "コードを適用する" : "Activate Code")}
              </button>
            </div>
          )}
        </>
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
  const [saved, setSaved]         = useState(false);
  const [saving, setSaving]       = useState(false);
  const [deletePhase, setDeletePhase] = useState("idle"); // "idle" | "confirm" | "deleting" | "done"
  const [deleteError, setDeleteError] = useState("");

  async function saveProfile() {
    if (!user?.uid || !name.trim()) return;
    setSaving(true);
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      await updateDoc(doc((await import("../lib/firebase")).db, "users", user.uid), { name: name.trim() });
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
