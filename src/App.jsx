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
import { resolveBlueprintRedirect, resolveJoinDestination } from "./lib/pathwayRouteAccess";
import { isSSLEnabled }   from "./sipSpeakLearn/config";
const DevAuthGate = lazy(() => import("./sipSpeakLearn/DevAuthGate"));
import PhonicsV2Preview   from "./pages/PhonicsV2Preview";
import PathwayLab         from "./pages/PathwayLab";
import ChoosePath         from "./pages/ChoosePath";
import PathwayEntry       from "./pages/PathwayEntry";
import PathwayRoute       from "./components/PathwayRoute";
// Lazy-loaded: HSD Family (Phase 3) is a large, self-contained feature
// (activity content, player, achievements, parent view) only needed by
// accounts actually using the Family pathway — same code-splitting
// rationale as Sip Speak Learn above (item 32: do not worsen initial-load
// weight for every visitor).
const FamilyHome         = lazy(() => import("./family/FamilyHome"));
const ActivityGrid       = lazy(() => import("./family/ActivityGrid"));
const ActivityPlayer     = lazy(() => import("./family/ActivityPlayer"));
const MyJourney          = lazy(() => import("./family/MyJourney"));
const FamilyHub          = lazy(() => import("./family/FamilyHub"));
const ChildProfileCreate = lazy(() => import("./family/ChildProfileCreate"));
const FamilyParentView   = lazy(() => import("./family/FamilyParentView"));
const FamilyInvite       = lazy(() => import("./family/FamilyInvite"));
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

// Retired-Blueprint gate: signed-in visitors to any retired /blueprint URL
// land on /choose-path (the current pathway selector); signed-out visitors
// land on /join (the Welcome/auth page's signup entry point). See
// resolveBlueprintRedirect in lib/pathwayRouteAccess.js. Waits out
// useAuth's `loading` first — same reasoning as JoinGate below: `user` is
// undefined (falsy) while Firebase Auth is still resolving, so deciding
// before then would misroute an already-signed-in visitor to /join.
function BlueprintRetiredGate() {
  const { user, loading } = useAuth();
  if (loading) return <ChunkLoading />;
  return <Navigate to={resolveBlueprintRedirect(user)} replace />;
}

// /join compatibility gate: a signed-out visitor gets SignIn.jsx's existing
// ?mode=signup shortcut (no second click needed to reach account creation);
// a signed-in visitor skips signup entirely and goes to /choose-path. Must
// wait for useAuth's `loading` to resolve first — `user` is undefined
// (falsy, same as signed-out) for the brief window before Firebase Auth
// reports back, and deciding during that window would flash signup at an
// already-authenticated user. See resolveJoinDestination.
function JoinGate() {
  const { user, loading } = useAuth();
  if (loading) return <ChunkLoading />;
  return <Navigate to={resolveJoinDestination(user)} replace />;
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
        {/* Phase 4A (2026-09-13) — /join is a compatibility entry point for the
            retired JoinFlow page's old URL. Signed-out: reuses SignIn.jsx's
            existing ?mode=signup mechanism (the same state "Begin Your
            Journey" puts you in) so landing here requires no second click to
            reach account creation. Signed-in: skips signup and goes straight
            to /choose-path. See JoinGate / resolveJoinDestination. */}
        <Route path="/join"       element={<JoinGate />} />
        <Route path="/blueprint"  element={<BlueprintRetiredGate />} />
        <Route path="/blueprint/*" element={<BlueprintRetiredGate />} />
        <Route path="/parent/:uid"   element={<ParentView />} />
        {/* Phase 2 — pathway selector + entry points. Additive: existing users
            are never automatically routed here (see /dashboard above, unchanged) —
            reachable directly by URL and via "Switch Pathway" in the account menu. */}
        <Route path="/choose-path" element={<ProtectedRoute><ChoosePath /></ProtectedRoute>} />
        {/* Phase 4 — beta invite redemption. Deliberately NOT wrapped in
            PathwayRoute (that would require access to grant access). */}
        <Route path="/family/invite" element={<ProtectedRoute><Suspense fallback={<ChunkLoading />}><FamilyInvite /></Suspense></ProtectedRoute>} />
        <Route path="/family"      element={<ProtectedRoute><PathwayRoute pathwayId="family"><PathwayEntry pathwayId="family" /></PathwayRoute></ProtectedRoute>} />
        {/* Phase 3 — HSD Family Beta Foundation. All guarded by the same
            PathwayRoute entitlement gate as /family above (Phase 2, item 36:
            do not weaken existing pathway protection). */}
        <Route path="/family/home"           element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><FamilyHome /></Suspense></PathwayRoute></ProtectedRoute>} />
        <Route path="/family/add-child"      element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><ChildProfileCreate /></Suspense></PathwayRoute></ProtectedRoute>} />
        <Route path="/family/journey"        element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><MyJourney /></Suspense></PathwayRoute></ProtectedRoute>} />
        <Route path="/family/hub"            element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><FamilyHub /></Suspense></PathwayRoute></ProtectedRoute>} />
        <Route path="/family/parent"         element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><FamilyParentView /></Suspense></PathwayRoute></ProtectedRoute>} />
        <Route path="/family/activity/:activityId" element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><ActivityPlayer /></Suspense></PathwayRoute></ProtectedRoute>} />
        <Route path="/family/:category"      element={<ProtectedRoute><PathwayRoute pathwayId="family"><Suspense fallback={<ChunkLoading />}><ActivityGrid /></Suspense></PathwayRoute></ProtectedRoute>} />
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
        {/* DEV-ONLY preview (unauthenticated). Stripped from production builds.
            Wrapped in DevAuthGate so Firestore writes (Table/Host Mode) have a
            real (anonymous, throwaway) auth session to work against. */}
        {import.meta.env.DEV && (
          <Route path="/ssl-preview"        element={<Suspense fallback={<ChunkLoading />}><DevAuthGate><SipSpeakLearn /></DevAuthGate></Suspense>} />
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
