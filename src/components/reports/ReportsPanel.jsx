import { useEffect, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { REPORT_STATUS, REPORT_TRANSITIONS, formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";
import {
  createReport,
  deleteReport,
  reviewReport,
  submitReport,
  subscribeToGroupReports,
  updateDraftReport,
} from "../../lib/reports.js";

const FIELD_DEFS = [
  { key: "accomplishments", label: "Accomplishments" },
  { key: "challenges", label: "Challenges" },
  { key: "milestonesCompleted", label: "Milestones completed" },
  { key: "milestonesDelayed", label: "Milestones delayed" },
  { key: "businessUpdates", label: "Business / product updates" },
  { key: "supportNeeded", label: "Support needed" },
];

const EMPTY_FORM = {
  reportingPeriod: "",
  accomplishments: "",
  challenges: "",
  milestonesCompleted: "",
  milestonesDelayed: "",
  businessUpdates: "",
  supportNeeded: "",
};

// Shared progress-report view: owner drafts/submits; staff review with
// feedback. Props: canSubmit (owner-side), canReview (staff-side).
function ReportsPanel({ groupId, actorId, canSubmit, canReview, accentColor, onCount }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actingId, setActingId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const accent = accentColor || "bg-accent";

  useEffect(() => {
    setLoading(true);
    setError("");
    return subscribeToGroupReports(
      groupId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      () => {
        setError("Failed to load reports.");
        setLoading(false);
      }
    );
  }, [groupId]);

  // Optional head-count for overview metrics; the panel owns its data.
  useEffect(() => {
    if (onCount) onCount(items.length);
  }, [items, onCount]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (report) => {
    setForm({
      reportingPeriod: report.reportingPeriod || "",
      accomplishments: report.accomplishments || "",
      challenges: report.challenges || "",
      milestonesCompleted: report.milestonesCompleted || "",
      milestonesDelayed: report.milestonesDelayed || "",
      businessUpdates: report.businessUpdates || "",
      supportNeeded: report.supportNeeded || "",
    });
    setEditing(report);
    setFormError("");
    setFeedback(report.feedback || "");
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.reportingPeriod.trim()) {
      setFormError("Reporting period is required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateDraftReport(editing.id, actorId, form);
        toast("Draft saved.");
      } else {
        await createReport(groupId, actorId, form);
        toast("Report created.");
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error("Error saving report:", err);
      setFormError(err.message || "Failed to save the report.");
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleSubmit = async () => {
    if (!editing) return;
    setConfirm({
      title: "Submit this report for review?",
      description: "You can still revise it if reviewers request changes.",
      confirmLabel: "Submit",
      run: async () => {
        setSaving(true);
        try {
          await updateDraftReport(editing.id, actorId, form);
          await submitReport(editing.id, actorId);
          setShowForm(false);
          setEditing(null);
          toast("Report submitted for review.");
        } catch (err) {
          console.error("Error submitting report:", err);
          setFormError(err.message || "Failed to submit the report.");
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleReview = async (report, toStatus) => {
    if (toStatus === REPORT_STATUS.APPROVED || toStatus === REPORT_STATUS.NEEDS_REVISION) {
      if (toStatus === REPORT_STATUS.NEEDS_REVISION && !feedback.trim()) {
        setFormError("Feedback is required when requesting revision.");
        return;
      }
      setConfirm({
        title: `Mark this report "${toStatus}"?`,
        description: toStatus === REPORT_STATUS.NEEDS_REVISION ? "The owner will be asked to revise." : undefined,
        confirmLabel: toStatus,
        danger: toStatus === REPORT_STATUS.NEEDS_REVISION,
        run: async () => {
          setActingId(report.id);
          try {
            await reviewReport(report.id, actorId, toStatus, feedback.trim());
            setFeedback("");
            setFormError("");
            toast(`Report marked ${toStatus}.`);
          } catch (err) {
            console.error("Error reviewing report:", err);
            setFormError(err.message || "Failed to review the report.");
          } finally {
            setActingId(null);
          }
        },
      });
      return;
    }
    setActingId(report.id);
    try {
      await reviewReport(report.id, actorId, toStatus, feedback.trim());
      setFeedback("");
      setFormError("");
    } catch (err) {
      console.error("Error reviewing report:", err);
      setFormError(err.message || "Failed to review the report.");
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (report) => {
    setConfirm({
      title: "Delete this report?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        try {
          await deleteReport(report.id, actorId);
          toast("Report deleted.");
        } catch (err) {
          console.error("Error deleting report:", err);
          setFormError(err.message || "Failed to delete the report.");
        }
      },
    });
  };

  const awaitingReview = items.filter((r) =>
    [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_REVIEW].includes(r.status)
  ).length;

  return (
    <div className="mt-2 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h3 className="font-bold text-lg">Progress Reports</h3>
        {canSubmit && (
          <button
            onClick={openCreate}
            className={`${accent} text-white px-4 py-2 text-xs rounded-sm hover:bg-opacity-80 transition`}
          >
            + New Report
          </button>
        )}
      </div>

      {canReview && awaitingReview > 0 && (
        <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-sm p-2 mb-2">
          {awaitingReview} report{awaitingReview === 1 ? "" : "s"} awaiting review.
        </p>
      )}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading reports...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No reports yet. {canSubmit ? "Submit the first progress report for this period." : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => {
            const next = REPORT_TRANSITIONS[r.status] || [];
            const isOwner = r.incubateeId === actorId;
            const editable = isOwner && [REPORT_STATUS.DRAFT, REPORT_STATUS.NEEDS_REVISION].includes(r.status);
            return (
              <li key={r.id} className="bg-white border border-gray-200 rounded-sm p-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-800">{r.reportingPeriod}</p>
                    <p className="text-xs text-gray-500">
                      Status: {r.status}
                      {r.submittedAt ? ` · Submitted ${formatDateTimeSafe(toDateSafe(r.submittedAt))}` : ""}
                    </p>
                    {r.accomplishments && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Accomplishments: </span>
                        {r.accomplishments}
                      </p>
                    )}
                    {r.challenges && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Challenges: </span>
                        {r.challenges}
                      </p>
                    )}
                    {r.supportNeeded && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Support needed: </span>
                        {r.supportNeeded}
                      </p>
                    )}
                    {r.feedback && (
                      <p className={`text-xs mt-2 p-2 rounded-sm ${r.status === REPORT_STATUS.NEEDS_REVISION ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50 border border-gray-200"}`}>
                        <span className="font-medium">Reviewer feedback: </span>
                        {r.feedback}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {editable && canSubmit && (
                      <button
                        onClick={() => openEdit(r)}
                        className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100"
                      >
                        Edit
                      </button>
                    )}
                    {canReview &&
                      next.map((to) => (
                        <button
                          key={to}
                          onClick={() => handleReview(r, to)}
                          disabled={actingId === r.id}
                          className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100 disabled:opacity-60"
                        >
                          {to}
                        </button>
                      ))}
                    {(canReview || (editable && r.status === REPORT_STATUS.DRAFT)) && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="px-2 py-1 bg-red-500 text-white rounded-sm text-xs hover:bg-opacity-80"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {canReview && next.length > 0 && (
                  <input
                    type="text"
                    value={actingId === r.id ? feedback : ""}
                    onChange={(e) => {
                      setActingId(r.id);
                      setFeedback(e.target.value);
                    }}
                    placeholder="Feedback (required for revision)"
                    className="mt-2 w-full p-2 border rounded-sm text-xs"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {formError && <p className="text-red-500 text-sm mt-2">{formError}</p>}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50">
          <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-center">
              {editing ? "Edit Report" : "New Progress Report"}
            </h2>
            <label className="block text-sm font-medium mb-1" htmlFor="rep-period">
              Reporting period <span className="text-red-500">*</span>
            </label>
            <input
              id="rep-period"
              type="text"
              value={form.reportingPeriod}
              onChange={(e) => setForm((p) => ({ ...p, reportingPeriod: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-2"
              placeholder="e.g. March 2026"
            />
            {FIELD_DEFS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1" htmlFor={`rep-${f.key}`}>
                  {f.label}
                </label>
                <textarea
                  id={`rep-${f.key}`}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  rows="2"
                  className="w-full p-2 border rounded-sm text-sm mb-2"
                />
              </div>
            ))}
            {editing?.feedback && (
              <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-sm p-2 mb-2">
                <span className="font-medium">Reviewer feedback: </span>
                {editing.feedback}
              </p>
            )}
            {formError && <p className="text-red-500 text-sm mb-2">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-sm text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-gray-200 rounded-sm text-sm hover:bg-gray-300 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className={`${accent} px-4 py-2 text-white rounded-sm text-sm hover:bg-opacity-80 disabled:opacity-60`}
                >
                  Submit
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        danger={confirm?.danger || false}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => !confirmBusy && setConfirm(null)}
      />
    </div>
  );
}

export default ReportsPanel;
