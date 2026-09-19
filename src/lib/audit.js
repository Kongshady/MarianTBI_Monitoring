import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../config/marian-config.js";

// Minimal audit trail for important staff actions.
// New `auditLog` collection; additive only — nothing existing is modified.
// Rules allow approved callers to append; reads are staff + sysadmin;
// updates and deletes are denied, so history cannot be rewritten.
export async function writeAuditEntry({ actorId, action, targetType, targetId, detail }) {
  try {
    await addDoc(collection(db, "auditLog"), {
      actorId: actorId || null,
      action: action || "unknown",
      targetType: targetType || null,
      targetId: targetId || null,
      detail: detail || null,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Audit must never break the primary action.
    console.error("Failed to write audit entry:", error);
  }
}

// Newest-first subscription for the audit viewer (capped for safety).
export function subscribeToAuditLog(onUpdate, onError) {
  const q = query(collection(db, "auditLog"), orderBy("createdAt", "desc"), limit(500));
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error("Error subscribing to audit log:", error);
      if (onError) onError(error);
    }
  );
}
