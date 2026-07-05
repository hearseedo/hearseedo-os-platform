import { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthChange, touchLastLogin, checkAndUpdateStreak } from "../lib/firebase";
import { initLearnerProfile } from "../lib/learnerProfile";
import { db } from "../lib/firebase";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profile, setProfile]           = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const profileUnsubRef = useRef(null);

  // refreshProfile kept for backwards compat — no longer needed but safe to call
  const refreshProfile = () => Promise.resolve();

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setFirebaseUser(u ?? null);
      setProfileReady(false);

      // Tear down previous profile listener
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (u) {
        // Real-time listener — profile updates instantly when Firestore changes
        let firstSnap = true;
        profileUnsubRef.current = onSnapshot(doc(db, "users", u.uid), (snap) => {
          const data = snap.exists() ? snap.data() : {};
          setProfile(snap.exists() ? data : null);
          // Always ensure email + name are in Firestore (fixes admin display for all users)
          if (u.email) {
            const patch = {};
            if (!data.email) patch.email = u.email;
            if (!data.name)  patch.name  = u.displayName || u.email.split("@")[0];
            if (Object.keys(patch).length) {
              setDoc(doc(db, "users", u.uid), patch, { merge: true })
                .catch(err => console.error("Email backfill failed:", err));
            }
          }
          if (firstSnap) { firstSnap = false; setProfileReady(true); }
        });

        // Non-blocking OS init
        touchLastLogin(u.uid);
        checkAndUpdateStreak(u.uid);
        initLearnerProfile(u.uid);
        // Load referral stats
        getDoc(doc(db, "referrals", u.uid))
          .then(snap => setReferralData(snap.exists() ? snap.data() : null))
          .catch(() => {});
      } else {
        setProfile(null);
        setReferralData(null);
      }
    });
    return () => {
      unsub();
      if (profileUnsubRef.current) profileUnsubRef.current();
    };
  }, []);

  const loading = firebaseUser === undefined;
  const role    = profile?.role ?? "user";
  const isAdmin = firebaseUser?.email === import.meta.env.VITE_ADMIN_EMAIL;

  const user = firebaseUser
    ? {
        uid:                  firebaseUser.uid,
        email:                firebaseUser.email,
        name:                 profile?.name ?? firebaseUser.displayName ?? firebaseUser.email.split("@")[0],
        displayName:          firebaseUser.displayName,
        role,
        plan:                 profile?.plan ?? "individual",
        subscriptions:        profile?.subscriptions ?? [],
        confidenceScore:      profile?.confidenceScore ?? 0,
        streak:               profile?.streak ?? 0,
        hoursLearned:         profile?.hoursLearned ?? 0,
        lessonsCompleted:     profile?.lessonsCompleted ?? 0,
        xpEarned:             profile?.xpEarned ?? 0,
        familyMembers:        profile?.familyMembers ?? [],
        lastLoginAt:          profile?.lastLoginAt,
        // Founding member (first 200 paying users — set by Stripe webhook)
        isFoundingMember:     profile?.isFoundingMember ?? false,
        foundingMemberNumber: profile?.foundingMemberNumber ?? null,
        foundingClaimedAt:    profile?.foundingClaimedAt ?? null,
        // Referral data (from referrals/{uid} subcollection)
        referralCount:        referralData?.activeCount ?? 0,
        referralBadge:        referralData?.badgeLevel ?? null,
        referralCommission:   referralData?.commissionRate ?? 0,
        isLegacyFounder:      referralData?.isLegacyFounder ?? false,
        // Who referred this user
        referredBy:           profile?.referredBy ?? null,
        // Setup / onboarding
        setupDone:            profile?.setupDone ?? false,
        accountType:          profile?.accountType ?? null,
        // Assessment / learning path
        assessmentDone:       profile?.assessmentDone ?? false,
        baselineScore:        profile?.baselineScore ?? null,
        baselineCefr:         profile?.baselineCefr ?? null,
        baselineDate:         profile?.baselineDate ?? null,
        cefr:                 profile?.cefr ?? null,
        // Workbook bonus code redemption
        workbookBonusRedeemed:  profile?.workbookBonusRedeemed ?? false,
        redeemedWorkbookCode:   profile?.redeemedWorkbookCode ?? null,
        workbookBookNumber:     profile?.workbookBookNumber ?? null,
        workbookBonusStartDate: profile?.workbookBonusStartDate ?? null,
        workbookBonusEndDate:   profile?.workbookBonusEndDate ?? null,
        workbookAccessStatus:   profile?.workbookAccessStatus ?? null,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, profileReady, refreshProfile: () => firebaseUser ? refreshProfile(firebaseUser.uid) : Promise.resolve() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
