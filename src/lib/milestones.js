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
import {
  MILESTONE_STATUS,
  MILESTONE_TRANSITIONS,
  canTransition,
  toDateSafe,
} from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent } from "./notifications.js";

// Milestones data layer (additive; workplan/tasks untouched).
// Shape: milestones/{id} {
//   groupId, title, description, deliverable, dueDate (YYYY-MM-DD),
//   status, createdAt, updatedAt
// }

export const MILESTONE_EDITABLE_FIELDS = Object.freeze([
  "title",
  "description",
  "deliverable",
  "dueDate",
]);

export function pickMilestoneFields(input) {
  const out = {};
  for (const key of MILESTONE_EDITABLE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export async function createMilestone(groupId, actorId, input = {}) {
  if (!groupId) throw new Error("Startup is required.");
  if (!input.title?.trim()) throw new Error("Milestone title is required.");
  const ref = await addDoc(collection(db, "milestones"), {
    groupId,
    status: MILESTONE_STATUS.NOT_STARTED,
    ...pickMilestoneFields({ ...input, title: input.title.trim() }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "milestone.created",
    targetType: "milestone",
    targetId: ref.id,
    detail: groupId,
  });
  // Incubatee scope: the milestone owner tracks their workplan.
  const gSnap = await getDoc(doc(db, "groups", groupId));
  const gData = gSnap.data();
  await notifyEvent({
    type: "milestone.created",
    recipients: [gData?.incubateeId].filter(Boolean),
    title: "Milestone added",
    message: `"${input.title}" was added to your workplan.`,
    relatedType: "group",
    relatedId: groupId,
    groupId,
  });
  return ref.id;
}

export async function updateMilestone(milestoneId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "milestones", milestoneId));
  if (!snap.exists()) throw new Error("Milestone not found.");
  await updateDoc(doc(db, "milestones", milestoneId), {
    ...pickMilestoneFields(patch),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "milestone.updated",
    targetType: "milestone",
    targetId: milestoneId,
    detail: "",
  });
}

export async function moveMilestone(milestoneId, actorId, toStatus) {
  const snap = await getDoc(doc(db, "milestones", milestoneId));
  if (!snap.exists()) throw new Error("Milestone not found.");
  const current = snap.data();
  if (!canTransition(MILESTONE_TRANSITIONS, current.status, toStatus)) {
    throw new Error(`Invalid transition "${current.status}" → "${toStatus}".`);
  }
  await updateDoc(doc(db, "milestones", milestoneId), {
    status: toStatus,
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "milestone.moved",
    targetType: "milestone",
    targetId: milestoneId,
    detail: `${current.status} → ${toStatus}`,
  });
}

export async function deleteMilestone(milestoneId, actorId) {
  const snap = await getDoc(doc(db, "milestones", milestoneId));
  if (!snap.exists()) throw new Error("Milestone not found.");
  await deleteDoc(doc(db, "milestones", milestoneId));
  await writeAuditEntry({
    actorId,
    action: "milestone.deleted",
    targetType: "milestone",
    targetId: milestoneId,
    detail: snap.data().groupId || "",
  });
}

export function subscribeToGroupMilestones(groupId, onUpdate, onError) {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "milestones"), where("groupId", "==", groupId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const at = toDateSafe(a.dueDate)?.getTime();
          const bt = toDateSafe(b.dueDate)?.getTime();
          if (at == null && bt == null) return 0;
          if (at == null) return 1;
          if (bt == null) return -1;
          return at - bt;
        });
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to milestones:", error);
      if (onError) onError(error);
    }
  );
}
