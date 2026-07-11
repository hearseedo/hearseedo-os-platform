import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLORS } from "../constants/colors";
import { useLang } from "../hooks/useLang";

const MEDAL = ["🥇", "🥈", "🥉"];

export default function Leaderboard({ currentUid }) {
  const { t, lang } = useLang();
  const [entries, setEntries] = useState(null);
  const [tab, setTab]         = useState("all"); // "all" | "weekly"

  useEffect(() => {
    const field = tab === "weekly" ? "weeklyXp" : "xpEarned";
    const q = query(
      collection(db, "users"),
      orderBy(field, "desc"),
      limit(10)
    );
    getDocs(q)
      .then(snap => {
        setEntries(
          snap.docs.map(d => ({
            uid:            d.id,
            name:           d.data().name?.split(" ")[0] ?? "—",
            xp:             d.data()[field] ?? 0,
            isFounder:      d.data().isFoundingMember ?? false,
            founderNum:     d.data().foundingMemberNumber ?? null,
            confidenceScore: d.data().confidenceScore ?? 0,
          }))
        );
      })
      .catch(() => setEntries([]));
  }, [tab]);

  const title = lang === "jp" ? "ファミリーランキング" : "Family Leaderboard";
  const tabLabels = lang === "jp"
    ? { all: "総合", weekly: "今週" }
    : { all: "All‑Time", weekly: "This Week" };

  return (
    <div style={{ background: COLORS.card, border: "1px solid #1e1e1e", borderRadius: 12, padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.red, letterSpacing: 2, textTransform: "uppercase" }}>
          🏆 {title}
        </div>
        {/* Tab toggle */}
        <div style={{ display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, overflow: "hidden" }}>
          {["all", "weekly"].map(key => (
            <button
              key={key}
              onClick={() => { setEntries(null); setTab(key); }}
              style={{
                padding: "3px 10px", fontSize: 10, fontWeight: 700,
                background: tab === key ? COLORS.red : "transparent",
                border: "none", color: tab === key ? "#fff" : COLORS.textMuted,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {tabLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      {entries === null ? (
        <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", padding: "12px 0" }}>
          {lang === "jp" ? "読み込み中…" : "Loading…"}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: 12, color: COLORS.textMuted, textAlign: "center", padding: "12px 0" }}>
          {lang === "jp" ? "まだデータがありません" : "No data yet — start learning!"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {entries.map((e, i) => {
            const isMe = e.uid === currentUid;
            return (
              <div
                key={e.uid}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 10px", borderRadius: 8,
                  background: isMe ? "rgba(224,16,16,0.1)" : "transparent",
                  border: isMe ? "1px solid rgba(224,16,16,0.3)" : "1px solid transparent",
                  transition: "background 0.15s",
                }}
              >
                {/* Rank */}
                <div style={{ width: 22, textAlign: "center", fontSize: i < 3 ? 16 : 12, flexShrink: 0, color: i < 3 ? "" : COLORS.textMuted, fontWeight: 700 }}>
                  {i < 3 ? MEDAL[i] : `${i + 1}`}
                </div>

                {/* Avatar */}
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: isMe
                    ? "linear-gradient(135deg,#8b0000,#e01010)"
                    : "linear-gradient(135deg,#1a1a1a,#2a2a2a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>
                  {e.name?.[0]?.toUpperCase()}
                </div>

                {/* Name + badge */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: isMe ? 700 : 500, color: isMe ? COLORS.red : COLORS.text, display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.name}{isMe && (lang === "jp" ? "（あなた）" : " (you)")}
                    </span>
                    {e.isFounder && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: "#C9A84C", background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", borderRadius: 3, padding: "1px 4px", flexShrink: 0 }}>
                        #{String(e.founderNum ?? "").padStart(3, "0")}
                      </span>
                    )}
                  </div>
                </div>

                {/* XP */}
                <div style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? "#C9A84C" : COLORS.textMuted, flexShrink: 0 }}>
                  {e.xp.toLocaleString()} <span style={{ fontSize: 9, fontWeight: 400 }}>pts</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: 10, fontSize: 10, color: COLORS.textDim, textAlign: "center", lineHeight: 1.5 }}>
        {lang === "jp"
          ? "ミッションを完了してHSDポイントを獲得しよう"
          : "Complete missions & lessons to climb the board"}
      </div>
    </div>
  );
}
