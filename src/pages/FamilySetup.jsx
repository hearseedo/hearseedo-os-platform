import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { COLORS } from "../constants/colors";

const KIDS_APPS = [
  { id: "wondercamp", label: "Wondercamp",         labelJp: "ワンダーキャンプ",       icon: "🏕️", desc: "Songs, games & stories for early learners",   descJp: "歌・ゲーム・物語で英語を楽しむ",       ageHint: "Ages 3–7"  },
  { id: "phonics",    label: "Monkey Yoga Phonics", labelJp: "モンキーヨガフォニックス", icon: "🎵", desc: "Phonics through movement and music",           descJp: "体を動かしながらフォニックスを学ぶ",     ageHint: "Ages 4–10" },
  { id: "eiken",      label: "EIKEN AI Monkey",     labelJp: "英検AIモンキー",         icon: "🐒", desc: "AI-powered EIKEN prep Grade 5 to Pre-1",     descJp: "英検5級〜準1級のAI対策",               ageHint: "Ages 8+"   },
];

const AGE_APP_MAP = {
  "3": "wondercamp", "4": "wondercamp", "5": "wondercamp", "6": "wondercamp", "7": "wondercamp",
  "8": "phonics",    "9": "phonics",    "10": "phonics",   "11": "phonics",   "12": "phonics",
};

export default function FamilySetup() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  const [phase, setPhase]           = useState("choice");   // "choice" | "child_name" | "child_app"
  const [childName, setChildName]   = useState("");
  const [childAge, setChildAge]     = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [setupError, setSetupError] = useState("");
  const [consented, setConsented]   = useState(false);
  const [lang, setLang]             = useState("en");

  const jp = lang === "jp";

  function recommendedApp(age) {
    return AGE_APP_MAP[String(age)] ?? "eiken";
  }

  function handleAgeChange(val) {
    setChildAge(val);
    if (val && !selectedApp) {
      setSelectedApp(recommendedApp(parseInt(val, 10)));
    }
  }

  async function chooseJustMe() {
    await setDoc(doc(db, "users", user.uid), {
      setupDone: true,
      accountType: "individual",
    }, { merge: true }).catch(() => {});
    navigate("/assessment");
  }

  function chooseFamily() {
    setPhase("child_name");
  }

  async function finishSetup() {
    if (!childName.trim() || saving) return;
    setSaving(true);
    setSetupError("");
    try {
      const app = selectedApp ?? (childAge ? recommendedApp(parseInt(childAge, 10)) : "wondercamp");
      await addDoc(collection(db, "users", user.uid, "familyMembers"), {
        name:            childName.trim(),
        age:             childAge ? parseInt(childAge, 10) : null,
        primaryApp:      app,
        confidenceScore: 0,
        cefr:            null,
        assessmentDone:  false,
        createdAt:       serverTimestamp(),
        consentGiven:    true,
        consentedAt:     serverTimestamp(),
        consentedByUid:  user.uid,
      });
      await setDoc(doc(db, "users", user.uid), {
        setupDone:   true,
        accountType: "family",
      }, { merge: true });
      navigate("/dashboard", { replace: true, state: { assessmentJustDone: true } });
    } catch (e) {
      console.error("FamilySetup error:", e);
      setSetupError(jp ? "エラーが発生しました。もう一度お試しください。" : "Something went wrong. Please try again.");
    }
    setSaving(false);
  }

  if (!user) return null;

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      position: "relative",
    }}>
      {/* Background grid */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(224,16,16,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(224,16,16,0.03) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

      {/* Language toggle */}
      <div style={{ position: "absolute", top: 20, right: 20, display: "flex", background: "#111", border: "1px solid #2a2a2a", borderRadius: 6, overflow: "hidden" }}>
        {["en", "jp"].map(l => (
          <button key={l} onClick={() => setLang(l)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, background: lang === l ? COLORS.red : "transparent", border: "none", color: lang === l ? "#fff" : COLORS.textMuted, cursor: "pointer" }}>
            {l === "en" ? "EN" : "日本語"}
          </button>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <img src="/assets/logo.png" alt="HSD OS" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", marginBottom: 12, filter: "drop-shadow(0 0 8px rgba(224,16,16,0.4))" }} />
          <div style={{ fontSize: 11, color: COLORS.red, letterSpacing: 4, textTransform: "uppercase" }}>HEAR SEE DO™</div>
          <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 3 }}>OS AI</div>
        </div>

        {/* ── PHASE: CHOICE ─────────────────────────────────────────────── */}
        {phase === "choice" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                {jp ? `${firstName}さん、ようこそ！` : `Welcome, ${firstName}.`}
              </div>
              <div style={{ fontSize: 14, color: COLORS.textMuted, lineHeight: 1.7 }}>
                {jp ? "このアカウントは誰のためですか？" : "Who is this account for?"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Just me */}
              <button
                onClick={chooseJustMe}
                style={{ padding: "28px 20px", background: COLORS.card, border: "1px solid #2a2a2a", borderRadius: 16, cursor: "pointer", textAlign: "center", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.red; e.currentTarget.style.background = "rgba(224,16,16,0.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a2a2a"; e.currentTarget.style.background = COLORS.card; }}
              >
                <div style={{ fontSize: 40 }}>👤</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                  {jp ? "自分のため" : "Just me"}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
                  {jp ? "大人の英語学習者" : "I'm learning English for myself"}
                </div>
              </button>

              {/* My family */}
              <button
                onClick={chooseFamily}
                style={{ padding: "28px 20px", background: COLORS.card, border: `1px solid ${COLORS.red}`, borderRadius: 16, cursor: "pointer", textAlign: "center", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, boxShadow: "0 0 24px rgba(224,16,16,0.12)" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,16,16,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = COLORS.card; }}
              >
                <div style={{ fontSize: 40 }}>👨‍👩‍👧‍👦</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.red }}>
                  {jp ? "家族のため" : "My family"}
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5 }}>
                  {jp ? "子どものために登録する" : "I'm signing up for my child"}
                </div>
              </button>
            </div>

            <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: COLORS.textDim }}>
              {jp ? "後で変更できます" : "You can change this later"}
            </div>
          </>
        )}

        {/* ── PHASE: CHILD NAME + AGE ───────────────────────────────────── */}
        {phase === "child_name" && (
          <>
            <StepBar step={1} total={2} jp={jp} />

            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {jp ? "お子さんのプロフィールを作りましょう" : "Let's set up your child's profile"}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                {jp ? "後でいつでも変更できます" : "You can always edit this later"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 28 }}>
              <div>
                <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 8 }}>
                  {jp ? "お子さんの名前" : "Child's name"} *
                </label>
                <input
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && childName.trim() && setPhase("child_app")}
                  placeholder={jp ? "例：ゆき" : "e.g. Yuki"}
                  autoFocus
                  style={{ width: "100%", padding: "14px 16px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.text, fontSize: 16, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = COLORS.red}
                  onBlur={e => e.target.style.borderColor = "#2a2a2a"}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 8 }}>
                  {jp ? "年齢（任意）" : "Age (optional)"}
                </label>
                <input
                  value={childAge}
                  onChange={e => handleAgeChange(e.target.value)}
                  placeholder={jp ? "例：5" : "e.g. 5"}
                  type="number" min="1" max="18"
                  style={{ width: "100%", padding: "14px 16px", background: "#111", border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.text, fontSize: 16, outline: "none", boxSizing: "border-box", transition: "border-color 0.15s" }}
                  onFocus={e => e.target.style.borderColor = COLORS.red}
                  onBlur={e => e.target.style.borderColor = "#2a2a2a"}
                />
                {childAge && (
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 6 }}>
                    {jp ? `おすすめ: ${KIDS_APPS.find(a => a.id === recommendedApp(parseInt(childAge, 10)))?.labelJp ?? ""}` : `Recommended: ${KIDS_APPS.find(a => a.id === recommendedApp(parseInt(childAge, 10)))?.label ?? ""}`}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setPhase("choice")}
                style={{ padding: "13px 20px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.textMuted, fontSize: 14, cursor: "pointer" }}
              >
                ← {jp ? "戻る" : "Back"}
              </button>
              <button
                onClick={() => {
                  if (!childName.trim()) return;
                  if (!selectedApp) {
                    setSelectedApp(childAge ? recommendedApp(parseInt(childAge, 10)) : "wondercamp");
                  }
                  setPhase("child_app");
                }}
                disabled={!childName.trim()}
                style={{ flex: 1, padding: "13px 20px", background: childName.trim() ? COLORS.red : "#333", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: childName.trim() ? "pointer" : "not-allowed", transition: "background 0.15s" }}
              >
                {jp ? "次へ →" : "Continue →"}
              </button>
            </div>
          </>
        )}

        {/* ── PHASE: APP SELECTION ──────────────────────────────────────── */}
        {phase === "child_app" && (
          <>
            <StepBar step={2} total={2} jp={jp} />

            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                {jp ? `${childName}さんにぴったりのアプリは？` : `Which app is right for ${childName}?`}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted }}>
                {jp ? "後で変更・追加できます" : "You can change or add more later"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
              {KIDS_APPS.map(app => {
                const isSelected = selectedApp === app.id;
                const isRecommended = childAge && recommendedApp(parseInt(childAge, 10)) === app.id;
                return (
                  <button
                    key={app.id}
                    onClick={() => setSelectedApp(app.id)}
                    style={{ display: "flex", alignItems: "center", gap: 16, padding: 18, background: isSelected ? "rgba(224,16,16,0.1)" : COLORS.card, border: `1px solid ${isSelected ? COLORS.red : "#2a2a2a"}`, borderRadius: 14, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
                  >
                    <div style={{ fontSize: 32, flexShrink: 0 }}>{app.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: isSelected ? COLORS.red : COLORS.text }}>{jp ? app.labelJp : app.label}</span>
                        {isRecommended && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4, padding: "2px 7px" }}>
                            {jp ? "おすすめ" : "Recommended"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textMuted }}>{jp ? app.descJp : app.desc}</div>
                      <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 2 }}>{app.ageHint}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isSelected ? COLORS.red : "#333"}`, background: isSelected ? COLORS.red : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Parent consent */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", background: "rgba(224,16,16,0.05)", border: `1px solid ${consented ? "rgba(224,16,16,0.4)" : "#2a2a2a"}`, borderRadius: 10, cursor: "pointer", marginBottom: 16, transition: "border-color 0.15s" }}>
              <input
                type="checkbox"
                checked={consented}
                onChange={e => setConsented(e.target.checked)}
                style={{ marginTop: 2, accentColor: COLORS.red, width: 16, height: 16, flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.6 }}>
                {jp
                  ? `私は${childName}の保護者であり、HSD OSがこの子どものために学習データを収集・利用することに同意します。`
                  : `I am the parent or guardian of ${childName} and consent to HSD OS collecting and using learning data on their behalf as described in the Privacy Policy.`}
              </span>
            </label>

            {setupError && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(224,16,16,0.08)", border: "1px solid rgba(224,16,16,0.3)", borderRadius: 8, fontSize: 13, color: "#ff6060", textAlign: "center" }}>
                {setupError}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setPhase("child_name")}
                style={{ padding: "13px 20px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 10, color: COLORS.textMuted, fontSize: 14, cursor: "pointer" }}
              >
                ← {jp ? "戻る" : "Back"}
              </button>
              <button
                onClick={finishSetup}
                disabled={saving || !consented}
                style={{ flex: 1, padding: "13px 20px", background: (!consented || saving) ? "#333" : COLORS.red, border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: (!consented || saving) ? "not-allowed" : "pointer", transition: "background 0.15s", boxShadow: consented ? "0 4px 20px rgba(224,16,16,0.35)" : "none" }}
              >
                {saving
                  ? (jp ? "設定中…" : "Setting up…")
                  : (jp ? `${childName}のダッシュボードへ →` : `Go to ${childName}'s dashboard →`)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StepBar({ step, total, jp }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ width: i + 1 === step ? 24 : 8, height: 8, borderRadius: 4, background: i + 1 <= step ? COLORS.red : "#2a2a2a", transition: "all 0.3s" }} />
      ))}
      <span style={{ fontSize: 11, color: COLORS.textDim, marginLeft: 8 }}>
        {jp ? `${step} / ${total}` : `Step ${step} of ${total}`}
      </span>
    </div>
  );
}
