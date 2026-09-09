// Lightweight loading state (item 31) — character + text, no blank screen,
// no heavy video.
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS } from "./theme";

export default function FamilyLoading() {
  const { t } = useLang();
  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <img src="/assets/hsd/family/characters/family-thinking.webp" alt="" style={{ width: 96, height: 96, objectFit: "contain", animation: "famBounce 1.2s ease-in-out infinite" }} />
      <div style={{ fontSize: 14, fontWeight: 700, color: FAMILY_COLORS.textMuted }}>{t("fam_loading")}</div>
      <style>{`@keyframes famBounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} } @media (prefers-reduced-motion: reduce) { img { animation: none !important; } }`}</style>
    </div>
  );
}
