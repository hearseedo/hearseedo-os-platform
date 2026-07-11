import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";

const CEFR_ORDER = ["A1","A2","B1","B2","C1","C2"];
const CEFR_LABEL = { A1:"Starter", A2:"Elementary", B1:"Intermediate", B2:"Upper-Inter.", C1:"Advanced", C2:"Mastery" };
const CEFR_COLOR = { A1:"#64748b", A2:"#3b82f6", B1:"#8b5cf6", B2:"#f59e0b", C1:"#e01010", C2:"#C9A84C" };

export const CEFR_META = {
  A1: { color: "#64748b", eiken: "英検5級",     eikenEn: "Eiken Gr.5",      toeic: "~225"  },
  A2: { color: "#3b82f6", eiken: "英検4級",     eikenEn: "Eiken Gr.4",      toeic: "~350"  },
  B1: { color: "#8b5cf6", eiken: "英検3級〜準2級", eikenEn: "Eiken Gr.3–Pre-2", toeic: "~550"  },
  B2: { color: "#f59e0b", eiken: "英検2級",     eikenEn: "Eiken Gr.2",      toeic: "~730"  },
  C1: { color: "#e01010", eiken: "英検準1級",   eikenEn: "Eiken Pre-1",     toeic: "~880"  },
  C2: { color: "#C9A84C", eiken: "英検1級",     eikenEn: "Eiken Gr.1",      toeic: "~980"  },
};

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function ScoreDelta({ baseline, current }) {
  const delta = current - baseline;
  if (delta === 0) return <span style={{ color: COLORS.textMuted }}>+0</span>;
  return (
    <span style={{ color: delta > 0 ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
      {delta > 0 ? "+" : ""}{delta}
    </span>
  );
}

export default function ProgressJourney({ user }) {
  const { t, lang }   = useLang();
  const baseline      = user?.baselineScore ?? null;
  const current       = user?.confidenceScore ?? 0;
  const baselineCefr  = user?.baselineCefr ?? null;
  const currentCefr   = user?.cefr ?? null;
  const baselineDate  = user?.baselineDate ?? null;
  const days          = daysSince(baselineDate);
  const streak        = user?.streak ?? 0;

  // No baseline yet
  if (!baseline) return (
    <div style={{ padding: "14px 18px", background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12 }}>
      <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>{t("your_journey")}</div>
      <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.6 }}>
        {t("take_assessment")}
      </div>
    </div>
  );

  const cefrImproved = baselineCefr && currentCefr && CEFR_ORDER.indexOf(currentCefr) > CEFR_ORDER.indexOf(baselineCefr);
  const scoreGrowth  = current - baseline;

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>{t("your_journey")}</div>
        <div style={{ fontSize: 10, color: COLORS.textDim }}>{days} {t("days_learning")}</div>
      </div>

      {/* Score comparison */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        {/* Baseline */}
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, letterSpacing: 1 }}>{t("start_label")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.textMuted }}>{baseline}</div>
          {baselineCefr && <div style={{ fontSize: 10, color: CEFR_COLOR[baselineCefr] ?? COLORS.textDim, marginTop: 2 }}>{baselineCefr}</div>}
        </div>

        {/* Arrow + delta */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 20 }}>→</div>
          <div style={{ fontSize: 12, marginTop: 2 }}>
            <ScoreDelta baseline={baseline} current={current} />
          </div>
        </div>

        {/* Current */}
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 4, letterSpacing: 1 }}>{t("today_label")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: scoreGrowth >= 0 ? "#22c55e" : COLORS.text }}>{current}</div>
          {currentCefr && <div style={{ fontSize: 10, color: CEFR_COLOR[currentCefr] ?? COLORS.textDim, marginTop: 2 }}>{currentCefr}</div>}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: "#1e1e1e", borderRadius: 3, overflow: "hidden", marginBottom: 12 }}>
        <div style={{
          height: "100%",
          width: `${Math.min(current, 100)}%`,
          background: `linear-gradient(to right, ${CEFR_COLOR[currentCefr] ?? COLORS.red}, ${CEFR_COLOR[currentCefr] ?? COLORS.red}88)`,
          borderRadius: 3,
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[
          ["🔥", `${streak}d ${t("streak_label")}`],
          ["📈", scoreGrowth > 0 ? `+${scoreGrowth} ${t("pts_label")}` : t("tracking")],
          cefrImproved ? ["⭐", `${baselineCefr} → ${currentCefr}`] : ["🎯", CEFR_LABEL[currentCefr] ?? ""],
        ].map(([icon, label], i) => (
          <div key={i} style={{
            flex: 1, textAlign: "center", padding: "8px 4px",
            background: "#0d0d0d", borderRadius: 8, border: "1px solid #1e1e1e",
          }}>
            <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted, fontWeight: 600 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Eiken + TOEIC equivalents for current level */}
      {currentCefr && CEFR_META[currentCefr] && (() => {
        const meta  = CEFR_META[currentCefr];
        const color = meta.color;
        return (
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1, padding: "7px 8px", background: "#0d0d0d", border: `1px solid ${color}33`, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 1, marginBottom: 3 }}>英検</div>
              <div style={{ fontSize: 11, fontWeight: 700, color }}>{lang === "jp" ? meta.eiken : meta.eikenEn}</div>
            </div>
            <div style={{ flex: 1, padding: "7px 8px", background: "#0d0d0d", border: `1px solid ${color}33`, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 1, marginBottom: 3 }}>TOEIC</div>
              <div style={{ fontSize: 11, fontWeight: 700, color }}>{meta.toeic}</div>
            </div>
            <div style={{ flex: 1, padding: "7px 8px", background: "#0d0d0d", border: `1px solid ${color}33`, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 1, marginBottom: 3 }}>CEFR</div>
              <div style={{ fontSize: 11, fontWeight: 700, color }}>{currentCefr}</div>
            </div>
          </div>
        );
      })()}

      {cefrImproved && (
        <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 8, fontSize: 12, color: "#C9A84C", textAlign: "center" }}>
          🎉 {t("level_up").replace("{from}", baselineCefr).replace("{to}", currentCefr)}
        </div>
      )}
    </div>
  );
}
