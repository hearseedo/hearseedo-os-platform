// Sip Speak Learn — DEV-ONLY auth bridge for the unauthenticated /ssl-preview
// route (see App.jsx — stripped from production builds via import.meta.env.DEV).
// /ssl-preview intentionally skips ProtectedRoute for fast visual QA, which
// means there is normally no real Firebase Auth session — so any Firestore
// write requiring `request.auth != null` (joining/hosting a Table Mode event)
// fails with permission-denied no matter what the rules say. Anonymous auth
// gives this dev route a real (but PII-free, throwaway) uid so those writes
// can actually be exercised end-to-end during development.
import { useEffect, useState } from "react";
import { signInAnonymously } from "firebase/auth";
import { auth } from "../lib/firebase";
import { SSL } from "./constants";

export default function DevAuthGate({ children }) {
  const [ready, setReady] = useState(!!auth.currentUser);

  useEffect(() => {
    if (auth.currentUser) { setReady(true); return; }
    signInAnonymously(auth)
      .then(() => setReady(true))
      .catch(() => setReady(true)); // don't block preview forever if anon auth is disabled
  }, []);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: SSL.cream, color: SSL.textMuted, fontSize: 14 }}>
        Preparing preview session…
      </div>
    );
  }
  return children;
}
