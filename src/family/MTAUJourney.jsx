// Monkeys Talk & Unlock — Books journey/map screen (Summit Readiness
// Sprint, 2026-09-17). Shows Books 1-6 with their real, audited metadata
// (city/CEFR/EIKEN) plus Books 7-8 explicitly labelled "coming next" —
// never represented as available, matching the reference product's own
// labelling. Only Book 1 Lesson 1 is deeply integrated and openable this
// pass; Books 2-6 are visible (proving the architecture scales) but their
// lessons are not yet migrated.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { MTAU_BOOKS, MTAU_MIN_AGE_BANDS } from "./mtauContent";
import { getMTAULessonProgress, getMTAUNextLesson } from "./mtauProgress";
import { FAMILY_COLORS } from "./theme";
import { SELF_PROFILE_ID } from "../lib/profiles";
import FamilyLoading from "./FamilyLoading";
import FamilyError from "./FamilyError";

export default function MTAUJourney() {
  const { user, currentProfile } = useAuth();
  const navigate = useNavigate();
  const profileId = currentProfile?.id ?? SELF_PROFILE_ID;
  // undefined = still resolving; null = resolved, genuinely no progress yet
  // (first visit) — these must stay distinguishable, since
  // getMTAULessonProgress legitimately resolves to null when the learner
  // has never started Lesson 1, same convention IframeAppPlayer already
  // uses in ActivityPlayer.jsx for curriculumTarget.
  const [lesson11Progress, setLesson11Progress] = useState(undefined);

  const ageAppropriate = currentProfile && MTAU_MIN_AGE_BANDS.includes(currentProfile.ageBand);

  useEffect(() => {
    if (!user?.uid || !ageAppropriate) return;
    getMTAULessonProgress(user.uid, profileId, 1, 1).then(setLesson11Progress).catch(() => setLesson11Progress(null));
  }, [user?.uid, profileId, ageAppropriate]);

  if (!currentProfile) return <FamilyLoading />;
  // Age gate (Summit Sprint scope: "visible only to an appropriate older
  // learner such as Kenji QA") — not a security boundary, just product
  // scoping, same convention as everywhere else in Family that gates by
  // ageBand rather than a permission check.
  if (!ageAppropriate) {
    return <FamilyError kind="unavailable" onBack={() => navigate("/family/home")} />;
  }

  const next = getMTAUNextLesson(lesson11Progress);

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
        {lesson11Progress !== undefined && (
          <div style={{ background: "#1e1e2a", border: "1px solid #333", borderRadius: 16, padding: 18, marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#e0559c", fontWeight: 800, marginBottom: 6 }}>CURRENT JOURNEY</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
              Book 1 · Nagoya {lesson11Progress?.completed ? "— Lesson 1 complete" : lesson11Progress?.currentStep ? "— in progress" : ""}
            </div>
            <button
              onClick={() => navigate("/family/mtau/book/1/lesson/1")}
              style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: FAMILY_COLORS.pink, color: "#fff", fontWeight: 800, cursor: "pointer" }}
            >
              {lesson11Progress?.completed ? "Review Lesson 1" : lesson11Progress?.currentStep ? "Continue Lesson 1" : "Start Lesson 1"} →
            </button>
            {lesson11Progress?.completed && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 10 }}>
                Next: Book {next.bookId} · Lesson {next.lessonId} — coming soon
              </div>
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
