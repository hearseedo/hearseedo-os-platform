import { TOKENS } from "../../constants/tokens";
import Events from "../../components/Events";

// Rebuild prompt section 4/7 — Family Calendar. Reuses the live Events
// component. Note: it's currently a hand-maintained list of community live
// sessions (see its own comment: "swap for Firestore fetch when you have
// real events"), not a per-family personal calendar — real content, but
// not yet the family-specific calendar the rebuild prompt describes.
export default function CalendarPanel({ user }) {
  return (
    <div>
      <div style={{ marginBottom: TOKENS.space[5] }}>
        <div style={{ ...TOKENS.font.label, color: TOKENS.color.gold, marginBottom: 4 }}>CALENDAR</div>
        <h1 style={{ fontSize: TOKENS.font.size["2xl"], fontWeight: 800 }}>Upcoming Events</h1>
        <p style={{ color: TOKENS.color.textMuted, fontSize: TOKENS.font.size.sm, marginTop: 4 }}>
          Community live sessions for now — a personal family calendar isn't built yet.
        </p>
      </div>
      <Events user={user} />
    </div>
  );
}
