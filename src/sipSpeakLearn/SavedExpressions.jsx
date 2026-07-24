// Sip Speak Learn — Saved Expressions screen (Phase 2)
import { useState } from "react";
import { SSL } from "./constants";
import { Icon, Btn } from "./ui";
import { SEASON_MAP } from "./data";
import { getSavedExpressions, removeExpression } from "./storage";
import { speakLine } from "./audio";

export default function SavedExpressions({ uid, go }) {
  const [items, setItems] = useState(() => getSavedExpressions(uid));

  const remove = (text) => setItems(removeExpression(uid, text));

  if (items.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "60px 20px", minHeight: "60vh" }}>
        <div style={{ width: 52, height: 52, color: SSL.copper, marginBottom: 16 }}>{Icon.bookmark}</div>
        <h1 className="ssl-serif" style={{ fontSize: "clamp(24px,3.4vw,34px)", fontWeight: 600 }}>No saved expressions yet</h1>
        <p style={{ color: SSL.inkSoft, maxWidth: 440, marginTop: 12, lineHeight: 1.6 }}>
          During the SEE step of any lesson, tap <strong>Save</strong> on a phrase and it will collect here for quick review.
        </p>
        <Btn onClick={() => go("seasons")} style={{ marginTop: 24 }}>Browse seasons</Btn>
      </div>
    );
  }

  return (
    <>
      <h1 className="ssl-serif" style={{ fontSize: "clamp(26px,3.8vw,42px)", fontWeight: 600 }}>Saved Expressions</h1>
      <p style={{ color: SSL.inkSoft, marginTop: 4, marginBottom: 22 }}>{items.length} phrase{items.length === 1 ? "" : "s"} to keep in your pocket.</p>

      <div className="ssl-grid2">
        {items.map((e) => {
          const season = SEASON_MAP[e.season];
          return (
            <div key={e.text} className="ssl-card" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div className="ssl-serif" style={{ fontSize: 19, lineHeight: 1.25 }}>{e.text}</div>
                <button onClick={() => speakLine(e.text)} className="ssl-focusable" aria-label="Play"
                  style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, border: "none", background: SSL.teal, color: "#fff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ width: 17, height: 17 }}>{Icon.play}</span>
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <span style={{ fontSize: 12.5, color: SSL.textMuted }}>
                  {season ? `${season.icon} ${season.name}` : ""}{e.theme ? ` · ${e.theme}` : ""}
                </span>
                <button onClick={() => remove(e.text)} className="ssl-focusable"
                  style={{ background: "none", border: "none", color: SSL.textMuted, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
