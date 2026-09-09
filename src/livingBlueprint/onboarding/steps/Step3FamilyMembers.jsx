import { useState } from "react";
import { TOKENS } from "../../../constants/tokens";
import { useMobile } from "../../../hooks/useMobile";
import { useLang } from "../../../hooks/useLang";
import StepShell from "./StepShell";

// Rebuild prompt section 5, Step 3 — Add family members (only when "My
// Family" was selected in Step 2). Household node in the center, members
// arranged around it on desktop; a vertical list on mobile to avoid
// overlapping labels, per spec.

const RELATIONSHIP_KEYS = ["lb_rel_parent", "lb_rel_child", "lb_rel_partner", "lb_rel_other"];

function uid() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export default function Step3FamilyMembers({ members, onChange, onBack, onNext }) {
  const isMobile = useMobile();
  const { t } = useLang();
  const RELATIONSHIPS = RELATIONSHIP_KEYS.map(t);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ name: "", role: RELATIONSHIPS[1], age: "" });

  const startAdd = () => { setDraft({ name: "", role: RELATIONSHIPS[1], age: "" }); setEditingId("new"); };
  const startEdit = (m) => { setDraft({ name: m.name, role: m.role, age: m.age }); setEditingId(m.id); };
  const cancelEdit = () => setEditingId(null);

  const saveDraft = () => {
    if (!draft.name.trim()) return;
    if (editingId === "new") {
      onChange([...members, { id: uid(), ...draft, name: draft.name.trim() }]);
    } else {
      onChange(members.map(m => (m.id === editingId ? { ...m, ...draft, name: draft.name.trim() } : m)));
    }
    setEditingId(null);
  };

  const removeMember = (id) => onChange(members.filter(m => m.id !== id));

  const radius = 130;
  const angleFor = (i, n) => (2 * Math.PI * i) / n - Math.PI / 2;

  return (
    <StepShell
      title={t("lb_whos_in_family")}
      subtitle={t("lb_add_each_person")}
      step={3}
      onBack={onBack}
      onContinue={onNext}
      continueDisabled={members.length === 0}
    >
      {isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <HouseholdNode compact />
          {members.map(m => (
            <MemberRow key={m.id} member={m} onEdit={() => startEdit(m)} onRemove={() => removeMember(m.id)} />
          ))}
        </div>
      ) : (
        <div style={{ position: "relative", height: 340, marginBottom: 8 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
            <HouseholdNode />
          </div>
          {members.map((m, i) => {
            const angle = angleFor(i, members.length);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div key={m.id} style={{
                position: "absolute", top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`,
                transform: "translate(-50%,-50%)",
              }}>
                <svg width={340} height={340} style={{ position: "absolute", top: -170, left: -170, pointerEvents: "none", zIndex: 0 }}>
                  <line x1={170} y1={170} x2={170 - x} y2={170 - y} stroke="rgba(201,168,76,0.25)" strokeWidth={1} />
                </svg>
                <MemberOrb member={m} onEdit={() => startEdit(m)} onRemove={() => removeMember(m.id)} />
              </div>
            );
          })}
        </div>
      )}

      {editingId ? (
        <div style={{ marginTop: 16, padding: 16, borderRadius: TOKENS.radius.lg, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: isMobile ? "1fr" : "2fr 1.4fr 1fr" }}>
            <input
              placeholder={t("lb_placeholder_name")}
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              style={inputStyle}
              autoFocus
            />
            <select value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })} style={inputStyle}>
              {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              placeholder={t("age_optional")}
              value={draft.age}
              onChange={e => setDraft({ ...draft, age: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
            <button onClick={cancelEdit} style={{ padding: "8px 16px", borderRadius: TOKENS.radius.md, border: `1px solid ${TOKENS.color.border}`, background: "transparent", color: TOKENS.color.textMuted, cursor: "pointer" }}>{t("cancel")}</button>
            <button onClick={saveDraft} disabled={!draft.name.trim()} style={{ padding: "8px 16px", borderRadius: TOKENS.radius.md, border: "none", background: TOKENS.color.gold, color: "#0a0a0a", fontWeight: 700, cursor: "pointer" }}>{t("save")}</button>
          </div>
        </div>
      ) : (
        <button onClick={startAdd} style={{
          width: "100%", padding: "12px 16px", borderRadius: TOKENS.radius.lg, cursor: "pointer",
          border: `1px dashed ${TOKENS.color.border}`, background: "transparent", color: TOKENS.color.gold, fontWeight: 700,
        }}>
          + {t("add_member")}
        </button>
      )}
    </StepShell>
  );
}

const inputStyle = {
  padding: "10px 12px", borderRadius: TOKENS.radius.md, border: `1px solid ${TOKENS.color.border}`,
  background: TOKENS.color.bg, color: TOKENS.color.starlight, fontSize: TOKENS.font.size.sm,
};

function HouseholdNode({ compact }) {
  return (
    <div style={{
      width: compact ? 56 : 76, height: compact ? 56 : 76, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `radial-gradient(circle, ${TOKENS.color.goldGlow} 0%, ${TOKENS.color.surfaceRaised} 70%)`,
      border: `2px solid ${TOKENS.color.gold}`, boxShadow: TOKENS.shadow.glow,
      fontSize: compact ? 20 : 26, flexShrink: 0, margin: compact ? "0 auto 4px" : 0,
    }}>
      ⌂
    </div>
  );
}

function MemberOrb({ member, onEdit, onRemove }) {
  const { t } = useLang();
  return (
    <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 92 }}>
      <div style={{
        width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: TOKENS.color.surfaceRaised, border: `1px solid ${TOKENS.color.border}`, fontWeight: 700, fontSize: 16,
      }}>
        {member.name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ fontSize: TOKENS.font.size.xs, fontWeight: 600, textAlign: "center" }}>{member.name}</div>
      <div style={{ fontSize: 10, color: TOKENS.color.textDim }}>{member.role}{member.age ? `, ${member.age}` : ""}</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={onEdit} style={miniBtn}>{t("lb_edit")}</button>
        <button onClick={onRemove} style={miniBtn}>{t("remove")}</button>
      </div>
    </div>
  );
}

function MemberRow({ member, onEdit, onRemove }) {
  const { t } = useLang();
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: 12,
      borderRadius: TOKENS.radius.md, border: `1px solid ${TOKENS.color.border}`, background: TOKENS.color.surfaceRaised,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
        background: TOKENS.color.surface, border: `1px solid ${TOKENS.color.border}`, fontWeight: 700, flexShrink: 0,
      }}>
        {member.name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: TOKENS.font.size.sm }}>{member.name}</div>
        <div style={{ fontSize: TOKENS.font.size.xs, color: TOKENS.color.textDim }}>{member.role}{member.age ? `, ${member.age}` : ""}</div>
      </div>
      <button onClick={onEdit} style={miniBtn}>{t("lb_edit")}</button>
      <button onClick={onRemove} style={miniBtn}>{t("remove")}</button>
    </div>
  );
}

const miniBtn = {
  fontSize: 10, padding: "4px 8px", borderRadius: TOKENS.radius.pill,
  border: `1px solid ${TOKENS.color.border}`, background: "transparent", color: TOKENS.color.textMuted, cursor: "pointer",
};
