import { useState } from "react";
import { COLORS } from "../constants/colors";

// Events are hardcoded for now — swap for Firestore fetch when you have real events
const EVENTS = [
  {
    id: "speaking_night_jul",
    title: "HSD Speaking Night",
    type: "live",
    date: "2026-07-04",
    time: "20:00 JST",
    duration: "60 min",
    host: "Jonathan",
    desc: "Live group speaking session. Practise real conversation with other HSD members. All levels welcome.",
    tags: ["speaking", "all levels"],
    color: COLORS.red,
    icon: "🎤",
    spots: 12,
    spotsLeft: 8,
    link: "https://discord.gg/bXTF9B4X",
  },
  {
    id: "eiken_prep_jul",
    title: "Eiken Prep Workshop",
    type: "live",
    date: "2026-07-11",
    time: "19:00 JST",
    duration: "90 min",
    host: "Jona AI + Jonathan",
    desc: "Intensive Eiken exam preparation. We'll cover essay writing, interview techniques, and vocabulary for Grade 2 and Pre-1.",
    tags: ["eiken", "intermediate", "advanced"],
    color: COLORS.gold,
    icon: "📝",
    spots: 20,
    spotsLeft: 15,
    link: "https://discord.gg/bXTF9B4X",
  },
  {
    id: "kids_phonics_jul",
    title: "Kids Phonics Live",
    type: "live",
    date: "2026-07-18",
    time: "15:00 JST",
    duration: "45 min",
    host: "Jonathan",
    desc: "Interactive phonics session for kids aged 4-10. Songs, games, and lots of fun English sounds.",
    tags: ["kids", "phonics", "beginner"],
    color: "#4488ff",
    icon: "👶",
    spots: 15,
    spotsLeft: 10,
    link: "https://discord.gg/bXTF9B4X",
  },
  {
    id: "challenge_jul",
    title: "July Streak Challenge",
    type: "challenge",
    date: "2026-07-01",
    endDate: "2026-07-31",
    time: "All month",
    duration: "31 days",
    host: "HSD Community",
    desc: "Maintain a 31-day streak through July. Everyone who completes it gets the Founding Member badge + 2,000 bonus XP.",
    tags: ["streak", "community", "all levels"],
    color: COLORS.success,
    icon: "🔥",
    spots: null,
    spotsLeft: null,
    link: "https://discord.gg/bXTF9B4X",
  },
  {
    id: "coffee_english_aug",
    title: "Coffee English ☕",
    type: "live",
    date: "2026-08-01",
    time: "08:00 JST",
    duration: "30 min",
    host: "Jonathan",
    desc: "Start your morning with a casual 30-minute English chat over coffee. No prep needed — just show up and talk.",
    tags: ["speaking", "casual", "adult"],
    color: "#7B5EA7",
    icon: "☕",
    spots: 8,
    spotsLeft: 8,
    link: "https://discord.gg/bXTF9B4X",
  },
];

const TYPE_COLORS = { live: COLORS.red, challenge: COLORS.success, workshop: COLORS.gold };
const TYPE_LABELS = { live: "Live Event", challenge: "Challenge", workshop: "Workshop" };

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return "Ended";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `In ${diff} days`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tokyo" });
}

export default function Events({ user }) {
  const [filter, setFilter] = useState("upcoming");

  const now    = new Date(); now.setHours(0,0,0,0);
  const upcoming = EVENTS.filter((e) => new Date(e.endDate ?? e.date) >= now);
  const past     = EVENTS.filter((e) => new Date(e.endDate ?? e.date) <  now);
  const list     = filter === "upcoming" ? upcoming : past;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>

      {/* Banner */}
      <div style={{ background: "linear-gradient(135deg, #1a0000, #0d0000)", border: "1px solid rgba(224,16,16,0.25)", borderRadius: 14, padding: 20, marginBottom: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <img src="/assets/jona.png" alt="Jona" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", filter: "drop-shadow(0 0 10px rgba(224,16,16,0.6))", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>HSD Community Events</div>
          <div style={{ fontSize: 13, color: COLORS.textMuted, lineHeight: 1.5 }}>
            Live sessions, challenges & workshops — all free for members.<br />
            Join on <a href="https://discord.gg/bXTF9B4X" target="_blank" rel="noreferrer" style={{ color: COLORS.red, fontWeight: 600 }}>Discord</a> to get event notifications.
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "upcoming", label: `Upcoming (${upcoming.length})` },
          { id: "past",     label: `Past (${past.length})`         },
        ].map((t) => (
          <button key={t.id} onClick={() => setFilter(t.id)} style={{
            padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: filter === t.id ? 700 : 400,
            background: filter === t.id ? COLORS.red : "transparent",
            border: `1px solid ${filter === t.id ? COLORS.red : "#2a2a2a"}`,
            color: filter === t.id ? "#fff" : COLORS.textMuted,
            cursor: "pointer", transition: "all 0.2s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Event cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", fontSize: 13, color: COLORS.textMuted }}>No events here yet — check back soon.</div>
        )}
        {list.map((ev) => {
          const countdown = daysUntil(ev.date);
          const isToday   = countdown === "Today";
          const isPast    = countdown === "Ended";
          return (
            <div key={ev.id} style={{
              background: COLORS.card, border: `1px solid ${isToday ? ev.color + "66" : "#1e1e1e"}`,
              borderRadius: 14, padding: 18, transition: "all 0.2s",
              boxShadow: isToday ? `0 0 20px ${ev.color}22` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                {/* Icon */}
                <div style={{ width: 50, height: 50, borderRadius: 12, background: `${ev.color}18`, border: `1px solid ${ev.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                  {ev.icon}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 700 }}>{ev.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: TYPE_COLORS[ev.type] ?? COLORS.red, border: `1px solid ${TYPE_COLORS[ev.type] ?? COLORS.red}44`, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: 1 }}>
                      {TYPE_LABELS[ev.type] ?? ev.type}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8, lineHeight: 1.5 }}>{ev.desc}</div>

                  {/* Meta row */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11, color: COLORS.textDim, marginBottom: 10 }}>
                    <span>📅 {formatDate(ev.date)}</span>
                    <span>🕐 {ev.time}</span>
                    <span>⏱ {ev.duration}</span>
                    <span>👤 {ev.host}</span>
                    {ev.spotsLeft !== null && <span style={{ color: ev.spotsLeft <= 3 ? COLORS.red : COLORS.textDim }}>🪑 {ev.spotsLeft} spots left</span>}
                  </div>

                  {/* Tags */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {ev.tags.map((tag) => (
                      <span key={tag} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "#1a1a1a", border: "1px solid #2a2a2a", color: COLORS.textDim }}>
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* CTA */}
                  {!isPast && (
                    <a href={ev.link} target="_blank" rel="noreferrer" style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 16px", borderRadius: 8,
                      background: isToday ? ev.color : "transparent",
                      border: `1px solid ${ev.color}`,
                      color: isToday ? "#fff" : ev.color,
                      fontSize: 12, fontWeight: 600, textDecoration: "none",
                      transition: "all 0.2s",
                    }}>
                      {isToday ? "Join Now →" : "Register on Discord →"}
                    </a>
                  )}
                </div>

                {/* Countdown badge */}
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isPast ? COLORS.textDim : isToday ? ev.color : COLORS.text }}>{countdown}</div>
                  {isToday && <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.color, margin: "4px auto 0", animation: "pulse 1.5s ease-in-out infinite" }} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 12, color: COLORS.textDim }}>
        New events added monthly · <a href="https://discord.gg/bXTF9B4X" target="_blank" rel="noreferrer" style={{ color: COLORS.red }}>Join Discord for early access</a>
      </div>

      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}
