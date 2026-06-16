import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  enableIndexedDbPersistence,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Persist auth session across browser restarts
setPersistence(auth, browserLocalPersistence).catch(console.error);

// Enable Firestore offline cache — serves reads from IndexedDB first.
// 90% read reduction: a user reloading the dashboard 10x costs 1 Firestore read.
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open — offline persistence only works in one tab at a time
    console.warn("Firestore offline persistence unavailable: multiple tabs open");
  } else if (err.code === "unimplemented") {
    // Browser doesn't support IndexedDB (very rare)
    console.warn("Firestore offline persistence not supported in this browser");
  }
});

const googleProvider = new GoogleAuthProvider();

export const loginWithEmail  = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const signupWithEmail = (email, password) => createUserWithEmailAndPassword(auth, email, password);
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const resetPassword   = (email) => sendPasswordResetEmail(auth, email);
export const logout          = () => signOut(auth);
export const onAuthChange    = (cb) => onAuthStateChanged(auth, cb);

// ── Firestore helpers ──────────────────────────────────────────────────────

export { increment };

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function touchLastLogin(uid) {
  await updateDoc(doc(db, "users", uid), {
    lastLoginAt: serverTimestamp(),
  }).catch(() => {});
}

// Called on every login — increments streak if user hasn't logged in today (JST)
export async function checkAndUpdateStreak(uid) {
  try {
    const snap    = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return;
    const data    = snap.data();
    const todayJST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const lastJST  = data.lastStreakDate ?? "";

    if (lastJST === todayJST) return; // already counted today

    const yesterdayJST = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const continued    = lastJST === yesterdayJST;

    await updateDoc(doc(db, "users", uid), {
      streak:        continued ? increment(1) : 1,
      lastStreakDate: todayJST,
      xpEarned:      increment(continued ? 10 : 5), // bonus XP for maintaining streak
    });
  } catch (err) { console.error("checkAndUpdateStreak:", err); }
}

// Batched XP + streak + lesson update — 1 write instead of 3
export async function awardXP(uid, xp, lessonsCompleted = 0) {
  await updateDoc(doc(db, "users", uid), {
    xpEarned:        increment(xp),
    lessonsCompleted: increment(lessonsCompleted),
    lastActivityAt:  serverTimestamp(),
  }).catch(console.error);
}

export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), {
    uid,
    role: "user",
    plan: "individual",
    subscriptions: [],
    confidenceScore: 0,
    streak: 0,
    hoursLearned: 0,
    lessonsCompleted: 0,
    xpEarned: 0,
    familyMembers: [],
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
    ...data,
  });
}
