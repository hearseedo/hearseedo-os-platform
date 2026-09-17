import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from "react";
import { onAuthChange, touchLastLogin, checkAndUpdateStreak, auth } from "../lib/firebase";
import { db } from "../lib/firebase";
import { doc, getDoc, onSnapshot, setDoc, arrayUnion } from "firebase/firestore";
import { getAccessiblePathways, getPathwayState, resolveCurrentPathway } from "../lib/pathwayAccess";
import { PATHWAY_IDS } from "../constants/pathways";
import { subscribeToFamilyMembers, getProfiles, SELF_PROFILE_ID } from "../lib/profiles";
import { resolveCurrentProfile } from "../lib/pathwayRouteAccess";
import { isValidPathwayId } from "../constants/pathways";
import { logPathwayEvent, PATHWAY_EVENTS } from "../lib/pathwayAnalytics";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profile, setProfile]           = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [profileReady, setProfileReady] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  // Phase 3.2 hardening (2026-09-12) — set when either the account-doc or
  // familyMembers real-time listener errors (e.g. permission-denied on a
  // misconfigured Firestore rules deploy). Previously neither listener had
  // an error callback at all, so a denied read left `profile`/
  // `familyMembers` silently stuck at their initial empty state forever —
  // which getAccessiblePathways() then read as "no pathwayAccess, no
  // subscriptions", incorrectly reporting every pathway as LOCKED even for
  // an account that actually has access. Consumers (PathwayRoute) must
  // treat this as "we don't know yet, don't fail this account's access
  // claims either way" — never as proof of no access, and never papered
  // over by falling back to a previous good `profile` value (no caching of
  // account data is used as an authorization fallback here).
  const [profileError, setProfileError] = useState(null);
  const profileUnsubRef = useRef(null);
  const familyMembersUnsubRef = useRef(null);
  const migrationAttemptedRef = useRef(false);

  // refreshProfile kept for backwards compat — no longer needed but safe to call
  const refreshProfile = () => Promise.resolve();

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setFirebaseUser(u ?? null);
      setProfileReady(false);
      setProfileError(null);

      // Tear down previous profile listener
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      if (familyMembersUnsubRef.current) {
        familyMembersUnsubRef.current();
        familyMembersUnsubRef.current = null;
      }
      migrationAttemptedRef.current = false;

      if (u) {
        familyMembersUnsubRef.current = subscribeToFamilyMembers(u.uid, setFamilyMembers, (err) => {
          console.error("[useAuth] familyMembers listener error:", err?.code || err);
          setProfileError(err?.code || "unknown-error");
        });
        // Real-time listener — profile updates instantly when Firestore changes
        let firstSnap = true;
        profileUnsubRef.current = onSnapshot(doc(db, "users", u.uid), (snap) => {
          setProfileError(null); // a successful snapshot clears any earlier error, e.g. after reconnecting
          const data = snap.exists() ? snap.data() : {};
          setProfile(snap.exists() ? data : null);
          // Always ensure email + name are in Firestore (fixes admin display for all users)
          if (u.email) {
            const patch = {};
            if (!data.email) patch.email = u.email;
            if (!data.name)  patch.name  = u.displayName || u.email.split("@")[0];
            const OWNER_EMAILS = [import.meta.env.VITE_ADMIN_EMAIL, "waltho79@gmail.com"];
          if (OWNER_EMAILS.includes(u.email)) {
            if (!data.isAdmin) patch.isAdmin = true;
            // Ensure owner accounts have full subscriptions so sub-apps grant access
            const ALL_SUBS = ["phonics", "eiken", "speak", "sipswitch", "wondercamp",
                              "innerkey", "family", "monkeys-unlock",
                              "career-ready", "global-ready", "speak-ready"];
            const currentSubs = data.subscriptions ?? [];
            if (ALL_SUBS.some(s => !currentSubs.includes(s))) {
              patch.subscriptions = ALL_SUBS;
              patch.plan          = "individual";
              patch.planStatus    = "active";
            }
          }
          if (Object.keys(patch).length) {
              setDoc(doc(db, "users", u.uid), patch, { merge: true })
                .catch(err => console.error("Email backfill failed:", err));
            }
          }
          // Phase 1 lazy migration (Stage C): an account with no pathwayAccess
          // field yet gets one computed and written server-side, once per
          // session, best-effort. pathwayAccess is privileged (only the
          // service account/admin may write it — firestore.rules), so this
          // can't be a client-side setDoc like the email/name backfill above.
          if (data.pathwayAccess === undefined && !migrationAttemptedRef.current) {
            migrationAttemptedRef.current = true;
            auth.currentUser?.getIdToken()
              .then(idToken => fetch("/api/migrate-pathway-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
              }))
              .catch(() => {}); // best-effort — account still works via inference either way
          }
          if (firstSnap) { firstSnap = false; setProfileReady(true); }
        }, (err) => {
          // Phase 3.2 hardening — this listener previously had no error
          // callback at all, so a denied/failed read left `profile` stuck
          // at its initial `null` forever with no signal that anything had
          // gone wrong. `profileReady` intentionally does NOT get set to
          // true here — a load error is a distinct third state from
          // "loading" and "ready", and callers (PathwayRoute) must not
          // treat "not ready" as "definitely locked" just because
          // `loading` (derived from Firebase Auth alone) has already
          // turned false.
          console.error("[useAuth] account listener error:", err?.code || err);
          setProfileError(err?.code || "unknown-error");
        });

        // Non-blocking OS init. Learner-profile creation is no longer
        // triggered here (Phase 3.4, 2026-09-12) — it used to be an eager,
        // always-denied client write (see src/lib/learnerProfile.js's
        // comment); profile creation is now on-demand and server-side, the
        // first time a real engagement event is recorded.
        touchLastLogin(u.uid);
        checkAndUpdateStreak(u.uid);
        // Load referral stats
        getDoc(doc(db, "referrals", u.uid))
          .then(snap => setReferralData(snap.exists() ? snap.data() : null))
          .catch(() => {});
      } else {
        setProfile(null);
        setReferralData(null);
        setFamilyMembers([]);
      }
    });
    return () => {
      unsub();
      if (profileUnsubRef.current) profileUnsubRef.current();
      if (familyMembersUnsubRef.current) familyMembersUnsubRef.current();
    };
  }, []);

  const loading = firebaseUser === undefined;
  const role    = profile?.role ?? "user";
  const OWNER_EMAILS = [import.meta.env.VITE_ADMIN_EMAIL, "waltho79@gmail.com"].filter(Boolean);
  const isAdmin = OWNER_EMAILS.includes(firebaseUser?.email);

  const user = firebaseUser
    ? {
        uid:                  firebaseUser.uid,
        email:                firebaseUser.email,
        name:                 profile?.name ?? firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Guest",
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
        nickname:             profile?.nickname ?? "",
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
        // HSDOS.AI Access Code pass
        accessPass:             profile?.accessPass ?? null,
        // Phase 1 — account/profile/pathway architecture (2026-09-09).
        // pathwayAccess is privileged (server/admin-only write — see
        // firestore.rules); roles/lastUsedPathway/activeProfileId are plain
        // self-writable preferences, same tier as nickname/setupDone above.
        pathwayAccess:        profile?.pathwayAccess ?? null,
        roles:                profile?.roles ?? [],
        lastUsedPathway:      profile?.lastUsedPathway ?? null,
        activeProfileId:      profile?.activeProfileId ?? SELF_PROFILE_ID,
        // Phase 2 — which pathways this account has ever actually entered
        // (distinct from lastUsedPathway, which only remembers the most
        // recent one) — used to tell "available/continue" apart from
        // "eligible/first-time setup" per pathway. Self-writable preference,
        // not an entitlement signal.
        visitedPathways:      profile?.visitedPathways ?? [],
      }
    : null;

  // ── Phase 1: pathway access, profiles, current selection ────────────────
  const accessiblePathways = useMemo(
    () => getAccessiblePathways(user, isAdmin),
    [user, isAdmin]
  );

  const profiles = useMemo(
    () => getProfiles(user, familyMembers),
    [user, familyMembers]
  );

  // resolveCurrentProfile (Phase 3.2 hardening) validates the persisted
  // activeProfileId against `profiles`, which is itself derived only from
  // the LIVE familyMembers subscription — so a deleted/renamed child's old
  // activeProfileId can never resolve to stale or another child's data; it
  // falls back to the account owner's own profile instead.
  const currentProfile = useMemo(
    () => resolveCurrentProfile(profiles, user?.activeProfileId),
    [profiles, user?.activeProfileId]
  );

  // Deliberately NOT auto-selected/auto-redirected (Phase 1 item 6) — null
  // until the user (or a later phase's pathway selector UI) explicitly
  // chooses one, even if lastUsedPathway was previously set, in case access
  // to that pathway has since changed.
  const currentPathway = useMemo(
    () => resolveCurrentPathway(user, accessiblePathways),
    [user?.lastUsedPathway, accessiblePathways]
  );

  // Phase 2 — state (available/eligible/locked/coming_soon) per pathway,
  // computed once here so the selector, cards, and route guards all agree.
  const pathwayStates = useMemo(() => {
    const states = {};
    for (const id of PATHWAY_IDS) {
      states[id] = getPathwayState(id, {
        accessible: accessiblePathways.includes(id),
        visitedPathways: user?.visitedPathways ?? [],
      });
    }
    return states;
  }, [accessiblePathways, user?.visitedPathways]);

  const setActivePathway = useCallback((pathwayId) => {
    if (!firebaseUser || !isValidPathwayId(pathwayId) || !accessiblePathways.includes(pathwayId)) {
      return Promise.resolve(false);
    }
    const isSwitch  = !!user?.lastUsedPathway && user.lastUsedPathway !== pathwayId;
    const isFirstVisit = !(user?.visitedPathways ?? []).includes(pathwayId);
    return setDoc(
      doc(db, "users", firebaseUser.uid),
      { lastUsedPathway: pathwayId, visitedPathways: arrayUnion(pathwayId) },
      { merge: true }
    )
      .then(() => {
        logPathwayEvent(firebaseUser.uid, isSwitch ? PATHWAY_EVENTS.PATHWAY_SWITCHED : PATHWAY_EVENTS.PATHWAY_SELECTED, { pathwayId });
        if (isFirstVisit) logPathwayEvent(firebaseUser.uid, PATHWAY_EVENTS.PATHWAY_ONBOARDING_STARTED, { pathwayId });
        return true;
      })
      .catch(() => false);
  }, [firebaseUser, accessiblePathways, user?.lastUsedPathway, user?.visitedPathways]);

  // knownValid (Summit Sprint 1, item 5) — a caller that JUST created the
  // profile itself (has the real Firestore doc ref/id in hand) can opt out
  // of the profiles.some() guard below. That guard exists to stop a
  // stale/garbage id from ever being persisted, not to block a genuinely
  // valid id merely because the live familyMembers listener hasn't caught
  // up with this client's own just-completed write yet — which is exactly
  // the race a "new child becomes active immediately" flow hits every
  // time, since addDoc() resolving and onSnapshot() delivering the new doc
  // back to this same client are two separate async events.
  const setActiveProfile = useCallback((profileId, { knownValid = false } = {}) => {
    if (!firebaseUser || !(knownValid || profiles.some(p => p.id === profileId))) return Promise.resolve(false);
    return setDoc(doc(db, "users", firebaseUser.uid), { activeProfileId: profileId }, { merge: true })
      .then(() => {
        logPathwayEvent(firebaseUser.uid, PATHWAY_EVENTS.PROFILE_SELECTED, { profileId });
        return true;
      })
      .catch(() => false);
  }, [firebaseUser, profiles]);

  return (
    <AuthContext.Provider value={{
      user, isAdmin, loading, profileReady, profileError,
      refreshProfile: () => firebaseUser ? refreshProfile(firebaseUser.uid) : Promise.resolve(),
      // Phase 1 — account/profile/pathway architecture
      accessiblePathways, profiles, currentProfile, currentPathway,
      setActivePathway, setActiveProfile,
      // Phase 2 — per-pathway card/route state
      pathwayStates,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
