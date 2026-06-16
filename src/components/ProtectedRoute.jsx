import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

function Spinner() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #2a2a2a", borderTopColor: "#e01010", animation: "spin 0.7s linear infinite" }} />
    </div>
  );
}

// Requires any authenticated user
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user)   return <Navigate to="/" replace />;
  return children;
}

// Requires admin role — silently redirects to / if not admin
export function AdminRoute({ children }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading)  return <Spinner />;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return children;
}
