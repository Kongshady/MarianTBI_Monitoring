import { useEffect, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { Button } from "../ui/button.jsx";
import { SectionHeader } from "../ui/PageHeader.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.jsx";
import { InlineLoading } from "../ui/states.jsx";
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
function ReportsPanel({ groupId, actorId, canSubmit, canReview, onCount }) {
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
        description:
          toStatus === REPORT_STATUS.NEEDS_REVISION
            ? "The owner will be asked to revise."
            : undefined,
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
      <SectionHeader
        hint="Periodic progress reports. Owners draft and submit; staff review and give feedback."
        count={items.length}
        action={
          canSubmit ? (
            <Button onClick={openCreate} size="sm">
              New report
            </Button>
          ) : null
        }
      >
        Progress reports
      </SectionHeader>

      {canReview && awaitingReview > 0 && (
        <p className="mt-3.5 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-900">
          {awaitingReview} report{awaitingReview === 1 ? "" : "s"} awaiting review.
        </p>
      )}

      <div className="mt-4">
        {loading ? (
          <InlineLoading label="Loading reports…" />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No reports yet.{" "}
            {canSubmit ? "Submit the first progress report for this period." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
            {items.map((r) => {
              const next = REPORT_TRANSITIONS[r.status] || [];
              const isOwner = r.incubateeId === actorId;
              const editable =
                isOwner &&
                [REPORT_STATUS.DRAFT, REPORT_STATUS.NEEDS_REVISION].includes(r.status);
              return (
                <li key={r.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {r.reportingPeriod}
                        </p>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.submittedAt && (
                        <p className="mt-0.5 text-xs text-muted">
                          Submitted {formatDateTimeSafe(toDateSafe(r.submittedAt))}
                        </p>
                      )}
                      {r.accomplishments && (
                        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                          <span className="font-medium text-slate-700">Accomplishments: </span>
                          {r.accomplishments}
                        </p>
                      )}
                      {r.challenges && (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                          <span className="font-medium text-slate-700">Challenges: </span>
                          {r.challenges}
                        </p>
                      )}
                      {r.supportNeeded && (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                          <span className="font-medium text-slate-700">Support needed: </span>
                          {r.supportNeeded}
                        </p>
                      )}
                      {r.feedback && (
                        <p
                          className={`mt-2.5 rounded-md border-l-2 px-3 py-2 text-[13px] leading-relaxed ${
                            r.status === REPORT_STATUS.NEEDS_REVISION
                              ? "border-amber-400 bg-amber-50 text-amber-900"
                              : "border-line-strong bg-surface-sunken text-slate-600"
                          }`}
                        >
                          <span className="font-medium">Reviewer feedback: </span>
                          {r.feedback}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {editable && canSubmit && (
                        <Button onClick={() => openEdit(r)} variant="outline" size="sm">
                          Edit
                        </Button>
                      )}
                      {canReview &&
                        next.map((to) => (
                          <Button
                            key={to}
                            onClick={() => handleReview(r, to)}
                            variant="outline"
                            size="sm"
                            disabled={actingId === r.id}
                          >
                            {to}
                          </Button>
                        ))}
                      {(canReview || (editable && r.status === REPORT_STATUS.DRAFT)) && (
                        <Button
                          onClick={() => handleDelete(r)}
                          variant="ghost"
                          size="sm"
                          className="text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>

                  {canReview && next.length > 0 && (
                    <div className="mt-2.5 max-w-sm">
                      <label
                        className="tbi-label"
                        htmlFor={`rep-feedback-${r.id}`}
                      >
                        Reviewer feedback
                      </label>
                      <input
                        id={`rep-feedback-${r.id}`}
                        type="text"
                        value={actingId === r.id ? feedback : ""}
                        onChange={(e) => {
                          setActingId(r.id);
                          setFeedback(e.target.value);
                        }}
                        placeholder="Required when requesting revision"
                        className="tbi-input"
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formError && !showForm && <p className="mt-2 text-sm text-red-600">{formError}</p>}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit progress report" : "New progress report"}
              </DialogTitle>
              <DialogDescription>
                {editing
                  ? "Save a draft, or submit it to staff for review."
                  : "Saved as a draft until you submit it for review."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="tbi-label" htmlFor="rep-period">
                  Reporting period <span className="text-red-600">*</span>
                </label>
                <input
                  id="rep-period"
                  type="text"
                  value={form.reportingPeriod}
                  onChange={(e) => setForm((p) => ({ ...p, reportingPeriod: e.target.value }))}
                  className="tbi-input"
                  placeholder="e.g. March 2026"
                />
              </div>
              {FIELD_DEFS.map((f) => (
                <div key={f.key}>
                  <label className="tbi-label" htmlFor={`rep-${f.key}`}>
                    {f.label}
                  </label>
                  <textarea
                    id={`rep-${f.key}`}
                    value={form[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    rows="2"
                    className="tbi-input"
                  />
                </div>
              ))}
            </div>

            {editing?.feedback && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                <span className="font-medium">Reviewer feedback: </span>
                {editing.feedback}
              </p>
            )}
            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={saving}>
                {saving ? "Saving…" : "Save draft"}
              </Button>
              {editing && (
                <Button type="button" onClick={handleSubmit} disabled={saving}>
                  Submit for review
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
