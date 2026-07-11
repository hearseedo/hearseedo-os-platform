import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, onSnapshot, query,
  orderBy, serverTimestamp, doc, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLORS } from "../constants/colors";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "hearseedo.english@gmail.com";

export default function SupportChat({ user }) {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText]        = useState("");
  const [sending, setSending]  = useState(false);
  const [unread, setUnread]    = useState(0);
  const bottomRef              = useRef(null);

  if (!user || user.email === ADMIN_EMAIL) return null;

  const threadRef  = doc(db, "support", user.uid);
  const msgsRef    = collection(db, "support", user.uid, "messages");

  // Real-time messages
  useEffect(() => {
    const q = query(msgsRef, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      // count unread admin messages
      if (!open) {
        setUnread(msgs.filter(m => m.from === "admin" && !m.readByUser).length);
      }
    });
    return unsub;
  }, [user.uid]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Mark admin messages read when opened
  useEffect(() => {
    if (!open || messages.length === 0) return;
    const unreadMsgs = messages.filter(m => m.from === "admin" && !m.readByUser);
    unreadMsgs.forEach(m => {
      updateDoc(doc(db, "support", user.uid, "messages", m.id), { readByUser: true }).catch(() => {});
    });
    setUnread(0);
  }, [open, messages]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    try {
      // Upsert thread doc so admin inbox can list it
      await setDoc(threadRef, {
        uid:          user.uid,
        email:        user.email,
        name:         user.displayName || user.name || user.email,
        lastMessage:  trimmed,
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: true,
      }, { merge: true });

      await addDoc(msgsRef, {
        text:      trimmed,
        from:      "user",
        createdAt: serverTimestamp(),
        readByAdmin: false,
        readByUser:  true,
      });
    } catch (err) {
      console.error("Support send error:", err);
    }
    setSending(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 300,
          height: 46, borderRadius: 23,
          padding: open ? "0 16px" : "0 18px 0 14px",
          background: open ? "#1a1a1a" : COLORS.red,
          border: `2px solid ${open ? "#333" : COLORS.red}`,
          color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          boxShadow: open ? "none" : "0 0 24px rgba(224,16,16,0.45)",
          transition: "all 0.2s",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{open ? "✕" : "💬"}</span>
        {!open && <span style={{ fontSize: 13 }}>Support</span>}
        {!open && unread > 0 && (
          <span style={{
            position: "absolute", top: -6, right: -6,
            width: 20, height: 20, borderRadius: "50%",
            background: "#fff", color: COLORS.red,
            fontSize: 10, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid " + COLORS.red,
          }}>{unread}</span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 92, right: 28, zIndex: 300,
            width: 340, height: 480,
            background: "#0e0e0e", border: "1px solid #2a2a2a",
            borderRadius: 16, display: "flex", flexDirection: "column",
            boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 18px", background: "#111",
            borderBottom: "1px solid #2a2a2a",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg,#4a0000,#e01010)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14,
            }}>J</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text }}>HSD Support</div>
              <div style={{ fontSize: 10, color: "#22c55e" }}>● Online</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 8px" }}>
            {messages.length === 0 && (
              <div style={{
                textAlign: "center", padding: "40px 20px",
                fontSize: 13, color: COLORS.textMuted, lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>👋</div>
                Hi {user.displayName?.split(" ")[0] || "there"}! Send us a message and we'll get back to you quickly.
              </div>
            )}
            {messages.map(m => (
              <div key={m.id} style={{
                display: "flex",
                justifyContent: m.from === "user" ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}>
                <div style={{
                  maxWidth: "78%",
                  padding: "9px 13px",
                  borderRadius: m.from === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: m.from === "user" ? COLORS.red : "#1e1e1e",
                  color: "#fff",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  {m.text}
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 4, textAlign: m.from === "user" ? "right" : "left" }}>
                    {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "10px 12px", borderTop: "1px solid #1e1e1e",
            display: "flex", gap: 8,
          }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message…"
              rows={1}
              style={{
                flex: 1, padding: "9px 12px",
                background: "#1a1a1a", border: "1px solid #2a2a2a",
                borderRadius: 10, color: COLORS.text, fontSize: 13,
                resize: "none", outline: "none", fontFamily: "inherit",
                lineHeight: 1.4,
              }}
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: text.trim() ? COLORS.red : "#1a1a1a",
                border: "none", color: "#fff", fontSize: 16, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "background 0.15s",
              }}
            >→</button>
          </div>
        </div>
      )}
    </>
  );
}
