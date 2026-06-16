import { createContext, useContext, useEffect, useState } from "react";
import { onAuthChange, getUserProfile, touchLastLogin, checkAndUpdateStreak } from "../lib/firebase";
import { initLearnerProfile } from "../lib/learnerProfile";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = loading
  const [profile, setProfile]           = useState(null);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setFirebaseUser(u ?? null);
      if (u) {
        const p = await getUserProfile(u.uid);
        setProfile(p);
        // Non-blocking OS init — runs in parallel, never blocks auth
        touchLastLogin(u.uid);
        checkAndUpdateStreak(u.uid);
        initLearnerProfile(u.uid);
      } else {
        setProfile(null);
      }
    });
    return unsub;
  }, []);

  const loading = firebaseUser === undefined;

  // Role helpers — extend here for teacher, etc.
  const role    = profile?.role ?? "user";
  const isAdmin = firebaseUser?.email === import.meta.env.VITE_ADMIN_EMAIL;

  // Combined user object used across the app
  const user = firebaseUser
    ? {
        uid:              firebaseUser.uid,
        email:            firebaseUser.email,
        name:             profile?.name ?? firebaseUser.displayName ?? firebaseUser.email.split("@")[0],
        displayName:      firebaseUser.displayName,
        role,
        plan:             profile?.plan ?? "individual",
        subscriptions:    profile?.subscriptions ?? [],
        confidenceScore:  profile?.confidenceScore ?? 0,
        streak:           profile?.streak ?? 0,
        hoursLearned:     profile?.hoursLearned ?? 0,
        lessonsCompleted: profile?.lessonsCompleted ?? 0,
        xpEarned:         profile?.xpEarned ?? 0,
        familyMembers:    profile?.familyMembers ?? [],
        lastLoginAt:      profile?.lastLoginAt,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
