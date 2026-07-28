import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { BADGES, CONFIDENCE_LEVELS, levelForXP, nextLevel } from "./data";
import { grt } from "./i18n";
import { getProgress } from "./storage";

export default function Progress({ user, onExit }) {
  const { lang } = useLang();
  const tr = (k) => grt(lang, k);
  const jp = lang === "jp";
  const progress = getProgress(user?.uid);
  const level    = levelForXP(progress.xp);
  const next     = nextLevel(progress.xp);
  const xpIntoLevel = progress.xp - level.minXP;
  const xpForNext   = next ? next.minXP - level.minXP : 1;
  const pct = next ? Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100)) : 100;
  const levelName = jp && level.nameJp ? level.nameJp : level.name;
  const nextName  = next ? (jp && next.nameJp ? next.nameJp : next.name) : "";

  const totalSessions = Object.values(progress.sessionsCompleted).reduce((a, b) => a + b, 0);
  const avgConfidence = progress.confidenceHistory.length
    ? Math.round(progress.confidenceHistory.reduce((s, h) => s + h.score, 0) / progress.confidenceHistory.length)
    : 0;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
      <button onClick={onExit} style={backBtnStyle}>{tr("back_to_global_ready")}</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "20px 0 6px" }}>{tr("confidence_progress")}</h1>
      <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 24 }}>
        {tr("confidence_progress_desc")}
      </p>

      {/* Level card */}
      <div style={{
        background: "linear-gradient(135deg, rgba(46,196,182,0.12), rgba(46,196,182,0.04))",
        border: "1px solid rgba(46,196,182,0.35)", borderRadius: 16, padding: 22, marginBottom: 20,
      }}>
        <div style={{ fontSize: 11, color: "#2ec4b6", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
          {tr("confidence_level")} {level.level}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, margin: "4px 0 14px" }}>{levelName}</div>
        <div style={{ height: 8, background: "#111", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#2ec4b6", borderRadius: 4, transition: "width 0.4s ease" }} />
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted }}>
          {next ? `${xpIntoLevel} / ${xpForNext} ${tr("xp_to")} ${nextName}` : tr("max_level_reached")}
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { label: tr("stat_sessions"),      value: totalSessions,          color: COLORS.gold },
          { label: tr("stat_avg_confidence"), value: `${avgConfidence}%`,   color: "#2ec4b6" },
          { label: tr("stat_badges"),        value: progress.badges.length, color: COLORS.success },
        ].map((s) => (
          <div key={s.label} style={{ flex: 1, background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Levels ladder */}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
        {tr("confidence_levels")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {CONFIDENCE_LEVELS.map((l) => {
          const reached = progress.xp >= l.minXP;
          return (
            <div key={l.level} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
              background: reached ? "rgba(46,196,182,0.08)" : COLORS.card,
              border: `1px solid ${reached ? "rgba(46,196,182,0.3)" : "#1e1e1e"}`, borderRadius: 10,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: reached ? "#2ec4b6" : "#1a1a1a", color: reached ? "#000" : COLORS.textDim,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800,
              }}>
                {reached ? "✓" : l.level}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: reached ? COLORS.text : COLORS.textMuted }}>
                {tr("confidence_level")} {l.level}: {jp && l.nameJp ? l.nameJp : l.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Badges */}
      <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textMuted, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
        {tr("badges_header")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {BADGES.map((b) => {
          const earned = progress.badges.includes(b.id);
          return (
            <div key={b.id} style={{
              background: earned ? COLORS.card : "#0d0d0d",
              border: `1px solid ${earned ? COLORS.gold + "55" : "#1e1e1e"}`,
              borderRadius: 12, padding: 14, opacity: earned ? 1 : 0.45,
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{b.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{jp && b.nameJp ? b.nameJp : b.name}</div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, lineHeight: 1.4 }}>{jp && b.descJp ? b.descJp : b.desc}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: "none", border: "none", color: COLORS.textMuted,
  fontSize: 13, cursor: "pointer", padding: 0,
};
