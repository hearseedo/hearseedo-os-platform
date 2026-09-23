// Deliberately minimal — no classroom/presentation system exists yet, so
// this only surfaces what's real: launching today's lesson in WonderCamp,
// the worksheets that go with it, the Hear See Do teaching structure, and
// a quick path to Jona for in-the-moment adaptation. Nothing invented.
import { useNavigate } from "react-router-dom";
import { EDU_COLORS } from "./theme";
import { Card, SectionTitle, StatusBadge } from "./components";
import { SEASONAL_LESSONS } from "./educatorData";

const HSD_STEPS = [
  { step: "Hear it.", desc: "Learners listen first — sound and rhythm before spelling." },
  { step: "See it.", desc: "Visual and physical context makes meaning concrete." },
  { step: "Do it.", desc: "Learners speak, move, and try — confidence before correctness." },
  { step: "Build confidence.", desc: "Every attempt is a win; correction comes gently, later." },
];

export default function EducatorTeach() {
  const navigate = useNavigate();

  return (
    <div>
      <SectionTitle eyebrow="Teach" title="In the classroom" subtitle="Tools for right before or during a lesson." />

      <div style={{ marginBottom: 32 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <StatusBadge status="available" />
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: "12px 0 4px" }}>Today's Lesson</h3>
              <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, maxWidth: 460 }}>
                Open WonderCamp to run any of the 36 Seasonal Lessons live — vocabulary, songs, and activities in one place.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <a href={SEASONAL_LESSONS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open WonderCamp →</a>
              <a href={SEASONAL_LESSONS.worksheetsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Printable Worksheets →</a>
            </div>
          </div>
        </Card>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>The Hear See Do Method™</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {HSD_STEPS.map((s) => (
            <Card key={s.step} style={{ padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: EDU_COLORS.primary, marginBottom: 4 }}>{s.step}</div>
              <div style={{ fontSize: 12, color: EDU_COLORS.textMuted, lineHeight: 1.5 }}>{s.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <p style={{ fontSize: 14, color: EDU_COLORS.text, lineHeight: 1.6, marginBottom: 16 }}>
          Need a quick adaptation mid-lesson — an easier version, an extension activity, or a way to bring in a shy speaker?
        </p>
        <button onClick={() => navigate("/educator/jona")} style={{ background: EDU_COLORS.primary, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
          Ask Jona →
        </button>
      </Card>
    </div>
  );
}
