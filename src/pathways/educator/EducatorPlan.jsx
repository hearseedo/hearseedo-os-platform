import { useNavigate } from "react-router-dom";
import { EDU_COLORS } from "./theme";
import { Card, SectionTitle, StatusBadge } from "./components";
import { SEASONAL_LESSONS, CONFIDENCE_FIRST_LESSONS, BRAVE_BEGINNINGS, YEARLY_THEME_COLLECTION } from "./educatorData";

export default function EducatorPlan() {
  const navigate = useNavigate();

  return (
    <div>
      <SectionTitle eyebrow="Plan" title="Curriculum &amp; lesson planning" subtitle="What's ready to teach today, and what HSD's curriculum library is growing into." />

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Ready Now</div>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <StatusBadge status="available" />
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>{SEASONAL_LESSONS.title}</h3>
              <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, maxWidth: 460 }}>{SEASONAL_LESSONS.description}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href={SEASONAL_LESSONS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open WonderCamp →</a>
              <a href={SEASONAL_LESSONS.worksheetsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Printable Worksheets →</a>
            </div>
          </div>
        </Card>
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <StatusBadge status="available" />
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>{CONFIDENCE_FIRST_LESSONS.title}</h3>
              <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, maxWidth: 460 }}>{CONFIDENCE_FIRST_LESSONS.description}</p>
            </div>
            <a href={CONFIDENCE_FIRST_LESSONS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open Lesson Plans →</a>
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <StatusBadge status="available" />
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>{BRAVE_BEGINNINGS.title}</h3>
              <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, maxWidth: 460 }}>{BRAVE_BEGINNINGS.description}</p>
            </div>
            <a href={BRAVE_BEGINNINGS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open Lesson Studio →</a>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Coming Next</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <Card>
            <StatusBadge status="coming_soon" />
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: "12px 0 4px" }}>{YEARLY_THEME_COLLECTION.title}</h3>
            <p style={{ fontSize: 13, color: EDU_COLORS.textMuted }}>{YEARLY_THEME_COLLECTION.subtitle}</p>
          </Card>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Create / Adapt with Jona</div>
        <Card>
          <p style={{ fontSize: 14, color: EDU_COLORS.text, lineHeight: 1.6, marginBottom: 16 }}>
            Ask Jona to adapt a Seasonal Lesson for a different age group, make an activity easier or harder,
            or turn it into a Hear → See → Do speaking activity.
          </p>
          <button onClick={() => navigate("/educator/jona")} style={{ background: EDU_COLORS.primary, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            Ask Jona →
          </button>
        </Card>
      </div>
    </div>
  );
}
