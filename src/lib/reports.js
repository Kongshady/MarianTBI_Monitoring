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
import { REPORT_STATUS, REPORT_TRANSITIONS, canTransition, toDateSafe } from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent, notifyRoles } from "./notifications.js";

// Progress reports data layer (additive).
// Shape: progressReports/{id} {
//   groupId, incubateeId (owner uid), reportingPeriod, accomplishments,
//   challenges, milestonesCompleted, milestonesDelayed, businessUpdates,
//   supportNeeded, status, feedback, createdAt, updatedAt, submittedAt?, reviewedAt?
// }
// Owner drafts/submits; staff review. See firestore.rules.

export const REPORT_EDITABLE_FIELDS = Object.freeze([
  "reportingPeriod",
  "accomplishments",
  "challenges",
  "milestonesCompleted",
  "milestonesDelayed",
  "businessUpdates",
  "supportNeeded",
]);

export function pickReportFields(input) {
  const out = {};
  for (const key of REPORT_EDITABLE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

export async function createReport(groupId, actorId, input = {}) {
  if (!groupId) throw new Error("Startup is required.");
  if (!input.reportingPeriod?.trim()) throw new Error("Reporting period is required.");
  const ref = await addDoc(collection(db, "progressReports"), {
    groupId,
    incubateeId: actorId,
    status: REPORT_STATUS.DRAFT,
    ...pickReportFields({ ...input, reportingPeriod: input.reportingPeriod.trim() }),
    feedback: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "report.created",
    targetType: "report",
    targetId: ref.id,
    detail: groupId,
  });
  return ref.id;
}

export async function updateDraftReport(reportId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "progressReports", reportId));
  if (!snap.exists()) throw new Error("Report not found.");
  const current = snap.data();
  if (current.incubateeId !== actorId) throw new Error("Only the owner may edit this report.");
  if (![REPORT_STATUS.DRAFT, REPORT_STATUS.NEEDS_REVISION].includes(current.status)) {
    throw new Error(`Cannot edit a report with status "${current.status}".`);
  }
  await updateDoc(doc(db, "progressReports", reportId), {
    ...pickReportFields(patch),
    status: REPORT_STATUS.DRAFT,
    updatedAt: serverTimestamp(),
  });
}

export async function submitReport(reportId, actorId) {
  const snap = await getDoc(doc(db, "progressReports", reportId));
  if (!snap.exists()) throw new Error("Report not found.");
  const current = snap.data();
  if (current.incubateeId !== actorId) throw new Error("Only the owner may submit.");
  if (!canTransition(REPORT_TRANSITIONS, current.status, REPORT_STATUS.SUBMITTED)) {
    throw new Error(`Cannot submit from status "${current.status}".`);
  }
  await updateDoc(doc(db, "progressReports", reportId), {
    status: REPORT_STATUS.SUBMITTED,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "report.submitted",
    targetType: "report",
    targetId: reportId,
    detail: current.groupId || "",
  });
  // Staff reviewers pick it up from the review queue.
  await notifyRoles({
    roles: ["TBI Manager", "TBI Assistant"],
    excludeUid: actorId,
    type: "report.submitted",
    title: "Progress report submitted",
    message: `A progress report is waiting for review${current.reportingPeriod ? ` (${current.reportingPeriod})` : ""}.`,
    relatedType: "group",
    relatedId: current.groupId || null,
    groupId: current.groupId || null,
  });
}

export async function reviewReport(reportId, actorId, toStatus, feedback = "") {
  const snap = await getDoc(doc(db, "progressReports", reportId));
  if (!snap.exists()) throw new Error("Report not found.");
  const current = snap.data();
  if (!canTransition(REPORT_TRANSITIONS, current.status, toStatus)) {
    throw new Error(`Invalid transition "${current.status}" → "${toStatus}".`);
  }
  const patch = { status: toStatus, updatedAt: serverTimestamp() };
  if (toStatus === REPORT_STATUS.APPROVED || toStatus === REPORT_STATUS.NEEDS_REVISION) {
    patch.feedback = feedback;
    patch.reviewedAt = serverTimestamp();
  }
  await updateDoc(doc(db, "progressReports", reportId), patch);
  await writeAuditEntry({
    actorId,
    action: "report.reviewed",
    targetType: "report",
    targetId: reportId,
    detail: `${current.status} → ${toStatus}`,
  });
  // Owner scope: the author learns the review outcome.
  await notifyEvent({
    type: "report.reviewed",
    recipients: [current.incubateeId || current.applicantId].filter(Boolean),
    title: `Report ${toStatus.toLowerCase()}`,
    message: `Your progress report was ${toStatus.toLowerCase()}.${feedback ? ` Feedback: ${feedback}` : ""}`,
    relatedType: "group",
    relatedId: current.groupId || null,
    groupId: current.groupId || null,
  });
}

export async function deleteReport(reportId, actorId) {
  const snap = await getDoc(doc(db, "progressReports", reportId));
  if (!snap.exists()) throw new Error("Report not found.");
  await deleteDoc(doc(db, "progressReports", reportId));
  await writeAuditEntry({
    actorId,
    action: "report.deleted",
    targetType: "report",
    targetId: reportId,
    detail: snap.data().groupId || "",
  });
}

export function subscribeToGroupReports(groupId, onUpdate, onError) {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "progressReports"), where("groupId", "==", groupId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to reports:", error);
      if (onError) onError(error);
    }
  );
}
