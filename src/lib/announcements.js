import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { APP_ROLE_LIST, toDateSafe } from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent, notifyRoles } from "./notifications.js";

// Announcements (additive). Staff publish to role audiences; readers see
// published items targeting their role (empty audience = everyone).
// Shape: announcements/{id} {
//   title, body, audience [roles], published, createdAt, updatedAt,
//   publishedAt?, archivedAt?
// }

export const AUDIENCE_ROLES = Object.freeze([...APP_ROLE_LIST]);

export async function createAnnouncement(actorId, input = {}) {
  if (!input.title?.trim()) throw new Error("Title is required.");
  if (!input.body?.trim()) throw new Error("Body is required.");
  const audience = Array.isArray(input.audience)
    ? input.audience.filter((r) => APP_ROLE_LIST.includes(r))
    : [];
  const ref = await addDoc(collection(db, "announcements"), {
    title: input.title.trim(),
    body: input.body.trim(),
    audience,
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
    archivedAt: null,
  });
  await writeAuditEntry({
    actorId,
    action: "announcement.created",
    targetType: "announcement",
    targetId: ref.id,
    detail: input.title.trim(),
  });
  return ref.id;
}

export async function updateAnnouncement(announcementId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "announcements", announcementId));
  if (!snap.exists()) throw new Error("Announcement not found.");
  const out = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.body !== undefined) out.body = patch.body;
  if (patch.audience !== undefined) {
    out.audience = Array.isArray(patch.audience)
      ? patch.audience.filter((r) => APP_ROLE_LIST.includes(r))
      : [];
  }
  await updateDoc(doc(db, "announcements", announcementId), {
    ...out,
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "announcement.updated",
    targetType: "announcement",
    targetId: announcementId,
    detail: "",
  });
}

export async function setAnnouncementPublished(announcementId, actorId, published) {
  const snap = await getDoc(doc(db, "announcements", announcementId));
  if (!snap.exists()) throw new Error("Announcement not found.");
  await updateDoc(doc(db, "announcements", announcementId), {
    published,
    publishedAt: published ? serverTimestamp() : snap.data().publishedAt || null,
    archivedAt: published ? null : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: published ? "announcement.published" : "announcement.archived",
    targetType: "announcement",
    targetId: announcementId,
    detail: "",
  });
  // Audience-scoped: only target roles receive this.
  const data = snap.data();
  const audience = Array.isArray(data?.audience) ? data.audience.filter((r) => APP_ROLE_LIST.includes(r)) : [];
  if (audience.length > 0) {
    await notifyRoles({
      roles: audience,
      type: "announcement.published",
      title: data.title,
      message: data.body,
      relatedType: "announcement",
      relatedId: announcementId,
      dedupeKey: `announcement:${announcementId}`,
    });
  } else {
    // Empty audience means everyone.
    await notifyEvent({
      type: "announcement.published",
      recipients: [],
      title: data.title,
      message: data.body,
      relatedType: "announcement",
      relatedId: announcementId,
      dedupeKey: `announcement:${announcementId}`,
    });
  }
}

export async function deleteAnnouncement(announcementId, actorId) {
  const snap = await getDoc(doc(db, "announcements", announcementId));
  if (!snap.exists()) throw new Error("Announcement not found.");
  await deleteDoc(doc(db, "announcements", announcementId));
  await writeAuditEntry({
    actorId,
    action: "announcement.deleted",
    targetType: "announcement",
    targetId: announcementId,
    detail: snap.data().title || "",
  });
}

function sortNewest(list) {
  return [...list].sort(
    (a, b) => (toDateSafe(b.publishedAt || b.createdAt)?.getTime() || 0) - (toDateSafe(a.publishedAt || a.createdAt)?.getTime() || 0)
  );
}

export function subscribeToAnnouncements(onUpdate, onError) {
  return onSnapshot(
    collection(db, "announcements"),
    (snap) => onUpdate(sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("Error subscribing to announcements:", error);
      if (onError) onError(error);
    }
  );
}
