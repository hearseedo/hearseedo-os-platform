import { EDU_COLORS } from "./theme";
import { Card, SectionTitle } from "./components";
import { SEASONAL_LESSONS, WONDER_WORKS, BRAVE_BEGINNINGS, BOOKS } from "./educatorData";

export default function EducatorResources() {
  return (
    <div>
      <SectionTitle eyebrow="Resources" title="Curriculum, method &amp; books" subtitle="Everything grouped by what it actually is — not a file dump." />

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Teaching philosophy</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Confidence First Learning™</h3>
            <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6 }}>
              Confidence before correctness. A learner who feels safe will try; a learner who tries will communicate;
              a learner who communicates can then improve.
            </p>
          </Card>
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>The Hear See Do Method™</h3>
            <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6 }}>
              Hear it. See it. Do it. Build confidence. A teaching structure that puts listening and doing before
              correction.
            </p>
          </Card>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 12 }}>Curriculum</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{SEASONAL_LESSONS.title}</h3>
            <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{SEASONAL_LESSONS.description}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <a href={SEASONAL_LESSONS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open WonderCamp →</a>
              <a href={SEASONAL_LESSONS.worksheetsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Printable Worksheets →</a>
            </div>
          </Card>
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{WONDER_WORKS.title}</h3>
            <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{WONDER_WORKS.description}</p>
            <a href={WONDER_WORKS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open Lesson Plans →</a>
          </Card>
          <Card>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{BRAVE_BEGINNINGS.title}</h3>
            <p style={{ fontSize: 13, color: EDU_COLORS.textMuted, lineHeight: 1.6, marginBottom: 14 }}>{BRAVE_BEGINNINGS.description}</p>
            <a href={BRAVE_BEGINNINGS.appUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 800, color: EDU_COLORS.primary, textDecoration: "none" }}>Open Lesson Studio →</a>
          </Card>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: EDU_COLORS.textMuted, textTransform: "uppercase", marginBottom: 4 }}>HSD Curriculum &amp; Books</div>
        <p style={{ fontSize: 12, color: EDU_COLORS.textMuted, marginBottom: 16 }}>
          Amazon links below are general search links, not direct product pages — real product URLs weren't found in the project yet.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          {BOOKS.map((book) => (
            <a key={book.id} href={book.amazonUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
              <Card style={{ padding: 12 }}>
                <img src={book.cover} alt={book.title} style={{ width: "100%", borderRadius: 8, display: "block", marginBottom: 10 }} loading="lazy" />
                <div style={{ fontSize: 12, fontWeight: 700, color: EDU_COLORS.text, lineHeight: 1.4 }}>{book.title}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: EDU_COLORS.primary, marginTop: 6 }}>Find on Amazon →</div>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
