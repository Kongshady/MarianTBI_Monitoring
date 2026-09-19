import {
  addDoc,
  collection,
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
  INCUBATEE_STATUS,
  INCUBATEE_TRANSITIONS,
  OUTCOME_TYPE,
  canTransition,
  toDateSafe,
} from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent } from "./notifications.js";

// Graduation / exit data layer (additive).
// - Groups carry incubateeStatus (legacy docs without one read as Active).
// - Terminal moves (Graduated/Exited/Withdrawn) and Continuing write an
//   append-only outcomes/{id} record {
//     groupId, type, date, reason, achievements, actorId, createdAt
//   } and mirror the event into applicationEvents when the group was
//   onboarded from an application. History is never overwritten.

export const TERMINAL_OUTCOMES = Object.freeze([
  OUTCOME_TYPE.GRADUATED,
  OUTCOME_TYPE.EXITED,
  OUTCOME_TYPE.WITHDRAWN,
  OUTCOME_TYPE.CONTINUING,
]);

export function currentIncubationStatus(group) {
  return group?.incubateeStatus || INCUBATEE_STATUS.ACTIVE;
}

export function nextIncubationStatuses(group) {
  return INCUBATEE_TRANSITIONS[currentIncubationStatus(group)] || [];
}

export async function moveIncubationStatus(groupId, actorId, toStatus, outcome = {}) {
  const snap = await getDoc(doc(db, "groups", groupId));
  if (!snap.exists()) throw new Error("Startup not found.");
  const group = snap.data();
  const from = currentIncubationStatus(group);
  if (!canTransition(INCUBATEE_TRANSITIONS, from, toStatus)) {
    throw new Error(`Invalid transition "${from}" → "${toStatus}".`);
  }

  if (TERMINAL_OUTCOMES.includes(toStatus)) {
    if (!outcome.date) throw new Error("Outcome date is required.");
    if (!outcome.reason?.trim()) throw new Error("A reason is required for this outcome.");
    await addDoc(collection(db, "outcomes"), {
      groupId,
      incubateeId: null,
      type: toStatus,
      date: outcome.date,
      reason: outcome.reason.trim(),
      achievements: outcome.achievements?.trim() || "",
      actorId,
      createdAt: serverTimestamp(),
    });
  }

  await updateDoc(doc(db, "groups", groupId), { incubateeStatus: toStatus });

  if (group.applicationId) {
    try {
      await addDoc(collection(db, "applicationEvents"), {
        applicationId: group.applicationId,
        from,
        to: toStatus,
        note: outcome.reason?.trim() || "Incubation status changed.",
        actorId,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error mirroring outcome to application history:", err);
    }
  }

  await writeAuditEntry({
    actorId,
    action: "incubation.status_changed",
    targetType: "group",
    targetId: groupId,
    detail: `${from} → ${toStatus}`,
  });
  // Incubatee scope: the person whose status changed learns about it.
  const gSnap = await getDoc(doc(db, "groups", groupId));
  const gData = gSnap.data();
  await notifyEvent({
    type: "incubation.status_changed",
    recipients: [gData?.incubateeId].filter(Boolean),
    title: `Status updated to ${toStatus}`,
    message: `Your incubation status changed from ${from} to ${toStatus}.${outcome.reason ? ` Reason: ${outcome.reason}` : ""}`,
    relatedType: "group",
    relatedId: groupId,
    groupId,
  });
}

export function subscribeToGroupOutcomes(groupId, onUpdate, onError) {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "outcomes"), where("groupId", "==", groupId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.date)?.getTime() || 0) - (toDateSafe(a.date)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to outcomes:", error);
      if (onError) onError(error);
    }
  );
}
