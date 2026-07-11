import { useState } from "react";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";
import { CATEGORY_MAP } from "./data";
import { srt } from "./i18n";
import { getSavedPhrases, deleteSavedPhrase } from "./storage";

export default function SavedPhrases({ user, onExit }) {
  const { lang } = useLang();
  const tr = (k) => srt(lang, k);
  const jp = lang === "jp";
  const [phrases, setPhrases] = useState(() => getSavedPhrases(user?.uid));

  const remove = (id) => setPhrases(deleteSavedPhrase(user?.uid, id));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 60px" }}>
      <button onClick={onExit} style={backBtnStyle}>{tr("back_to_speak_ready")}</button>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "20px 0 6px" }}>{tr("saved_phrases")}</h1>
      <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 24 }}>
        {tr("saved_phrases_desc_full")}
      </p>

      {phrases.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px", background: COLORS.card,
          border: "1px solid #1e1e1e", borderRadius: 14,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 14, color: COLORS.textMuted }}>{tr("nothing_saved")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {phrases.map((p) => {
            const cat = CATEGORY_MAP[p.category];
            const catName = jp && cat?.nameJp ? cat.nameJp : (cat?.name ?? tr("category_fallback"));
            return (
              <div key={p.id} style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 16 }}>{cat?.icon ?? "🗣️"}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: cat?.color ?? COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 }}>
                    {catName}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>{p.situation}</div>
                <div style={{ background: "#0d0d0d", border: "1px solid #222", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontWeight: 600, lineHeight: 1.6, marginBottom: 10 }}>
                  {p.phrase}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: COLORS.textDim }}>
                    {new Date(p.savedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => remove(p.id)}
                    style={{ background: "none", border: "none", color: "#ff6b6b", fontSize: 11, cursor: "pointer" }}
                  >
                    {tr("delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const backBtnStyle = {
  background: "none", border: "none", color: COLORS.textMuted,
  fontSize: 13, cursor: "pointer", padding: 0,
};
