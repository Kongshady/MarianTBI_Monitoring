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

// Internal review notes (additive). Staff-only deliberation on applications —
// applicants see decisions and returned-for-revision reasons via the
// application doc + applicationEvents, never these notes. See firestore.rules.

export const REVIEW_KIND = Object.freeze({
  SCREENING: "Screening",
  EVALUATION: "Evaluation",
  DECISION: "Decision",
});

export const REVIEW_KIND_LIST = Object.freeze(Object.values(REVIEW_KIND));

export async function createReviewNote(applicationId, actorId, input = {}) {
  if (!applicationId) throw new Error("Application is required.");
  if (!input.findings?.trim()) throw new Error("Findings are required.");
  const ref = await addDoc(collection(db, "reviewNotes"), {
    applicationId,
    kind: REVIEW_KIND_LIST.includes(input.kind) ? input.kind : REVIEW_KIND.SCREENING,
    findings: input.findings.trim(),
    recommendation: input.recommendation?.trim() || "",
    actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "review.note_created",
    targetType: "application",
    targetId: applicationId,
    detail: ref.id,
  });
  return ref.id;
}

export async function updateReviewNote(noteId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "reviewNotes", noteId));
  if (!snap.exists()) throw new Error("Note not found.");
  const out = {};
  if (patch.findings !== undefined) out.findings = patch.findings;
  if (patch.recommendation !== undefined) out.recommendation = patch.recommendation;
  if (patch.kind !== undefined && REVIEW_KIND_LIST.includes(patch.kind)) out.kind = patch.kind;
  await updateDoc(doc(db, "reviewNotes", noteId), { ...out, updatedAt: serverTimestamp() });
  await writeAuditEntry({
    actorId,
    action: "review.note_updated",
    targetType: "application",
    targetId: snap.data().applicationId || "",
    detail: noteId,
  });
}

export async function deleteReviewNote(noteId, actorId) {
  const snap = await getDoc(doc(db, "reviewNotes", noteId));
  if (!snap.exists()) throw new Error("Note not found.");
  await deleteDoc(doc(db, "reviewNotes", noteId));
  await writeAuditEntry({
    actorId,
    action: "review.note_deleted",
    targetType: "application",
    targetId: snap.data().applicationId || "",
    detail: noteId,
  });
}

export function subscribeToReviewNotes(applicationId, onUpdate, onError) {
  if (!applicationId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "reviewNotes"), where("applicationId", "==", applicationId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to review notes:", error);
      if (onError) onError(error);
    }
  );
}
