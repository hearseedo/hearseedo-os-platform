import { Navigate, Route, Routes } from "react-router-dom";
import GlobalStyles from "./components/GlobalStyles";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import SupportChat from "./components/SupportChat";
import { useAuth } from "./hooks/useAuth";
import SignIn      from "./pages/SignIn";
import Welcome     from "./pages/Welcome";
import Dashboard   from "./pages/Dashboard";
import Admin       from "./pages/Admin";
import Terms       from "./pages/Terms";
import Privacy     from "./pages/Privacy";
import Plans       from "./pages/Plans";
import Assessment  from "./pages/Assessment";
import FamilySetup from "./pages/FamilySetup";
import ParentView  from "./pages/ParentView";
import WonderCamp  from "./pages/WonderCamp";

function AppShell({ children }) {
  const { user } = useAuth();
  return (
    <>
      {children}
      <SupportChat user={user} />
    </>
  );
}

export default function App() {
  return (
    <>
      <GlobalStyles />
      <Routes>
        <Route path="/"          element={<SignIn />} />
        <Route path="/welcome"   element={<ProtectedRoute><AppShell><Welcome /></AppShell></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>} />
        <Route path="/admin"     element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/plans"     element={<ProtectedRoute><AppShell><Plans /></AppShell></ProtectedRoute>} />
        <Route path="/assessment" element={<ProtectedRoute><AppShell><Assessment /></AppShell></ProtectedRoute>} />
        <Route path="/setup"      element={<ProtectedRoute><AppShell><FamilySetup /></AppShell></ProtectedRoute>} />
        <Route path="/parent/:uid"   element={<ParentView />} />
        <Route path="/wondercamp"    element={<ProtectedRoute><WonderCamp /></ProtectedRoute>} />
        <Route path="/terms"     element={<Terms />} />
        <Route path="/privacy"   element={<Privacy />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
