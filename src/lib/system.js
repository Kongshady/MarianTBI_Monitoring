import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { writeAuditEntry } from "./audit.js";

// System settings (System Administrator only for writes).
// `systemSettings/registration` { open: boolean } gates public signup.
// Reads are public (single boolean via get) so logged-out signup pages can
// check it; writes are SysAdmin-only. Missing doc = open (bootstrap-safe:
// the first Manager is console-provisioned before any SysAdmin exists).
export async function getRegistrationOpen() {
  try {
    const snap = await getDoc(doc(db, "systemSettings", "registration"));
    if (!snap.exists()) return true;
    return snap.data().open !== false;
  } catch (error) {
    console.error("Error reading registration setting:", error);
    return true;
  }
}

export async function setRegistrationOpen(actorId, open) {
  await setDoc(
    doc(db, "systemSettings", "registration"),
    { open, updatedBy: actorId, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await writeAuditEntry({
    actorId,
    action: open ? "settings.registration.opened" : "settings.registration.closed",
    targetType: "settings",
    targetId: "registration",
    detail: "",
  });
}
