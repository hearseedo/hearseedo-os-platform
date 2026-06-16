import { COLORS } from "../constants/colors";
import { logout } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function AdminPanel() {
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate("/", { replace: true }); };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
      <div style={{ fontSize: 52 }}>🐒</div>
      <div style={{ color: COLORS.red, letterSpacing: 4, fontSize: 11, textTransform: "uppercase" }}>HEAR SEE DO™ OS AI</div>
      <div style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>Admin Panel</div>
      <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Connecting shortly…</div>
      <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
        <button onClick={() => navigate("/dashboard")} style={{ padding: "8px 20px", background: COLORS.red, border: "none", borderRadius: 6, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ← Dashboard
        </button>
        <button onClick={handleLogout} style={{ padding: "8px 20px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 6, color: COLORS.textMuted, fontSize: 13, cursor: "pointer" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
