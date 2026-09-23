// Entirely fabricated demo data (see educatorData.js's DEMO_CLASS comment)
// — the only real class system (src/lib/classroom.js) is admin-only and
// stores nothing beyond a curriculum position, no confidence/participation
// data anywhere to show for real. Never wire this to real Firestore data
// without a real, safe, per-teacher aggregation query behind it.
import { EDU_COLORS } from "./theme";
import { Card, SectionTitle, StatusBadge } from "./components";
import { DEMO_CLASS } from "./educatorData";

function Stat({ label, value }) {
  return (
    <Card style={{ textAlign: "center", padding: 18 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: EDU_COLORS.primary }}>{value}</div>
      <div style={{ fontSize: 12, color: EDU_COLORS.textMuted, marginTop: 4 }}>{label}</div>
    </Card>
  );
}

export default function EducatorStudents() {
  return (
    <div>
      <SectionTitle eyebrow="Students" title="Classes &amp; students" subtitle="A preview of what class-level insight could look like, once built." />
      <div style={{ marginBottom: 20 }}><StatusBadge status="demo" /></div>

      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: EDU_COLORS.textMuted, textTransform: "uppercase", fontWeight: 800, marginBottom: 4 }}>Demo class</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{DEMO_CLASS.name}</div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 28 }}>
        <Stat label="Class Confidence" value={`${DEMO_CLASS.confidencePercent}%`} />
        <Stat label="Speaking voluntarily" value={`${DEMO_CLASS.speakingVoluntarily.count} / ${DEMO_CLASS.speakingVoluntarily.total}`} />
        <Stat label="Students needing encouragement" value={DEMO_CLASS.needingEncouragement} />
        <Stat label="Recommended next activity" value={DEMO_CLASS.recommendedActivity} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Students</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {DEMO_CLASS.students.map((s) => (
          <Card key={s.name} style={{ padding: 16 }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: EDU_COLORS.primary, fontWeight: 700, marginBottom: 4 }}>{s.confidence}</div>
            <div style={{ fontSize: 12, color: EDU_COLORS.textMuted, lineHeight: 1.5 }}>{s.note}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
