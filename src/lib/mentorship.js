import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { toDateSafe } from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent } from "./notifications.js";

// Mentorship data layer (additive).
// mentorAssignments/{id} { groupId, mentorId, mentorName, startedAt (YYYY-MM-DD), endedAt?, createdAt }
// mentoringSessions/{id} { groupId, assignmentId?, mentorId, mentorName, date,
//   topic, discussion, recommendations, followUps, nextDate, createdAt, updatedAt }
// One incubatee may have several mentors over time; history is preserved by
// ending assignments instead of deleting them.

// ---- assignments (staff-only writes; see firestore.rules) ----
export async function createAssignment(groupId, actorId, { mentorId, mentorName, startedAt }) {
  if (!groupId) throw new Error("Startup is required.");
  if (!mentorId) throw new Error("A mentor is required.");
  const ref = await addDoc(collection(db, "mentorAssignments"), {
    groupId,
    mentorId,
    mentorName: mentorName || "",
    startedAt: startedAt || new Date().toISOString().split("T")[0],
    endedAt: null,
    createdAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "mentor.assigned",
    targetType: "group",
    targetId: groupId,
    detail: ref.id,
  });
  // Incubatee scope: the assigned person learns about their mentor.
  const groupSnap = await getDoc(doc(db, "groups", groupId));
  const groupData = groupSnap.data();
  await notifyEvent({
    type: "mentor.assigned",
    recipients: [groupData?.incubateeId].filter(Boolean),
    title: "Mentor assigned",
    message: `You've been paired with ${ref.data()?.mentorName || "a mentor"}.`,
    relatedType: "group",
    relatedId: groupId,
    groupId,
  });
  return ref.id;
}

export async function endAssignment(assignmentId, actorId) {
  const snap = await getDoc(doc(db, "mentorAssignments", assignmentId));
  if (!snap.exists()) throw new Error("Assignment not found.");
  await updateDoc(doc(db, "mentorAssignments", assignmentId), {
    endedAt: new Date().toISOString().split("T")[0],
  });
  await writeAuditEntry({
    actorId,
    action: "mentor.unassigned",
    targetType: "assignment",
    targetId: assignmentId,
    detail: snap.data().groupId || "",
  });
}

export function subscribeToGroupAssignments(groupId, onUpdate, onError) {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "mentorAssignments"), where("groupId", "==", groupId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.startedAt)?.getTime() || 0) - (toDateSafe(a.startedAt)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to mentor assignments:", error);
      if (onError) onError(error);
    }
  );
}

// ---- sessions (staff or the assigned mentor; see firestore.rules) ----
export const SESSION_FIELDS = Object.freeze([
  "date",
  "topic",
  "discussion",
  "recommendations",
  "followUps",
  "nextDate",
]);

export function pickSessionFields(input) {
  const out = {};
  for (const key of SESSION_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export async function createSession(groupId, actorId, input = {}) {
  if (!groupId) throw new Error("Startup is required.");
  if (!input.topic?.trim()) throw new Error("Topic is required.");
  if (!input.date) throw new Error("Session date is required.");
  const ref = await addDoc(collection(db, "mentoringSessions"), {
    groupId,
    assignmentId: input.assignmentId || null,
    mentorId: input.mentorId || actorId,
    mentorName: input.mentorName || "",
    ...pickSessionFields({ ...input, topic: input.topic.trim() }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "mentoring.session_recorded",
    targetType: "session",
    targetId: ref.id,
    detail: groupId,
  });
  return ref.id;
}

export async function updateSession(sessionId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "mentoringSessions", sessionId));
  if (!snap.exists()) throw new Error("Session not found.");
  await updateDoc(doc(db, "mentoringSessions", sessionId), {
    ...pickSessionFields(patch),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "mentoring.session_updated",
    targetType: "session",
    targetId: sessionId,
    detail: "",
  });
}

export async function deleteSession(sessionId, actorId) {
  const snap = await getDoc(doc(db, "mentoringSessions", sessionId));
  if (!snap.exists()) throw new Error("Session not found.");
  await deleteDoc(doc(db, "mentoringSessions", sessionId));
  await writeAuditEntry({
    actorId,
    action: "mentoring.session_deleted",
    targetType: "session",
    targetId: sessionId,
    detail: snap.data().groupId || "",
  });
}

export function subscribeToGroupSessions(groupId, onUpdate, onError) {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "mentoringSessions"), where("groupId", "==", groupId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.date)?.getTime() || 0) - (toDateSafe(a.date)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to mentoring sessions:", error);
      if (onError) onError(error);
    }
  );
}
