import { Navigate, Route, Routes } from "react-router-dom";
import GlobalStyles from "./components/GlobalStyles";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute";
import SignIn    from "./pages/SignIn";
import Welcome   from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Admin     from "./pages/Admin";
import Terms     from "./pages/Terms";
import Privacy   from "./pages/Privacy";
import Plans     from "./pages/Plans";

export default function App() {
  return (
    <>
      <GlobalStyles />
      <Routes>
        <Route path="/"          element={<SignIn />} />
        <Route path="/welcome"   element={<ProtectedRoute><Welcome /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin"     element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/plans"     element={<ProtectedRoute><Plans /></ProtectedRoute>} />
        <Route path="/terms"     element={<Terms />} />
        <Route path="/privacy"   element={<Privacy />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
