import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { toDateSafe } from "./domain.js";
import { notifyEvent } from "./notifications.js";

// Shared chat data layer. All three chat screens (incubatee / employee /
// admin) use this so reads stay constrained to the current user's own
// messages — never a full-collection scan.
//
// Two single-field queries (sent + received) need no composite index and
// work for legacy docs that lack the additive `participants` array.
export function subscribeToMyMessages(myUid, onUpdate) {
  if (!myUid) {
    onUpdate([]);
    return () => {};
  }

  let sent = [];
  let received = [];
  let unsubscribed = false;

  const emit = () => {
    if (unsubscribed) return;
    const byId = new Map();
    for (const m of [...sent, ...received]) byId.set(m.id, m);
    const merged = [...byId.values()].sort(
      (a, b) => (toDateSafe(a.timestamp)?.getTime() || 0) - (toDateSafe(b.timestamp)?.getTime() || 0)
    );
    onUpdate(merged);
  };

  const qSent = query(collection(db, "messages"), where("senderId", "==", myUid));
  const qReceived = query(collection(db, "messages"), where("receiverId", "==", myUid));

  const unsubSent = onSnapshot(
    qSent,
    (snap) => {
      sent = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (error) => console.error("Error subscribing to sent messages:", error)
  );

  const unsubReceived = onSnapshot(
    qReceived,
    (snap) => {
      received = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      emit();
    },
    (error) => console.error("Error subscribing to received messages:", error)
  );

  return () => {
    unsubscribed = true;
    unsubSent();
    unsubReceived();
  };
}

export function getConversation(allMessages, myUid, otherUid) {
  return (allMessages || []).filter(
    (m) =>
      (m.senderId === myUid && m.receiverId === otherUid) ||
      (m.senderId === otherUid && m.receiverId === myUid)
  );
}

export function getUnreadCounts(allMessages, myUid) {
  const counts = {};
  for (const m of allMessages || []) {
    if (m.receiverId === myUid && !m.seen && m.senderId) {
      counts[m.senderId] = (counts[m.senderId] || 0) + 1;
    }
  }
  return counts;
}

export async function sendChatMessage({ senderId, receiverId, message }) {
  const text = (message || "").trim();
  if (!senderId || !receiverId || !text) return;
  await addDoc(collection(db, "messages"), {
    senderId,
    receiverId,
    message: text,
    participants: [senderId, receiverId],
    timestamp: serverTimestamp(),
    seen: false,
  });
  // Receiver scope: the other person learns about the new message.
  await notifyEvent({
    type: "message.received",
    recipients: [receiverId],
    title: "New message",
    message: text,
    relatedType: "message",
    dedupeKey: `chat:${senderId}:${receiverId}:${text.slice(0, 40)}`,
    dedupeWindowMs: 30000,
  });
}

export async function markConversationSeen(conversation, myUid) {
  const pending = (conversation || []).filter((m) => m.receiverId === myUid && !m.seen && m.id);
  for (const m of pending) {
    try {
      await updateDoc(doc(db, "messages", m.id), { seen: true });
    } catch (error) {
      console.error("Error marking message as seen:", error);
    }
  }
}
