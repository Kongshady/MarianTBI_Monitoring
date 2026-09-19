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

// Assessments data layer (additive). Formal staff evaluations —
// free-text findings, no invented scoring.
// Shape: assessments/{id} {
//   groupId, type (Initial/Periodic/Mid-program/Final), assessmentDate,
//   assessorName, criteria, findings, recommendations, followUps,
//   createdAt, updatedAt
// }

export const ASSESSMENT_TYPE = Object.freeze({
  INITIAL: "Initial",
  PERIODIC: "Periodic",
  MID_PROGRAM: "Mid-program",
  FINAL: "Final",
});

export const ASSESSMENT_TYPE_LIST = Object.freeze(Object.values(ASSESSMENT_TYPE));

export const ASSESSMENT_EDITABLE_FIELDS = Object.freeze([
  "type",
  "assessmentDate",
  "assessorName",
  "criteria",
  "findings",
  "recommendations",
  "followUps",
]);

export function pickAssessmentFields(input) {
  const out = {};
  for (const key of ASSESSMENT_EDITABLE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  if (out.type && !ASSESSMENT_TYPE_LIST.includes(out.type)) {
    delete out.type;
  }
  return out;
}

export async function createAssessment(groupId, actorId, input = {}) {
  if (!groupId) throw new Error("Startup is required.");
  if (!input.assessmentDate) throw new Error("Assessment date is required.");
  if (!input.findings?.trim()) throw new Error("Findings are required.");
  const ref = await addDoc(collection(db, "assessments"), {
    groupId,
    ...pickAssessmentFields(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "assessment.created",
    targetType: "assessment",
    targetId: ref.id,
    detail: groupId,
  });
  return ref.id;
}

export async function updateAssessment(assessmentId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "assessments", assessmentId));
  if (!snap.exists()) throw new Error("Assessment not found.");
  await updateDoc(doc(db, "assessments", assessmentId), {
    ...pickAssessmentFields(patch),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "assessment.updated",
    targetType: "assessment",
    targetId: assessmentId,
    detail: "",
  });
}

export async function deleteAssessment(assessmentId, actorId) {
  const snap = await getDoc(doc(db, "assessments", assessmentId));
  if (!snap.exists()) throw new Error("Assessment not found.");
  await deleteDoc(doc(db, "assessments", assessmentId));
  await writeAuditEntry({
    actorId,
    action: "assessment.created",
    targetType: "assessment",
    targetId: assessmentId,
    detail: snap.data().groupId || "",
  });
  // Incubatee scope: the assessed person learns about the evaluation.
  const groupRef = snap.data().groupId ? doc(db, "groups", snap.data().groupId) : null;
  if (groupRef) {
    const gSnap = await getDoc(groupRef);
    const gData = gSnap.data();
    await notifyEvent({
      type: "assessment.created",
      recipients: [gData?.incubateeId].filter(Boolean),
      title: "Assessment created",
      message: `A ${snap.data().type || "assessment"} has been recorded for your group.`,
      relatedType: "group",
      relatedId: snap.data().groupId || null,
      groupId: snap.data().groupId || null,
    });
  }
}

export function subscribeToGroupAssessments(groupId, onUpdate, onError) {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "assessments"), where("groupId", "==", groupId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.assessmentDate)?.getTime() || 0) - (toDateSafe(a.assessmentDate)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to assessments:", error);
      if (onError) onError(error);
    }
  );
}
