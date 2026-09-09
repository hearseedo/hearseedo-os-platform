import { lazy, Suspense } from "react";
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
// Lazy-loaded: the whole Sip Speak Learn feature (Lesson/Games/Table/Host Mode,
// all seasonal content) is only needed by users who actually open it, so it's
// split into its own chunk rather than bundled into every visitor's initial load.
const SipSpeakLearn = lazy(() => import("./pages/SipSpeakLearn"));
import JoinFlow           from "./pages/JoinFlow";
import Blueprint          from "./pages/Blueprint";
import { isSSLEnabled }   from "./sipSpeakLearn/config";
const DevAuthGate = lazy(() => import("./sipSpeakLearn/DevAuthGate"));
import PhonicsV2Preview   from "./pages/PhonicsV2Preview";
import PathwayLab         from "./pages/PathwayLab";
import ChoosePath         from "./pages/ChoosePath";
import PathwayEntry       from "./pages/PathwayEntry";
import PathwayRoute       from "./components/PathwayRoute";
import DemoShell        from "./demo/DemoShell";
import DemoStart        from "./demo/DemoStart";
import DemoAssessment   from "./demo/DemoAssessment";
import DemoJonaDecision from "./demo/DemoJonaDecision";
import DemoApps         from "./demo/DemoApps";
import DemoEngine       from "./demo/DemoEngine";
import DemoLearning     from "./demo/DemoLearning";
import DemoProgress     from "./demo/DemoProgress";
import DemoComplete     from "./demo/DemoComplete";
import { isPhonicsV2PreviewEnabled } from "./lib/phonicsV2PreviewFlag";
import PreviewShell        from "./livingBlueprint/PreviewShell";
import PreviewHome         from "./livingBlueprint/PreviewHome";
import PreviewFamily       from "./livingBlueprint/PreviewFamily";
import WorldPage           from "./livingBlueprint/WorldPage";
import PreviewProgress     from "./livingBlueprint/PreviewProgress";
import PreviewCoach        from "./livingBlueprint/PreviewCoach";
import PreviewMessages     from "./livingBlueprint/PreviewMessages";
import PreviewMembership   from "./livingBlueprint/PreviewMembership";
import PreviewRewards      from "./livingBlueprint/PreviewRewards";
import PreviewCalendar     from "./livingBlueprint/PreviewCalendar";
import PreviewReferrals    from "./livingBlueprint/PreviewReferrals";
import PreviewMore         from "./livingBlueprint/PreviewMore";
import OnboardingFlow      from "./livingBlueprint/onboarding/OnboardingFlow";
import { isLivingBlueprintEnabled } from "./lib/livingBlueprintFlag";

// Minimal, neutral fallback while a lazy-loaded chunk (e.g. Sip Speak Learn)
// downloads. Intentionally unbranded/plain — it's on screen for a fraction of
// a second on a normal connection.
function ChunkLoading() {
  return <div style={{ minHeight: "100vh" }} />;
}

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
  return isSSLEnabled(user)
    ? <Suspense fallback={<ChunkLoading />}><SipSpeakLearn /></Suspense>
    : <Navigate to="/dashboard" replace />;
}

// Monkey Yoga Phonics V2 — staging preview gate (Stage 5). Same pattern as
// SSLGate: invisible outside dev/admin/localStorage flag. Does NOT touch the
// live "phonics" card/route — V1 stays the only thing users can reach normally.
function PhonicsV2PreviewGate() {
  const { user } = useAuth();
  return isPhonicsV2PreviewEnabled(user) ? <PhonicsV2Preview /> : <Navigate to="/dashboard" replace />;
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

function LivingBlueprintFamilyGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewFamily /> : <Navigate to="/dashboard" replace />;
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

function LivingBlueprintMessagesGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewMessages /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintMembershipGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewMembership /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintRewardsGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewRewards /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintCalendarGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewCalendar /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintReferralsGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewReferrals /> : <Navigate to="/dashboard" replace />;
}

function LivingBlueprintMoreGate() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewMore /> : <Navigate to="/dashboard" replace />;
}

// Entry-point gates: when the flag is on, the new Living Blueprint pages
// become the actual /dashboard and /welcome experience — not just reachable
// at /preview/*. Same flag, same instant rollback (livingBlueprintFlag.js);
// this just changes what the existing entry-point routes render, so
// bookmarks/redirects that already point at /dashboard and /welcome (e.g.
// SignIn.jsx, JoinFlow.jsx) pick up the new experience automatically.
function DashboardEntry() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <PreviewHome /> : <AppShell><Dashboard /></AppShell>;
}

function WelcomeEntry() {
  const { user } = useAuth();
  return isLivingBlueprintEnabled(user) ? <OnboardingFlow /> : <AppShell><Welcome /></AppShell>;
}

export default function App() {
  return (
    <>
      <GlobalStyles />
      <Routes>
        <Route path="/"          element={<SignIn />} />
        <Route path="/welcome"   element={<ProtectedRoute><WelcomeEntry /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardEntry /></ProtectedRoute>} />
        <Route path="/admin"     element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="/plans"     element={<ProtectedRoute><AppShell><Plans /></AppShell></ProtectedRoute>} />
        <Route path="/assessment" element={<ProtectedRoute><AppShell><Assessment /></AppShell></ProtectedRoute>} />
        <Route path="/setup"      element={<ProtectedRoute><AppShell><FamilySetup /></AppShell></ProtectedRoute>} />
        <Route path="/onboard"    element={<ProtectedRoute><AppShell><OnboardingV2 /></AppShell></ProtectedRoute>} />
        <Route path="/join"       element={<ProtectedRoute><AppShell><JoinFlow /></AppShell></ProtectedRoute>} />
        <Route path="/blueprint"  element={<ProtectedRoute><AppShell><Blueprint /></AppShell></ProtectedRoute>} />
        <Route path="/parent/:uid"   element={<ParentView />} />
        {/* Phase 2 — pathway selector + entry points. Additive: existing users
            are never automatically routed here (see /dashboard above, unchanged) —
            reachable directly by URL and via "Switch Pathway" in the account menu. */}
        <Route path="/choose-path" element={<ProtectedRoute><ChoosePath /></ProtectedRoute>} />
        <Route path="/family"      element={<ProtectedRoute><PathwayRoute pathwayId="family"><PathwayEntry pathwayId="family" /></PathwayRoute></ProtectedRoute>} />
        <Route path="/student"     element={<ProtectedRoute><PathwayRoute pathwayId="student"><PathwayEntry pathwayId="student" /></PathwayRoute></ProtectedRoute>} />
        <Route path="/adult"       element={<ProtectedRoute><PathwayRoute pathwayId="adult"><PathwayEntry pathwayId="adult" /></PathwayRoute></ProtectedRoute>} />
        <Route path="/educator"    element={<ProtectedRoute><PathwayRoute pathwayId="educator"><PathwayEntry pathwayId="educator" /></PathwayRoute></ProtectedRoute>} />
        <Route path="/wondercamp"    element={<ProtectedRoute><WonderCamp /></ProtectedRoute>} />
        <Route path="/career-ready"        element={<ProtectedRoute><CareerReady /></ProtectedRoute>} />
        <Route path="/global-ready"        element={<ProtectedRoute><GlobalReady /></ProtectedRoute>} />
        <Route path="/speak-ready"         element={<ProtectedRoute><SpeakReady /></ProtectedRoute>} />
        <Route path="/access-code"         element={<ProtectedRoute><AppShell><AccessCode /></AppShell></ProtectedRoute>} />
        {/* Sip Speak Learn — feature-flagged dev route, NOT linked from production nav (Phase 1). */}
        <Route path="/sip-speak-learn"      element={<ProtectedRoute><SSLGate /></ProtectedRoute>} />
        <Route path="/dev/phonics-v2"       element={<ProtectedRoute><PhonicsV2PreviewGate /></ProtectedRoute>} />
        {/* Phase 1 — minimal functional profile/pathway switcher for validation, not final UI (Phase 2). */}
        <Route path="/dev/pathway-lab"      element={<ProtectedRoute><PathwayLab /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 1 foundation preview, flagged (see lib/livingBlueprintFlag.js). */}
        <Route path="/preview/shell"        element={<ProtectedRoute><LivingBlueprintPreviewGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 2 six-step onboarding preview, flagged. */}
        <Route path="/preview/onboarding"   element={<ProtectedRoute><LivingBlueprintOnboardingGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 3 Individual/Family Home preview, flagged. */}
        <Route path="/preview/home"         element={<ProtectedRoute><LivingBlueprintHomeGate /></ProtectedRoute>} />
        <Route path="/preview/family"       element={<ProtectedRoute><LivingBlueprintFamilyGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 4 World landing/launch preview, flagged. */}
        <Route path="/preview/world/:worldId" element={<ProtectedRoute><LivingBlueprintWorldGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 5 Progress + Jona Coach preview, flagged. */}
        <Route path="/preview/progress"     element={<ProtectedRoute><LivingBlueprintProgressGate /></ProtectedRoute>} />
        <Route path="/preview/coach"        element={<ProtectedRoute><LivingBlueprintCoachGate /></ProtectedRoute>} />
        {/* Living Blueprint rebuild — Phase 6 supporting areas preview, flagged. */}
        <Route path="/preview/messages"     element={<ProtectedRoute><LivingBlueprintMessagesGate /></ProtectedRoute>} />
        <Route path="/preview/membership"   element={<ProtectedRoute><LivingBlueprintMembershipGate /></ProtectedRoute>} />
        <Route path="/preview/rewards"      element={<ProtectedRoute><LivingBlueprintRewardsGate /></ProtectedRoute>} />
        <Route path="/preview/calendar"     element={<ProtectedRoute><LivingBlueprintCalendarGate /></ProtectedRoute>} />
        <Route path="/preview/referrals"    element={<ProtectedRoute><LivingBlueprintReferralsGate /></ProtectedRoute>} />
        <Route path="/preview/more"         element={<ProtectedRoute><LivingBlueprintMoreGate /></ProtectedRoute>} />
        {/* DEV-ONLY preview (unauthenticated). Stripped from production builds.
            Wrapped in DevAuthGate so Firestore writes (Table/Host Mode) have a
            real (anonymous, throwaway) auth session to work against. */}
        {import.meta.env.DEV && (
          <Route path="/ssl-preview"        element={<Suspense fallback={<ChunkLoading />}><DevAuthGate><SipSpeakLearn /></DevAuthGate></Suspense>} />
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
          <Route path="/preview/family-dev" element={<PreviewFamily />} />
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
        {import.meta.env.DEV && (
          <Route path="/preview/messages-dev"   element={<PreviewMessages />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/membership-dev" element={<PreviewMembership />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/rewards-dev"    element={<PreviewRewards />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/calendar-dev"   element={<PreviewCalendar />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/referrals-dev"  element={<PreviewReferrals />} />
        )}
        {import.meta.env.DEV && (
          <Route path="/preview/more-dev"       element={<PreviewMore />} />
        )}
        <Route path="/admin/access-codes"  element={<AdminRoute><AdminAccessCodes /></AdminRoute>} />
        {/* Demo Mode — scripted, no-auth walkthrough for pitch videos and judges. */}
        <Route path="/demo" element={<DemoShell />}>
          <Route index element={<DemoStart />} />
          <Route path="assessment" element={<DemoAssessment />} />
          <Route path="jona" element={<DemoJonaDecision />} />
          <Route path="apps" element={<DemoApps />} />
          <Route path="engine" element={<DemoEngine />} />
          <Route path="learning" element={<DemoLearning />} />
          <Route path="progress" element={<DemoProgress />} />
          <Route path="complete" element={<DemoComplete />} />
        </Route>
        <Route path="/terms"      element={<Terms />} />
        <Route path="/privacy"    element={<Privacy />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
