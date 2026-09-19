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
import { ACTIVITY_TYPE, ATTENDANCE_STATUS, toDateSafe } from "./domain.js";
import { writeAuditEntry } from "./audit.js";

// Activities + attendance data layer (additive).
// activities/{id} { title, type, description, date, endDate?, location,
//   facilitator, programId?, createdAt, updatedAt }
// attendance/{id} { activityId, userId, userName, groupId?, groupName?,
//   status, createdAt }

export const ACTIVITY_EDITABLE_FIELDS = Object.freeze([
  "title",
  "type",
  "description",
  "date",
  "endDate",
  "location",
  "facilitator",
  "programId",
]);

export function pickActivityFields(input) {
  const out = {};
  for (const key of ACTIVITY_EDITABLE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  if (out.programId === "") out.programId = null;
  if (out.endDate === "") out.endDate = null;
  if (out.type && !Object.values(ACTIVITY_TYPE).includes(out.type)) {
    delete out.type;
  }
  return out;
}

export async function createActivity(actorId, input = {}) {
  if (!input.title?.trim()) throw new Error("Activity title is required.");
  if (!input.date) throw new Error("Activity date is required.");
  const ref = await addDoc(collection(db, "activities"), {
    ...pickActivityFields(input),
    title: input.title.trim(),
    type: input.type || ACTIVITY_TYPE.OTHER,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "activity.created",
    targetType: "activity",
    targetId: ref.id,
    detail: input.title.trim(),
  });
  return ref.id;
}

export async function updateActivity(activityId, actorId, patch = {}) {
  const snap = await getDoc(doc(db, "activities", activityId));
  if (!snap.exists()) throw new Error("Activity not found.");
  await updateDoc(doc(db, "activities", activityId), {
    ...pickActivityFields(patch),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: "activity.updated",
    targetType: "activity",
    targetId: activityId,
    detail: "",
  });
}

export async function deleteActivity(activityId, actorId) {
  const snap = await getDoc(doc(db, "activities", activityId));
  if (!snap.exists()) throw new Error("Activity not found.");
  await deleteDoc(doc(db, "activities", activityId));
  await writeAuditEntry({
    actorId,
    action: "activity.deleted",
    targetType: "activity",
    targetId: activityId,
    detail: snap.data().title || "",
  });
}

function sortByDateAsc(list) {
  return [...list].sort(
    (a, b) => (toDateSafe(a.date)?.getTime() || 0) - (toDateSafe(b.date)?.getTime() || 0)
  );
}

export function subscribeToActivities(onUpdate, onError) {
  return onSnapshot(
    collection(db, "activities"),
    (snap) => onUpdate(sortByDateAsc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("Error subscribing to activities:", error);
      if (onError) onError(error);
    }
  );
}

export function subscribeToProgramActivities(programId, onUpdate, onError) {
  if (!programId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "activities"), where("programId", "==", programId));
  return onSnapshot(
    q,
    (snap) => onUpdate(sortByDateAsc(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("Error subscribing to program activities:", error);
      if (onError) onError(error);
    }
  );
}

// ---- attendance ----
export async function registerAttendance(activityId, user, group = null) {
  if (!activityId || !user?.id) throw new Error("Activity and user are required.");
  const ref = await addDoc(collection(db, "attendance"), {
    activityId,
    userId: user.id,
    incubateeId: user.id,
    userName: `${user.name || ""} ${user.lastname || ""}`.trim() || user.email || "Participant",
    groupId: group?.id || null,
    groupName: group?.name || "",
    status: ATTENDANCE_STATUS.REGISTERED,
    createdAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId: user.id,
    action: "attendance.registered",
    targetType: "attendance",
    targetId: ref.id,
    detail: activityId,
  });
  return ref.id;
}

export async function markAttendance(recordId, actorId, status) {
  if (!Object.values(ATTENDANCE_STATUS).includes(status)) {
    throw new Error(`Invalid attendance status "${status}".`);
  }
  await updateDoc(doc(db, "attendance", recordId), { status });
  await writeAuditEntry({
    actorId,
    action: "attendance.marked",
    targetType: "attendance",
    targetId: recordId,
    detail: status,
  });
}

export async function removeAttendance(recordId, actorId) {
  await deleteDoc(doc(db, "attendance", recordId));
  await writeAuditEntry({
    actorId,
    action: "attendance.removed",
    targetType: "attendance",
    targetId: recordId,
    detail: "",
  });
}

export function subscribeToActivityAttendance(activityId, onUpdate, onError) {
  if (!activityId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "attendance"), where("activityId", "==", activityId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.userName || "").localeCompare(b.userName || ""));
      onUpdate(list);
    },
    (error) => {
      console.error("Error subscribing to attendance:", error);
      if (onError) onError(error);
    }
  );
}

export function subscribeToMyAttendance(userId, onUpdate, onError) {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, "attendance"), where("userId", "==", userId));
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error("Error subscribing to my attendance:", error);
      if (onError) onError(error);
    }
  );
}
