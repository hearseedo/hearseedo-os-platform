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
import Disclaimer  from "./pages/Disclaimer";
import Plans       from "./pages/Plans";
import Assessment  from "./pages/Assessment";
import FamilySetup  from "./pages/FamilySetup";
import OnboardingV2  from "./pages/OnboardingV2";
import ParentView  from "./pages/ParentView";
import WonderCamp  from "./pages/WonderCamp";
import CareerReady        from "./pages/CareerReady";
import GlobalReady        from "./pages/GlobalReady";
import SpeakReady         from "./pages/SpeakReady";
import AccessCode         from "./pages/AccessCode";
import AdminAccessCodes   from "./pages/AdminAccessCodes";
import SipSpeakLearn      from "./pages/SipSpeakLearn";
import JoinFlow           from "./pages/JoinFlow";
import Blueprint          from "./pages/Blueprint";
import { isSSLEnabled }   from "./sipSpeakLearn/config";
import PreviewShell        from "./livingBlueprint/PreviewShell";
import PreviewHome         from "./livingBlueprint/PreviewHome";
import WorldPage           from "./livingBlueprint/WorldPage";
import PreviewProgress     from "./livingBlueprint/PreviewProgress";
import PreviewCoach        from "./livingBlueprint/PreviewCoach";
import OnboardingFlow      from "./livingBlueprint/onboarding/OnboardingFlow";
import { isLivingBlueprintEnabled } from "./lib/livingBlueprintFlag";

function AppShell({ children }) {
  const { user } = useAuth();
  return (
    <>
      {children}
      <SupportChat user={user} />
    </>
  );
}

// Sip Speak Learn gate: renders the app only when the feature flag is on
// (dev build, admin, or localStorage ssl_preview). Otherwise sends the user
// back to the hub — so the route is invisible in production until Phase 8.
function SSLGate() {
  const { user } = useAuth();
  return isSSLEnabled(user) ? <SipSpeakLearn /> : <Navigate to="/dashboard" replace />;
}

// Living Blueprint rebuild — Phase 1 foundation preview gate. Same pattern as
// SSLGate: invisible outside dev/admin/localStorage flag until Phase 7 cutover.
function LivingBlueprintPreviewGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewShell /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintOnboardingGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <OnboardingFlow /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintHomeGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewHome /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintWorldGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <WorldPage /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintProgressGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewProgress /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintCoachGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewCoach /> : <Navigate to="/dashboard" replace />;
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
        <Route path="/onboard"    element={<ProtectedRoute><AppShell><OnboardingV2 /></AppShell></ProtectedRoute>} />
        <Route path="/join"       element={<ProtectedRoute><AppShell><JoinFlow /></AppShell></ProtectedRoute>} />
        <Route path="/blueprint"  element={<ProtectedRoute><AppShell><Blueprint /></AppShell></ProtectedRoute>} />
        <Route path="/parent/:uid"   element={<ParentView />} />
        <Route path="/wondercamp"    element={<ProtectedRoute><WonderCamp /></ProtectedRoute>} />
        <Route path="/career-ready"        element={<ProtectedRoute><CareerReady /></ProtectedRoute>} />
        <Route path="/global-ready"        element={<ProtectedRoute><GlobalReady /></ProtectedRoute>} />
        <Route path="/speak-ready"         element={<ProtectedRoute><SpeakReady /></ProtectedRoute>} />
        <Route path="/access-code"         element={<ProtectedRoute><AppShell><AccessCode /></AppShell></ProtectedRoute>} />
        {/* Sip Speak Learn — feature-flagged dev route, NOT linked from production nav (Phase 1). */}
        <Route path="/sip-speak-learn"      element={<ProtectedRoute><SSLGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 1 foundation preview, flagged (see lib/livingBlueprintFlag.js). */}
        <Route path="/preview/shell"        element={<ProtectedRoute><LivingBlueprintPreviewGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 2 six-step onboarding preview, flagged. */}
        <Route path="/preview/onboarding"   element={<ProtectedRoute><LivingBlueprintOnboardingGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 3 Individual/Family Home preview, flagged. */}
        <Route path="/preview/home"         element={<ProtectedRoute><LivingBlueprintHomeGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 4 World landing/launch preview, flagged. */}
        <Route path="/preview/world/:worldId" element={<ProtectedRoute><LivingBlueprintWorldGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 5 Progress + Jona Coach preview, flagged. */}
        <Route path="/preview/progress"     element={<ProtectedRoute><LivingBlueprintProgressGate /></ProtectedRoute>} />
        <Route path="/preview/coach"        element={<ProtectedRoute><LivingBlueprintCoachGate /></ProtectedRoute>} />
        {/* DEV-ONLY preview (unauthenticated). Stripped from production builds. */}
        {import.meta.env.DEV && (
          <Route path="/ssl-preview"        element={<SipSpeakLearn />} />
        )}
        {/* DEV-ONLY preview (unauthenticated), for visual QA of the Living Blueprint foundation. */}
        {import.meta.env.DEV && (
          <Route path="/preview/shell-dev"  element={<PreviewShell />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/onboarding-dev" element={<OnboardingFlow />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/home-dev"   element={<PreviewHome />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/world-dev/:worldId" element={<WorldPage />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/progress-dev" element={<PreviewProgress />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/coach-dev"    element={<PreviewCoach />} />
        )}
        <Route path="/admin/access-codes"  element={<AdminRoute><AdminAccessCodes /></AdminRoute>} />
        <Route path="/terms"      element={<Terms />} />
        <Route path="/privacy"    element={<Privacy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
