// Reuses the existing Jona chat implementation directly (src/components/
// AIChat.jsx — the same component Dashboard.jsx embeds) rather than
// building a second AI architecture for educators. Only new thing here is
// framing copy suggesting educator-shaped prompts; the chat itself, its
// plan limits, and its backend call are all the existing system.
import { EDU_COLORS } from "./theme";
import { Card, SectionTitle } from "./components";
import AIChat from "../../components/AIChat";

const EXAMPLE_PROMPTS = [
  "Adapt this lesson for younger students",
  "Make this activity easier",
  "Create a 10-minute speaking warm-up",
  "Adapt a lesson for shy students",
  "Turn a worksheet into a Hear See Do activity",
  "Suggest what to teach next",
];

export default function EducatorJona() {
  return (
    <div>
      <SectionTitle eyebrow="Jona" title="Ask Jona" subtitle="Jona supports the teacher — it doesn't replace the teacher. The human relationship stays central." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 24 }}>
        {EXAMPLE_PROMPTS.map((p) => (
          <Card key={p} style={{ padding: "12px 14px" }}>
            <span style={{ fontSize: 13, color: EDU_COLORS.text }}>"{p}"</span>
          </Card>
        ))}
      </div>

      <AIChat />
    </div>
  );
}
