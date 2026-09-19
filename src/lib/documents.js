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
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../config/marian-config.js";
import { DOCUMENT_STATUS, toDateSafe } from "./domain.js";
import { writeAuditEntry } from "./audit.js";
import { notifyEvent, notifyRoles } from "./notifications.js";

// Documents data layer (additive).
// Firestore: documents/{id} {
//   ownerId, ownerName, scope ('application' | 'group'), scopeId,
//   docType, fileName, fileUrl, filePath, fileSize, status,
//   reviewerId?, reviewedAt?, notes?, createdAt, updatedAt
// }
// Files live in Storage documents/{scopeId}/{timestamp}_{safeName}.
// Listing is gated by Firestore rules (owner/staff); file URLs are
// unguessable and Storage allows only signed-in reads.

export const DOCUMENT_TYPES = Object.freeze([
  "Business Plan",
  "Registration Certificate",
  "Valid ID",
  "Financial Statement",
  "Product Photos",
  "Endorsement Letter",
  "Progress Attachment",
  "Other",
]);

export const DOCUMENT_SCOPES = Object.freeze({
  APPLICATION: "application",
  GROUP: "group",
});

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function safeFileName(name) {
  return String(name || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function validateDocumentFile(file) {
  if (!file) return "Choose a file to upload.";
  if (file.size > MAX_FILE_BYTES) return "File must be smaller than 10 MB.";
  return "";
}

// Uploads the file, then creates the metadata doc as Submitted.
export async function uploadDocument({ owner, scope, scopeId, docType, file, onProgress }) {
  if (!owner?.id) throw new Error("Owner is required.");
  if (!Object.values(DOCUMENT_SCOPES).includes(scope)) throw new Error("Invalid document scope.");
  if (!scopeId) throw new Error("Related record is required.");
  if (!docType) throw new Error("Document type is required.");
  const fileError = validateDocumentFile(file);
  if (fileError) throw new Error(fileError);

  const path = `documents/${scopeId}/${Date.now()}_${safeFileName(file.name)}`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file);
  if (onProgress) onProgress();
  const url = await getDownloadURL(fileRef);

  const docRef = await addDoc(collection(db, "documents"), {
    ownerId: owner.id,
    ownerName: `${owner.name || ""} ${owner.lastname || ""}`.trim() || owner.email || "",
    scope,
    scopeId,
    docType,
    fileName: file.name,
    fileUrl: url,
    filePath: path,
    fileSize: file.size,
    status: DOCUMENT_STATUS.SUBMITTED,
    reviewerId: null,
    reviewedAt: null,
    notes: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId: owner.id,
    action: "document.submitted",
    targetType: "document",
    targetId: docRef.id,
    detail: `${docType} · ${scope}/${scopeId}`,
  });
  // Staff reviewers pick it up from the verification queue.
  await notifyRoles({
    roles: ["TBI Manager", "TBI Assistant"],
    excludeUid: owner.id,
    type: "document.submitted",
    title: "Document submitted for review",
    message: `${owner.name || "Someone"} uploaded ${docType}.`,
    relatedType: scope === "group" ? "group" : null,
    relatedId: scope === "group" ? scopeId : null,
    groupId: scope === "group" ? scopeId : null,
  });
  return docRef.id;
}

export async function verifyDocument(documentId, actorId, { approved, notes = "" }) {
  const snap = await getDoc(doc(db, "documents", documentId));
  if (!snap.exists()) throw new Error("Document not found.");
  const to = approved ? DOCUMENT_STATUS.VERIFIED : DOCUMENT_STATUS.REJECTED;
  await updateDoc(doc(db, "documents", documentId), {
    status: to,
    reviewerId: actorId,
    reviewedAt: serverTimestamp(),
    notes: notes.trim(),
    updatedAt: serverTimestamp(),
  });
  await writeAuditEntry({
    actorId,
    action: approved ? "document.verified" : "document.rejected",
    targetType: "document",
    targetId: documentId,
    detail: notes.trim(),
  });
  // Owner scope: the uploader learns the verdict.
  const verifiedDoc = snap.data();
  await notifyEvent({
    type: "document.verified",
    recipients: [verifiedDoc.ownerId],
    title: approved ? "Document verified" : "Document needs attention",
    message: approved
      ? `Your ${verifiedDoc.docType || "document"} was verified.`
      : `Your ${verifiedDoc.docType || "document"} was not approved.${notes.trim() ? ` Note: ${notes.trim()}` : ""}`,
    relatedType: verifiedDoc.scope === "group" ? "group" : null,
    relatedId: verifiedDoc.scope === "group" ? verifiedDoc.scopeId : null,
    groupId: verifiedDoc.scope === "group" ? verifiedDoc.scopeId : null,
  });
}

export async function deleteDocument(documentId, actorId) {
  const snap = await getDoc(doc(db, "documents", documentId));
  if (!snap.exists()) throw new Error("Document not found.");
  const data = snap.data();
  await deleteDoc(doc(db, "documents", documentId));
  if (data.filePath) {
    try {
      await deleteObject(ref(storage, data.filePath));
    } catch (err) {
      console.error("Error deleting document file:", err);
    }
  }
  await writeAuditEntry({
    actorId,
    action: "document.deleted",
    targetType: "document",
    targetId: documentId,
    detail: data.docType || "",
  });
}

function sortNewest(list) {
  return [...list].sort(
    (a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0)
  );
}

export function subscribeToScopeDocuments(scope, scopeId, onUpdate, onError) {
  if (!scope || !scopeId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, "documents"),
    where("scope", "==", scope),
    where("scopeId", "==", scopeId)
  );
  return onSnapshot(
    q,
    (snap) => onUpdate(sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("Error subscribing to documents:", error);
      if (onError) onError(error);
    }
  );
}

export function subscribeToPendingDocuments(onUpdate, onError) {
  const q = query(collection(db, "documents"), where("status", "==", DOCUMENT_STATUS.SUBMITTED));
  return onSnapshot(
    q,
    (snap) => onUpdate(sortNewest(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
    (error) => {
      console.error("Error subscribing to pending documents:", error);
      if (onError) onError(error);
    }
  );
}
