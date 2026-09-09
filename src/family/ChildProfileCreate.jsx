// Parent creates a child profile (item 4). Short, minimal-data-collection
// form — age BAND (not exact birth date), interests, one confidence goal.
// Writes via the existing src/lib/profiles.js createProfile(), the same
// owner-only familyMembers subcollection every other profile write already uses.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useLang } from "../hooks/useLang";
import { FAMILY_COLORS } from "./theme";
import { AGE_BANDS } from "./content";
import { createProfile } from "../lib/profiles";
import { logPathwayEvent, PATHWAY_EVENTS } from "../lib/pathwayAnalytics";

const INTERESTS = [
  { id: "music",    en: "Music & Songs",   jp: "音楽・歌",   icon: "🎵" },
  { id: "stories",  en: "Stories",          jp: "お話",       icon: "📖" },
  { id: "movement", en: "Movement & Games", jp: "運動・ゲーム", icon: "🤸" },
  { id: "art",      en: "Drawing & Art",    jp: "絵・アート", icon: "🎨" },
  { id: "animals",  en: "Animals",          jp: "動物",       icon: "🐾" },
];

export default function ChildProfileCreate() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [ageBand, setAgeBand] = useState(null);
  const [interests, setInterests] = useState([]);
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleInterest(id) {
    setInterests(i => i.includes(id) ? i.filter(x => x !== id) : [...i, id]);
  }

  async function handleSubmit() {
    if (!name.trim() || !ageBand || saving) return;
    setSaving(true);
    try {
      const ref = await createProfile(user.uid, { name, ageBand, interests, confidenceGoal: goal || null, relationship: "child" });
      logPathwayEvent(user.uid, PATHWAY_EVENTS.PROFILE_CREATED, { profileId: ref.id });
      navigate("/family/home");
    } catch {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: FAMILY_COLORS.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: "40px 20px" }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: FAMILY_COLORS.pink, marginBottom: 24, textAlign: "center" }}>{t("fam_add_child")}</h1>

        <label style={labelStyle}>{t("fam_child_name")}</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />

        <label style={labelStyle}>{t("fam_age_band")}</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {AGE_BANDS.map(b => (
            <button key={b.id} onClick={() => setAgeBand(b.id)} style={{
              padding: "12px 10px", borderRadius: 12, border: `2px solid ${ageBand === b.id ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
              background: ageBand === b.id ? FAMILY_COLORS.pinkSoft : "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, color: FAMILY_COLORS.text,
            }}>
              {lang === "jp" ? b.labelJp : b.label}<br /><span style={{ fontWeight: 400, fontSize: 11, color: FAMILY_COLORS.textMuted }}>({b.range})</span>
            </button>
          ))}
        </div>

        <label style={labelStyle}>{t("fam_interests")}</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {INTERESTS.map(i => (
            <button key={i.id} onClick={() => toggleInterest(i.id)} style={{
              padding: "8px 14px", borderRadius: 20, border: `2px solid ${interests.includes(i.id) ? FAMILY_COLORS.pink : FAMILY_COLORS.border}`,
              background: interests.includes(i.id) ? FAMILY_COLORS.pinkSoft : "#fff", cursor: "pointer", fontSize: 13,
            }}>
              {i.icon} {lang === "jp" ? i.jp : i.en}
            </button>
          ))}
        </div>

        <label style={labelStyle}>{t("fam_confidence_goal")}</label>
        <input value={goal} onChange={e => setGoal(e.target.value)} style={inputStyle} placeholder={lang === "jp" ? "例：もっと自信を持って話せるようになる" : "e.g. Speak more confidently"} />

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !ageBand || saving}
          style={{
            width: "100%", padding: 16, borderRadius: 14, border: "none", marginTop: 16,
            background: name.trim() && ageBand ? FAMILY_COLORS.pink : "#e0d0da",
            color: "#fff", fontWeight: 800, fontSize: 15, cursor: name.trim() && ageBand ? "pointer" : "default",
          }}
        >
          {t("fam_create_profile")}
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: FAMILY_COLORS.textMuted, marginBottom: 6, marginTop: 4 };
const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 12, border: `2px solid ${FAMILY_COLORS.border}`, fontSize: 15, marginBottom: 16, boxSizing: "border-box" };
