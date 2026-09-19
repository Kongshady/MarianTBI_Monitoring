import { useEffect, useState } from "react";
import StatusBadge from "../ui/StatusBadge.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";
import {
  DOCUMENT_TYPES,
  deleteDocument,
  subscribeToScopeDocuments,
  uploadDocument,
  validateDocumentFile,
  verifyDocument,
} from "../../lib/documents.js";

// Shared documents view: owners upload (auto-Submitted), staff verify or
// reject with notes, managers delete. Files preview/download via signed,
// unguessable Storage URLs. Props: scope ('application'|'group'), scopeId,
// owner {id,name,lastname,email}, canUpload, canVerify, canDelete.
function DocumentsPanel({ scope, scopeId, owner, canUpload, canVerify, canDelete, onCount }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState(DOCUMENT_TYPES[0]);
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    return subscribeToScopeDocuments(
      scope,
      scopeId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      () => {
        setError("Failed to load documents.");
        setLoading(false);
      }
    );
  }, [scope, scopeId]);

  // Optional head-count for overview metrics; the panel owns its data.
  useEffect(() => {
    if (onCount) onCount(items.length);
  }, [items, onCount]);

  const handleFileChange = (e) => {
    const chosen = e.target.files?.[0] || null;
    setFile(chosen);
    setFormError(chosen ? validateDocumentFile(chosen) : "");
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const fileError = validateDocumentFile(file);
    if (!docType) {
      setFormError("Document type is required.");
      return;
    }
    if (fileError) {
      setFormError(fileError);
      return;
    }
    setUploading(true);
    try {
      await uploadDocument({ owner, scope, scopeId, docType, file });
      setFile(null);
      setFormError("");
      toast("Document submitted for verification.");
    } catch (err) {
      console.error("Error uploading document:", err);
      setFormError(err.message || "Failed to upload the document.");
    } finally {
      setUploading(false);
    }
  };

  const handleVerify = async (item, approved) => {
    const notes = (reviewNotes[item.id] || "").trim();
    if (!approved && !notes) {
      setFormError("A reason is required to reject a document.");
      return;
    }
    try {
      await verifyDocument(item.id, owner.id, { approved, notes });
      toast(approved ? "Document verified." : "Document rejected.");
    } catch (err) {
      console.error("Error reviewing document:", err);
      setFormError(err.message || "Failed to review the document.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteDocument(pendingDelete.id, owner.id);
      toast("Document deleted.");
    } catch (err) {
      console.error("Error deleting document:", err);
      setFormError(err.message || "Failed to delete the document.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="mt-2 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h3 className="font-bold text-lg">Documents</h3>
      </div>

      {canUpload && (
        <form onSubmit={handleUpload} className="bg-white border border-line rounded p-4 mb-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div>
              <label className="tbi-label" htmlFor={`doctype-${scopeId}`}>
                Document type
              </label>
              <select
                id={`doctype-${scopeId}`}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="tbi-input"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="tbi-label" htmlFor={`docfile-${scopeId}`}>
                File (max 10 MB)
              </label>
              <input
                id={`docfile-${scopeId}`}
                type="file"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-600 file:mr-3 file:px-3 file:py-2 file:border file:border-line file:rounded file:text-[13px] file:font-medium file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
              />
            </div>
            <div>
              <button
                type="submit"
                disabled={uploading || !file}
                className="w-full px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition disabled:opacity-60"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
          {formError && (
            <p className="text-red-600 text-[13px] mt-2" role="alert">
              {formError}
            </p>
          )}
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading documents...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">
          No documents yet. {canUpload ? "Upload the first required document above." : ""}
        </p>
      ) : (
        <ul className="bg-white border border-line rounded divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="p-4">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.fileName}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {item.docType} · by {item.ownerName || "—"} ·{" "}
                    {formatDateTimeSafe(toDateSafe(item.createdAt))}
                    {item.fileSize ? ` · ${(item.fileSize / 1024).toFixed(0)} KB` : ""}
                  </p>
                  {item.notes && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                      <span className="font-medium">Reviewer note: </span>
                      {item.notes}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={item.status} />
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 border border-line rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Open
                  </a>
                  {canDelete && (
                    <button
                      onClick={() => setPendingDelete(item)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              {canVerify && item.status === "Submitted" && (
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <input
                    type="text"
                    value={reviewNotes[item.id] || ""}
                    onChange={(e) => setReviewNotes((p) => ({ ...p, [item.id]: e.target.value }))}
                    placeholder="Review note (required to reject)"
                    aria-label={`Review note for ${item.fileName}`}
                    className="tbi-input flex-1 min-w-[200px]"
                  />
                  <button
                    onClick={() => handleVerify(item, true)}
                    className="px-3 py-2 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => handleVerify(item, false)}
                    className="px-3 py-2 bg-white border border-line text-red-600 rounded text-xs font-medium hover:bg-red-50 transition"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`Delete "${pendingDelete?.fileName}"?`}
        description="The file and its record are removed. This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default DocumentsPanel;
