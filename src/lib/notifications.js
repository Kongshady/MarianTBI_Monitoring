import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { getNotificationTime, toDateSafe } from "./domain.js";
import { bucketForType, normalizeNotificationType } from "./notificationCatalog.js";

// Event-driven notification service. Every workflow event notifies only the
// people responsible for the record (owner, assignee, operational staff,
// oversight, or system admins) — resolved by the caller, never broadcast.
//
// Document shape (new fields + legacy compat in one doc so old readers keep
// working): {
//   userId + recipientId, type, title, message,
//   relatedType, relatedId, groupId?, actionUrl?,
//   category (action/update/reminder), dedupeKey?,
//   read + isRead, createdAt + timestamp,
// }
//
// Spam control has two halves (notification reads are owner-only, so a sender
// can neither see nor rewrite someone else's inbox):
// 1. dedupeKey + dedupeWindowMs: a shared ledger (no personal data) drops
//    repeats inside the window — e.g. one "new messages" ping per
//    conversation per 15 minutes, one pending-accounts digest per 20.
// 2. Recipient-side cleanup: opening the related surface marks its
//    notifications read (see markRelatedRead), so viewed items never pile up.
// Sends never throw — a failed notification must not break the workflow.

export const NOTIFICATION_PREFS_COLLECTION = "notificationPrefs";
export const NOTIFICATION_LEDGER_COLLECTION = "notificationLedger";

function prefsDoc(uid) {
  return doc(db, NOTIFICATION_PREFS_COLLECTION, uid);
}

export async function getNotificationPrefs(uid) {
  if (!uid) return { mutedCategories: [], mutedTypes: [] };
  try {
    const snap = await getDoc(prefsDoc(uid));
    if (!snap.exists()) return { mutedCategories: [], mutedTypes: [] };
    const data = snap.data();
    return {
      mutedCategories: Array.isArray(data.mutedCategories) ? data.mutedCategories : [],
      mutedTypes: Array.isArray(data.mutedTypes) ? data.mutedTypes : [],
    };
  } catch {
    return { mutedCategories: [], mutedTypes: [] };
  }
}

export async function setCategoryMuted(uid, category, muted) {
  const prefs = await getNotificationPrefs(uid);
  const next = new Set(prefs.mutedCategories || []);
  if (muted) next.add(category);
  else next.delete(category);
  await setDoc(
    prefsDoc(uid),
    { mutedCategories: [...next], updatedAt: serverTimestamp() },
    { merge: true }
  );
}

function isMuted(prefs, type, category) {
  return (
    (prefs.mutedCategories || []).includes(category) || (prefs.mutedTypes || []).includes(type)
  );
}

async function ledgerAllows(dedupeKey, windowMs) {
  if (!dedupeKey || !windowMs) return true;
  try {
    const snap = await getDoc(doc(db, NOTIFICATION_LEDGER_COLLECTION, dedupeKey));
    if (!snap.exists()) return true;
    const at = snap.data()?.updatedAt?.toDate?.() || toDateSafe(snap.data()?.updatedAt);
    if (!at) return true;
    return Date.now() - at.getTime() >= windowMs;
  } catch {
    return true; // Fail open: a ledger miss never silences a notification.
  }
}

async function ledgerStamp(dedupeKey) {
  if (!dedupeKey) return;
  try {
    await setDoc(
      doc(db, NOTIFICATION_LEDGER_COLLECTION, dedupeKey),
      { updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // Best-effort; the notification itself already went out.
  }
}

async function sendToRecipient({ recipientId, type, category, title, message, relatedType, relatedId, groupId, actionUrl, dedupeKey, dedupeWindowMs }) {
  const prefs = await getNotificationPrefs(recipientId);
  if (isMuted(prefs, type, category)) return;
  if (dedupeKey && dedupeWindowMs) {
    const allowed = await ledgerAllows(dedupeKey, dedupeWindowMs);
    if (!allowed) return;
  }
  await addDoc(collection(db, "notifications"), {
    userId: recipientId,
    recipientId,
    type,
    category,
    title: title || "",
    message,
    relatedType: relatedType || null,
    relatedId: relatedId || null,
    groupId: groupId || null,
    actionUrl: actionUrl || null,
    dedupeKey: dedupeKey || null,
    read: false,
    isRead: false,
    createdAt: serverTimestamp(),
    timestamp: serverTimestamp(),
  });
  await ledgerStamp(dedupeKey);
}

// Primary send: scoped recipients, one doc each. dedupeKey with
// dedupeWindowMs rate-limits repeats (see ledger above). Never throws.
export async function notifyEvent({ type, recipients = [], title, message, relatedType, relatedId, groupId, actionUrl, dedupeKey, dedupeWindowMs = 0, category }) {
  const clean = [...new Set((recipients || []).filter(Boolean))];
  if (clean.length === 0 || !message) return;
  const bucket = category || bucketForType(type);
  for (const recipientId of clean) {
    try {
      await sendToRecipient({
        recipientId,
        type: normalizeNotificationType(type),
        category: bucket,
        title,
        message,
        relatedType,
        relatedId,
        groupId,
        actionUrl,
        dedupeKey,
        dedupeWindowMs,
      });
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
}

// Fan-out to approved holders of roles (capped). excludeUid keeps the actor
// from notifying themselves.
export async function notifyRoles({ roles = [], excludeUid = null, limitTo = 100, ...event }) {
  const wanted = [...new Set((roles || []).filter(Boolean))];
  if (wanted.length === 0) return;
  try {
    const snap = await getDocs(
      query(collection(db, "users"), where("role", "in", wanted.slice(0, 10)), where("status", "==", "approved"), limit(limitTo))
    );
    const ids = snap.docs.map((d) => d.id).filter((id) => id !== excludeUid);
    await notifyEvent({ ...event, recipients: ids });
  } catch (error) {
    console.error("Error fanning out notification:", error);
  }
}

// Group context for team/PM-scoped events. Fail-soft: {} when unreadable.
export async function getGroupContext(groupId) {
  if (!groupId) return {};
  try {
    const snap = await getDoc(doc(db, "groups", groupId));
    if (!snap.exists()) return {};
    const g = snap.data();
    return {
      name: g.name || "Startup",
      memberIds: (g.memberIds || (g.members || []).map((m) => m.id)).filter(Boolean),
      pmId: g.portfolioManagerId || g.portfolioManager?.id || null,
    };
  } catch {
    return {};
  }
}

export async function getUserDisplayName(uid) {
  if (!uid) return "Someone";
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return "Someone";
    const u = snap.data();
    return `${u.name || ""} ${u.lastname || ""}`.trim() || u.email || "Someone";
  } catch {
    return "Someone";
  }
}

// ---- reads & state (owner-scoped, newest first) ----

export function sortNotificationsDesc(list) {
  return [...(list || [])].sort(
    (a, b) => (toDateSafe(getNotificationTime(b))?.getTime() || 0) - (toDateSafe(getNotificationTime(a))?.getTime() || 0)
  );
}

export function subscribeNotifications(uid, onUpdate, onError) {
  if (!uid) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, "notifications"), where("userId", "==", uid)),
    (snap) => onUpdate(sortNotificationsDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("Error subscribing to notifications:", error);
      if (onError) onError(error);
    }
  );
}

export function isNotificationRead(n) {
  return !!(n.read || n.isRead);
}

export async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), { read: true, isRead: true });
}

export async function markAllNotificationsRead(list) {
  const unread = (list || []).filter((n) => !isNotificationRead(n) && n.id);
  if (unread.length === 0) return;
  const batch = writeBatch(db);
  unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true, isRead: true }));
  await batch.commit();
}

export async function deleteNotification(id) {
  await deleteDoc(doc(db, "notifications", id));
}

export async function clearReadNotifications(list) {
  const read = (list || []).filter((n) => isNotificationRead(n) && n.id);
  if (read.length === 0) return 0;
  const batch = writeBatch(db);
  read.forEach((n) => batch.delete(doc(db, "notifications", n.id)));
  await batch.commit();
  return read.length;
}

// Recipient-side cleanup: opening a record marks its notifications read so
// viewed items never pile up. Call from detail surfaces (own docs only).
export async function markRelatedRead({ uid, relatedType, relatedId, type = null }) {
  if (!uid || !relatedType || !relatedId) return;
  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", uid),
      where("relatedType", "==", relatedType),
      where("relatedId", "==", relatedId)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let count = 0;
    snap.forEach((d) => {
      const data = d.data();
      if ((data.read || data.isRead) || (type && data.type !== type)) return;
      batch.update(d.ref, { read: true, isRead: true });
      count += 1;
    });
    if (count > 0) await batch.commit();
  } catch {
    // Best-effort; inbox hygiene never blocks the page.
  }
}

// Role-aware deep link: related record first, legacy groupId fallback.
export function resolveNotificationUrl(n, role) {
  if (n?.actionUrl) return n.actionUrl;
  const staff = role === "TBI Manager" || role === "TBI Assistant" || role === "Management";
  const groupBase = staff ? "/admin/view-group" : role === "Portfolio Manager" ? "/employee/view-group" : "/incubatee/view-group";
  const id = n?.relatedId;
  switch (n?.relatedType) {
    case "application":
      return id ? `/applications/${id}` : "/applications";
    case "group":
      return id ? `${groupBase}/${id}` : null;
    case "announcement":
      return "/announcements";
    case "user":
      return staff || role === "System Administrator" ? "/admin-user-management" : null;
    case "message":
      return role === "TBI Manager" || role === "TBI Assistant" || role === "Management" || role === "System Administrator"
        ? "/admin-chat"
        : role === "Portfolio Manager"
          ? "/employee-chat"
          : "/incubatee-chat";
    case "role":
      return role === "System Administrator" ? "/admin/roles" : null;
    default:
      break;
  }
  if (n?.groupId) return `${groupBase}/${n.groupId}`;
  return null;
}
