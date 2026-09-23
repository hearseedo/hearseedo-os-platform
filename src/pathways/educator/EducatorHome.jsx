import { useNavigate } from "react-router-dom";
import { EDU_COLORS } from "./theme";
import { Card, StatusBadge } from "./components";
import { SEASONAL_LESSONS, CONFIDENCE_FIRST_LESSONS, YEARLY_THEME_COLLECTION } from "./educatorData";

export default function EducatorHome() {
  const navigate = useNavigate();

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", color: EDU_COLORS.primary, marginBottom: 8 }}>
          HSD Educators
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: "0 0 10px", color: EDU_COLORS.text }}>
          Teach for confidence. Use AI for support. Keep the human connection.
        </h1>
        <p style={{ color: EDU_COLORS.textMuted, fontSize: 15, maxWidth: 620, lineHeight: 1.6 }}>
          Confidence before correctness. A learner who feels safe will try — a learner who tries will
          communicate — a learner who communicates can then improve.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
        <Card>
          <StatusBadge status="available" />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>{SEASONAL_LESSONS.title}</h3>
          <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.5, marginBottom: 16 }}>{SEASONAL_LESSONS.subtitle}</p>
          <a href={SEASONAL_LESSONS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>
            Explore Lessons →
          </a>
        </Card>

        <Card>
          <StatusBadge status="coming_soon" />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>{CONFIDENCE_FIRST_LESSONS.title}</h3>
          <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.5 }}>{CONFIDENCE_FIRST_LESSONS.subtitle}</p>
        </Card>

        <Card>
          <StatusBadge status="coming_soon" />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>{YEARLY_THEME_COLLECTION.title}</h3>
          <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.5 }}>{YEARLY_THEME_COLLECTION.subtitle}</p>
        </Card>

        <Card>
          <StatusBadge status="available" />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>HSD Curriculum &amp; Books</h3>
          <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.5, marginBottom: 16 }}>Existing HSD educational books and curriculum.</p>
          <button onClick={() => navigate("/educator/resources")} style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, cursor: "pointer" }}>
            Explore HSD Books →
          </button>
        </Card>

        <Card>
          <StatusBadge status="available" />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>Ask Jona</h3>
          <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.5, marginBottom: 16 }}>Educator AI support — adapt lessons, plan warm-ups, and more.</p>
          <button onClick={() => navigate("/educator/jona")} style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, cursor: "pointer" }}>
            Ask Jona →
          </button>
        </Card>

        <Card>
          <StatusBadge status="demo" />
          <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>Classes / Students</h3>
          <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.5, marginBottom: 16 }}>A preview of class-level confidence and participation insights.</p>
          <button onClick={() => navigate("/educator/students")} style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, cursor: "pointer" }}>
            View Class →
          </button>
        </Card>
      </div>
    </div>
  );
}
