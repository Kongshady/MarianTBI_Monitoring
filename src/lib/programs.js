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
import { PROGRAM_STATUS, toDateSafe } from "./domain.js";
import { writeAuditEntry } from "./audit.js";

// Programs/cohorts data layer (additive).
// Shape: programs/{id} {
//   name, description, objectives, startDate, endDate, eligibility,
//   capacity (number|null), status, createdAt, updatedAt
// }
// Groups link via groups.programId (program doc id or null).

export const PROGRAM_EDITABLE_FIELDS = Object.freeze([
  "name",
  "description",
  "objectives",
  "startDate",
  "endDate",
  "eligibility",
  "capacity",
  "status",
]);

export function pickProgramFields(input) {
  const out = {};
  for (const key of PROGRAM_EDITABLE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  if (out.capacity === "" || out.capacity == null) {
    out.capacity = null;
  } else {
    const n = Number(out.capacity);
    out.capacity = Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  }
  if (!Object.values(PROGRAM_STATUS).includes(out.status)) {
    delete out.status;
  }
  return out;
}

export async function createProgram(actorId, input = {}) {
  if (!input.name?.trim()) throw new Error("Program name is required.");
  const ref = await addDoc(collection(db, "programs"), {
    ...pickProgramFields(input),
    name: input.name.trim(),
    status: input.status || PROGRAM_STATUS.DRAFT,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "program.created",
    targetType: "program",
    targetId: ref.id,
    detail: input.name.trim(),
  });
  return ref.id;
}

export async function updateProgram(programId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "programs", programId));
  if (!snap.exists()) throw new Error("Program not found.");
  await updateDoc(doc(db, "programs", programId), {
    ...pickProgramFields(patch),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "program.updated",
    targetType: "program",
    targetId: programId,
    detail: "",
  });
}

export async function deleteProgram(programId, actorId) {
  const snap = await getDoc(doc(db, "programs", programId));
  if (!snap.exists()) throw new Error("Program not found.");
  await deleteDoc(doc(db, "programs", programId));
  await writeAuditEntry({
    actorId,
    action: "program.deleted",
    targetType: "program",
    targetId: programId,
    detail: snap.data().name || "",
  });
}

export function subscribeToPrograms(onUpdate, onError) {
  return onSnapshot(
    collection(db, "programs"),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDateSafe(b.startDate)?.getTime() || 0) - (toDateSafe(a.startDate)?.getTime() || 0));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to programs:", error);
      if (onError) onError(error);
    }
  );
}
