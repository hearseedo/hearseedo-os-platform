// Family Hub (item 8) — parent+child-together activities. Thin wrapper
// around the same ActivityGrid every other category uses (category="hub"),
// not a bespoke sixth implementation.
import ActivityGrid from "./ActivityGrid";
export default function FamilyHub() {
  return <ActivityGrid category="hub" />;
}
