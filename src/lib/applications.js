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
  APPLICATION_STATUS,
  APPLICATION_TRANSITIONS,
  canTransition,
  toDateSafe,
} from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent, notifyRoles } from "./notifications.js";

// Application workflow data layer (additive; no legacy collections touched).
// Shape: applications/{id} {
//   applicantId, status, enterpriseName, description, problem, solution,
//   targetMarket, businessModel, team, programId?, createdAt, updatedAt,
//   submittedAt?, decidedAt?, decision?, decisionNotes?
// }
// Review history lives in applicationEvents (append-only).

export const APPLICATION_DRAFT_FIELDS = Object.freeze([
  "enterpriseName",
  "description",
  "problem",
  "solution",
  "targetMarket",
  "businessModel",
  "team",
  "programId",
]);

export function pickDraftFields(input) {
  const out = {};
  for (const key of APPLICATION_DRAFT_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export async function createDraftApplication(applicantId, draft = {}) {
  if (!applicantId) throw new Error("applicantId is required.");
  const ref = await addDoc(collection(db, "applications"), {
    applicantId,
    status: APPLICATION_STATUS.DRAFT,
    ...pickDraftFields(draft),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId: applicantId,
    action: "application.created",
    targetType: "application",
    targetId: ref.id,
    detail: APPLICATION_STATUS.DRAFT,
  });
  return ref.id;
}

export async function updateDraftApplication(appId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "applications", appId));
  if (!snap.exists()) throw new Error("Application not found.");
  const current = snap.data();
  if (
    current.applicantId !== actorId ||
    ![APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.RETURNED].includes(current.status)
  ) {
    throw new Error("Only the owner may edit a Draft or Returned application.");
  }
  await updateDoc(doc(db, "applications", appId), {
    ...pickDraftFields(patch),
    status: APPLICATION_STATUS.DRAFT,
    updatedAt: serverTimestamp(),
  });
}

export async function submitApplication(appId, actorId) {
  const snap = await getDoc(doc(db, "applications", appId));
  if (!snap.exists()) throw new Error("Application not found.");
  const current = snap.data();
  if (current.applicantId !== actorId) throw new Error("Only the owner may submit.");
  if (!canTransition(APPLICATION_TRANSITIONS, current.status, APPLICATION_STATUS.SUBMITTED)) {
    throw new Error(`Cannot submit from status "${current.status}".`);
  }
  await updateDoc(doc(db, "applications", appId), {
    status: APPLICATION_STATUS.SUBMITTED,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "application.submitted",
    targetType: "application",
    targetId: appId,
    detail: APPLICATION_STATUS.SUBMITTED,
  });
  // Operational scope: TBI Manager + Assistant review the queue.
  await notifyRoles({
    roles: ["TBI Manager", "TBI Assistant"],
    excludeUid: actorId,
    type: "application.submitted",
    title: "New application submitted",
    message: `"${current.enterpriseName || "An application"}" is waiting for screening.`,
    relatedType: "application",
    relatedId: appId,
  });
}

// Staff move: screening → evaluation → decision (validated by transition map).
export async function moveApplication(appId, actorId, toStatus, note = "") {
  const snap = await getDoc(doc(db, "applications", appId));
  if (!snap.exists()) throw new Error("Application not found.");
  const current = snap.data();
  if (!canTransition(APPLICATION_TRANSITIONS, current.status, toStatus)) {
    throw new Error(`Invalid transition "${current.status}" → "${toStatus}".`);
  }
  const patch = { status: toStatus, updatedAt: serverTimestamp() };
  if (toStatus === APPLICATION_STATUS.ACCEPTED || toStatus === APPLICATION_STATUS.REJECTED) {
    patch.decision = toStatus;
    patch.decisionNotes = note;
    patch.decidedAt = serverTimestamp();
  }
  await updateDoc(doc(db, "applications", appId), patch);
  await addDoc(collection(db, "applicationEvents"), {
    applicationId: appId,
    from: current.status,
    to: toStatus,
    note: note || null,
    actorId,
    createdAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "application.moved",
    targetType: "application",
    targetId: appId,
    detail: `${current.status} → ${toStatus}`,
  });
  const decided =
    toStatus === APPLICATION_STATUS.ACCEPTED || toStatus === APPLICATION_STATUS.REJECTED;
  // Owner scope: the applicant tracks their own application.
  await notifyEvent({
    type: decided ? "application.decided" : "application.moved",
    recipients: [current.applicantId],
    title: decided ? `Application ${toStatus.toLowerCase()}` : "Application update",
    message: decided
      ? `Your application "${current.enterpriseName || ""}" has been ${toStatus.toLowerCase()}.${note ? ` Note: ${note}` : ""}`
      : `Your application "${current.enterpriseName || ""}" moved to ${toStatus}.`,
    relatedType: "application",
    relatedId: appId,
  });
  if (decided) {
    // Oversight scope: Management sees decisions, not the daily queue.
    await notifyRoles({
      roles: ["Management"],
      excludeUid: actorId,
      type: "application.decided",
      title: `Application ${toStatus.toLowerCase()}`,
      message: `"${current.enterpriseName || "An application"}" was ${toStatus.toLowerCase()}.`,
      relatedType: "application",
      relatedId: appId,
      dedupeKey: `app-decision:${appId}`,
    });
  }
}

function sortByUpdatedDesc(list) {
  return [...list].sort(
    (a, b) => (toDateSafe(b.updatedAt)?.getTime() || 0) - (toDateSafe(a.updatedAt)?.getTime() || 0)
  );
}

export function subscribeToMyApplications(applicantId, onUpdate) {
  if (!applicantId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "applications"), where("applicantId", "==", applicantId));
  return onSnapshot(
    q,
    (snap) => onUpdate(sortByUpdatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => console.error("Error subscribing to applications:", error)
  );
}

export function subscribeToAllApplications(onUpdate) {
  return onSnapshot(
    collection(db, "applications"),
    (snap) => onUpdate(sortByUpdatedDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => console.error("Error subscribing to applications:", error)
  );
}
