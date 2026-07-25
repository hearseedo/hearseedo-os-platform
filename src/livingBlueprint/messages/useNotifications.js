import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";

// Reads the exact same users/{uid}/notifications collection the live
// Dashboard.jsx JonaInbox already writes to and reads from — real inbox
// data, not a mock. See Dashboard.jsx lines ~57-107 for the source pattern.
export function useNotifications(uid) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!uid) { setNotifications([]); return; }
    const q = query(collection(db, "users", uid, "notifications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [uid]);

  const dismiss = (id) => updateDoc(doc(db, "users", uid, "notifications", id), { read: true }).catch(() => {});
  const dismissAll = () => {
    notifications.filter(n => !n.read).forEach(n =>
      updateDoc(doc(db, "users", uid, "notifications", n.id), { read: true }).catch(() => {})
    );
  };

  return { notifications, dismiss, dismissAll };
}
