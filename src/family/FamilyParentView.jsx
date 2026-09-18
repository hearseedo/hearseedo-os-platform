// Parent mode (item 3: "Parent mode and child mode must remain distinct",
// item 20: extend ParentView's INTENT — not a fork of the existing
// share-link ParentView.jsx, which serves a different, already-working
// purpose (a public link into the older single-learner learnerProfiles
// model). This is the parent-facing view of the NEW per-profile Family
// data (src/family/familyProgress.js), reachable only from inside Family
// Home by an already-authenticated parent — not a public link.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS, CATEGORY_STYLE } from "./theme";
import { getActivityProgress, getCompletionStats, getRecommendedActivity, getWeeklySummary } from "./familyProgress";
import { SELF_PROFILE_ID } from "../lib/profiles";
import { CATEGORIES, localizedTitle } from "./content";
import { db } from "../lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import FamilyLoading from "./FamilyLoading";
import { getCurriculumState, MONKEY_YOGA_CURRICULUM_ID } from "./curriculumProgress";
import { MTAU_MIN_AGE_BANDS, getMTAULessonSummary, getMigratedLessonIds } from "./mtauContent";
import { getMTAUBookProgress, getMTAUCurrentLesson, isMTAUBookComplete } from "./mtauProgress";

export default function FamilyParentView() {
  const { user, profiles, currentProfile } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(currentProfile?.id ?? SELF_PROFILE_ID);
  const [progress, setProgress] = useState(null);
  const [curriculumState, setCurriculumState] = useState(null);
  const [mtauBookProgress, setMtauBookProgress] = useState(undefined);
  const [feedback, setFeedback] = useState("");
  const [feedbackKind, setFeedbackKind] = useState("general");
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!user?.uid || !selectedId) return;
    getActivityProgress(user.uid, selectedId).then(setProgress).catch(() => setProgress({}));
    getCurriculumState(user.uid, selectedId, MONKEY_YOGA_CURRICULUM_ID).then(setCurriculumState).catch(() => setCurriculumState(null));
  }, [user?.uid, selectedId]);

  const mtauAgeAppropriate = MTAU_MIN_AGE_BANDS.includes(profiles.find(p => p.id === selectedId)?.ageBand);
  useEffect(() => {
    if (!user?.uid || !selectedId || !mtauAgeAppropriate) { setMtauBookProgress(undefined); return; }
    getMTAUBookProgress(user.uid, selectedId, 1).then(setMtauBookProgress).catch(() => setMtauBookProgress({}));
  }, [user?.uid, selectedId, mtauAgeAppropriate]);

  async function sendFeedback() {
    if (!feedback.trim()) return;
    // Reuses the EXISTING feedback collection/rule (any auth'd user can
    // create, admin-only read) — no new collection for beta feedback.
    await addDoc(collection(db, "feedback"), {
      uid: user.uid, source: "family_beta", profileId: selectedId,
      kind: feedbackKind, text: feedback.trim(), createdAt: serverTimestamp(),
    }).catch(() => {});
    setFeedback("");
    setFeedbackKind("general");
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 3000);
  }

  if (!user || progress === null) return <FamilyLoading />;

  const child = profiles.find(p => p.id === selectedId);
  const stats = getCompletionStats(progress);
  const recommended = getRecommendedActivity(progress, child?.ageBand);
  const recentWins = Object.values(progress).filter(p => p.completed).slice(-5).reverse();
  const weekly = getWeeklySummary(progress);

  // Monkeys Talk & Unlock — same read-only, curriculum-aware card shape as
  // Monkey Yoga Phonics above (item 9: smallest useful addition, not a new
  // dashboard). Only shown once the child has actually started a lesson.
  const mtauStarted = mtauBookProgress && Object.values(mtauBookProgress).some(p => p !== null);
  const mtauCurrent = mtauStarted ? getMTAUCurrentLesson(1, mtauBookProgress) : null;
  const mtauCompletedCount = mtauStarted ? Object.values(mtauBookProgress).filter(p => p?.completed).length : 0;
  const mtauMigratedCount = getMigratedLessonIds(1).length;
  const mtauBookComplete = mtauStarted && isMTAUBookComplete(1, mtauBookProgress);
  // Confidence for the lesson currently in progress (or, once every
  // migrated lesson is complete, the last one) — real per-lesson data
  // already on the same doc, not a separate signal to compute.
  const mtauConfidenceDoc = mtauCurrent?.available ? mtauBookProgress[mtauCurrent.lessonId] : null;

  const FEEDBACK_KINDS = [
    { id: "general", label: "General feedback" },
    { id: "problem", label: "Report a problem" },
    { id: "idea",    label: "Idea / suggestion" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ padding: "16px 20px" }}>
        <button onClick={() => navigate("/family/home")} style={{ background: "none", border: "none", fontSize: 13, color: FAMILY_COLORS.textMuted, cursor: "pointer" }}>
          {t("fam_back_to_home")}
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: FAMILY_COLORS.pink, marginTop: 8 }}>👤 {t("fam_parent_mode")}</h1>
      </header>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 60px" }}>
        {profiles.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {profiles.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
                padding: "8px 14px", borderRadius: 20, border: `2px solid ${selectedId === p.id ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
                background: selectedId === p.id ? FAMILY_COLORS.pinkSoft : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700,
              }}>{p.name}</button>
            ))}
          </div>
        )}

        {/* Phase 4 (item 21) — parent weekly summary, in-app only (no email
            delivery pipeline built yet). */}
        <div style={{ background: FAMILY_COLORS.pinkSoft, border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 8 }}>This Week</div>
          {weekly.completedCount === 0 ? (
            <div style={{ fontSize: 13, color: FAMILY_COLORS.textMuted }}>No activities completed in the last 7 days yet.</div>
          ) : (
            <div style={{ fontSize: 13, color: FAMILY_COLORS.text, lineHeight: 1.6 }}>
              {child?.name ?? "Your child"} completed <strong>{weekly.completedCount}</strong> activit{weekly.completedCount === 1 ? "y" : "ies"} this week
              {weekly.moodCount > 0 && weekly.excitedCount > 0 && <> — and felt excited about {weekly.excitedCount} of them! 😄</>}
            </div>
          )}
        </div>

        {/* Monkey Yoga V2 integration — reflects the learner's actual
            curriculum position instead of just an activity count (item:
            "Family reflects the updated learner state"). Curriculum-aware,
            not a raw score — shows the manual's own Emerging/Developing/
            Confident language where available. */}
        {curriculumState?.individualPosition?.lastLessonId && (
          <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 8 }}>Monkey Yoga Phonics</div>
            <div style={{ fontSize: 13, color: FAMILY_COLORS.text, lineHeight: 1.6 }}>
              Currently at <strong>Book {curriculumState.individualPosition.lastBookId} · {curriculumState.individualPosition.lastLessonId}</strong>
              {curriculumState.individualPosition.lastConfidenceSignal && (
                <> — {curriculumState.individualPosition.lastConfidenceSignal}</>
              )}
            </div>
            {curriculumState.classroomPosition?.lessonId && (
              <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, marginTop: 4 }}>
                Class ({curriculumState.classroomPosition.className}) is on Book {curriculumState.classroomPosition.bookId} · {curriculumState.classroomPosition.lessonId}
              </div>
            )}
          </div>
        )}

        {mtauStarted && (
          <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 8 }}>Monkeys Talk &amp; Unlock</div>
            <div style={{ fontSize: 13, color: FAMILY_COLORS.text, lineHeight: 1.6 }}>
              {mtauBookComplete ? (
                <>🎉 <strong>Book 1 Complete</strong></>
              ) : mtauCurrent?.available ? (
                <>Currently at <strong>Book 1 · Lesson {mtauCurrent.lessonId}</strong>{getMTAULessonSummary(1, mtauCurrent.lessonId) && <> · {getMTAULessonSummary(1, mtauCurrent.lessonId).title}</>}</>
              ) : (
                <>Completed every migrated Book 1 lesson so far</>
              )}
            </div>
            <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, marginTop: 4 }}>{mtauCompletedCount} of {mtauMigratedCount} migrated lesson{mtauMigratedCount === 1 ? "" : "s"} completed</div>
            {mtauConfidenceDoc?.confidenceBefore != null && (
              <div style={{ fontSize: 12, color: FAMILY_COLORS.textMuted, marginTop: 4 }}>
                Confidence: {mtauConfidenceDoc.confidenceBefore}/5 before this lesson
                {mtauConfidenceDoc.confidenceAfter != null && <> · {mtauConfidenceDoc.confidenceAfter}/5 after</>}
              </div>
            )}
          </div>
        )}

        <h2 style={{ fontSize: 15, fontWeight: 800, color: FAMILY_COLORS.text, marginBottom: 12 }}>{t("fam_parent_progress")}</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 24 }}>
          {CATEGORIES.filter(c => c !== "hub").map(cat => {
            const style = CATEGORY_STYLE[cat];
            return (
              <div key={cat} style={{ background: style.soft, border: `2px solid ${style.color}33`, borderRadius: 14, padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 18 }}>{style.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: FAMILY_COLORS.text }}>{stats[cat].done}/{stats[cat].total}</div>
              </div>
            );
          })}
        </div>

        {recommended && (
          <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 6 }}>{t("fam_parent_recommended")}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: FAMILY_COLORS.text }}>{recommended.icon} {localizedTitle(recommended, lang)}</div>
          </div>
        )}

        {recentWins.length > 0 && (
          <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 10 }}>{t("fam_parent_recent_wins")}</div>
            {recentWins.map(w => (
              <div key={w.activityId} style={{ fontSize: 13, color: FAMILY_COLORS.text, padding: "4px 0" }}>✅ {w.activityId}</div>
            ))}
          </div>
        )}

        {/* Beta feedback — parent-facing only, no child-flow interruption (item 27) */}
        <div style={{ background: "#fff", border: `2px solid ${FAMILY_COLORS.border}`, borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: FAMILY_COLORS.pink, textTransform: "uppercase", marginBottom: 10 }}>{t("fam_send_feedback")}</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {FEEDBACK_KINDS.map(k => (
              <button key={k.id} onClick={() => setFeedbackKind(k.id)} style={{
                padding: "6px 12px", borderRadius: 16, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: `2px solid ${feedbackKind === k.id ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
                background: feedbackKind === k.id ? FAMILY_COLORS.pinkSoft : "#fff",
                color: FAMILY_COLORS.text,
              }}>{k.label}</button>
            ))}
          </div>
          <textarea
            value={feedback} onChange={e => setFeedback(e.target.value)}
            placeholder={t("fam_feedback_placeholder")}
            style={{ width: "100%", minHeight: 70, padding: 10, borderRadius: 10, border: `2px solid ${FAMILY_COLORS.border}`, fontSize: 13, boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit" }}
          />
          <button onClick={sendFeedback} disabled={!feedback.trim()} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
            {t("fam_send_feedback")}
          </button>
          {feedbackSent && <div style={{ fontSize: 12, color: FAMILY_COLORS.green, marginTop: 8 }}>{t("fam_feedback_sent")}</div>}
        </div>
      </div>
    </div>
  );
}
