// Monkeys Talk & Unlock — Books journey/map screen (Summit Readiness
// Sprint: content-migration pipeline validation, 2026-09-18). Shows Books
// 1-6 with real, audited metadata (city/CEFR/EIKEN) plus Books 7-8 labelled
// "coming next". Book 1 Lessons 1-3 are deeply integrated; the per-lesson
// status list and current/next-lesson logic are fully generic over
// getMigratedLessonIds(1) — adding Lesson 4 later means adding one entry
// to mtauContent.js's lesson index, not touching this component.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { MTAU_BOOKS, MTAU_MIN_AGE_BANDS, getMigratedLessonIds, getMTAULessonSummary, getMTAUBook } from "./mtauContent";
import { getMTAUBookProgress, getMTAUCurrentLesson, isMTAUBookComplete } from "./mtauProgress";
import { FAMILY_COLORS } from "./theme";
import { SELF_PROFILE_ID } from "../lib/profiles";
import FamilyLoading from "./FamilyLoading";
import FamilyError from "./FamilyError";

export default function MTAUJourney() {
  const { user, currentProfile } = useAuth();
  const navigate = useNavigate();
  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;
  // undefined = still resolving; null-ish states inside the map are fine
  // since each lesson's own progress doc legitimately resolves to null on
  // first visit — same convention IframeAppPlayer already uses in
  // ActivityPlayer.jsx for curriculumTarget.
  const [bookProgress, setBookProgress] = useState(undefined);

  const ageAppropriate = currentProfile && MTAU_MIN_AGE_BANDS.includes(currentProfile.ageBand);
  const migratedLessonIds = getMigratedLessonIds(1); // Book 1 only, this pass

  useEffect(() => {
    if (!user?.uid || !ageAppropriate) return;
    getMTAUBookProgress(user.uid, profileId, 1).then(setBookProgress).catch(() => setBookProgress({}));
  }, [user?.uid, profileId, ageAppropriate]);

  if (!currentProfile) return <FamilyLoading />;
  // Age gate (Summit Sprint scope: "visible only to an appropriate older
  // learner such as Kenji QA") — not a security boundary, just product
  // scoping, same convention as everywhere else in Family that gates by
  // ageBand rather than a permission check.
  if (!ageAppropriate) {
    return <FamilyError kind="unavailable" onBack={() => navigate("/family/home")} />;
  }

  const current = bookProgress !== undefined ? getMTAUCurrentLesson(1, bookProgress) : null;
  const bookComplete = bookProgress !== undefined && isMTAUBookComplete(1, bookProgress);
  // Only treat this as "not yet migrated" once we know the book genuinely
  // isn't complete — otherwise (once all 18 real lessons are migrated and
  // done) getMTAULessonSummary(1, 19) would honestly return null anyway,
  // but the explicit bookComplete banner below is clearer than silence.
  const nextUnmigrated = current && !current.available && !bookComplete ? getMTAULessonSummary(1, current.lessonId) : null;
  const nextBook = bookComplete ? getMTAUBook(2) : null;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b12", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <header style={{ padding: "16px 20px", borderBottom: "1px solid #222" }}>
        <button onClick={() => navigate("/family/home")} style={{ background: "none", border: "none", color: "#aaa", fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
          ← Back to Family Home
        </button>
        <div style={{ fontSize: 20, fontWeight: 900 }}>MONKEYS TALK &amp; UNLOCK</div>
        <div style={{ fontSize: 13, color: "#aaa" }}>One journey. A stronger voice at every level.</div>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px 60px" }}>
        {bookProgress !== undefined && (
          <div style={{ background: "#1e1e2a", border: "1px solid #333", borderRadius: 16, padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#e0559c", fontWeight: 800, marginBottom: 6 }}>BOOK 1 · NAGOYA</div>

            {/* Real per-lesson status row for every migrated lesson —
                generic over migratedLessonIds, not a fixed Lesson-1-only
                card. Adding Lesson 4 later needs zero changes here. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {migratedLessonIds.map(lessonId => {
                const p = bookProgress[lessonId];
                const isCurrent = current?.available && current.lessonId === lessonId;
                const summary = getMTAULessonSummary(1, lessonId);
                const label = p?.completed ? "✓ Complete" : p?.currentStep ? "In progress" : isCurrent ? "Ready to start" : "Locked";
                return (
                  <div key={lessonId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#15151f", borderRadius: 10, padding: "10px 14px" }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>Lesson {lessonId} · {summary?.place ?? ""}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{summary?.title ?? ""}</div>
                    </div>
                    <div style={{ fontSize: 12, color: p?.completed ? "#8ee6a8" : "#aaa", fontWeight: 700 }}>{label}</div>
                  </div>
                );
              })}
            </div>

            {bookComplete ? (
              <div style={{ background: "#1e1e2a", border: `1px solid ${FAMILY_COLORS.pink}55`, borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🎉 BOOK 1 COMPLETE</div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 2 }}>{migratedLessonIds.length}/{migratedLessonIds.length} lessons completed</div>
                <div style={{ fontSize: 12, color: "#aaa", marginBottom: 2 }}>Book 1 · A1 · EIKEN 5</div>
                <div style={{ fontSize: 12, color: "#8ee6a8", marginBottom: 10 }}>Nagoya journey complete</div>
                {nextBook && (
                  <div style={{ fontSize: 12, color: "#888" }}>
                    Next Journey: Book {nextBook.bookId} — {nextBook.city} — coming soon
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => current?.available && navigate(`/family/mtau/book/1/lesson/${current.lessonId}`)}
                  disabled={!current?.available}
                  style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: current?.available ? FAMILY_COLORS.pink : "#333", color: "#fff", fontWeight: 800, cursor: current?.available ? "pointer" : "default" }}
                >
                  {current?.available ? (
                    bookProgress[current.lessonId]?.currentStep ? `Continue Lesson ${current.lessonId}` : `Start Lesson ${current.lessonId}`
                  ) : "All migrated lessons complete"} →
                </button>

                {nextUnmigrated && (
                  <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
                    Next: Lesson {current.lessonId} · {nextUnmigrated.place} · {nextUnmigrated.title} — coming soon
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 800, color: "#888", marginBottom: 12, letterSpacing: 0.5 }}>BOOKS 1–8</div>
        <div style={{ display: "grid", gap: 12 }}>
          {MTAU_BOOKS.map(b => (
            <div key={b.bookId} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#15151f", border: "1px solid #2a2a3a", borderRadius: 14, padding: "14px 18px",
              opacity: b.status === "coming_next" ? 0.5 : 1,
            }}>
              <div>
                <div style={{ fontWeight: 800 }}>{b.bookId} · {b.city}</div>
                <div style={{ fontSize: 12, color: "#aaa" }}>{b.cefr} · {b.eiken} — {b.theme}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, color: b.status === "coming_next" ? "#888" : "#8ee6a8" }}>
                {b.status === "coming_next" ? "COMING NEXT" : b.bookId === 1 ? "OPEN JOURNEY" : "PREVIEW ONLY"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
