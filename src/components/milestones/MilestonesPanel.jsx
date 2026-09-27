import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { Button } from "../ui/button.jsx";
import { Progress } from "../ui/progress.jsx";
import { MetricRow } from "../ui/dashboard.jsx";
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
import {
  MILESTONE_STATUS,
  MILESTONE_TRANSITIONS,
  formatDateSafe,
  isMilestoneOverdue,
} from "../../lib/domain.js";
import {
  createMilestone,
  deleteMilestone,
  moveMilestone,
  subscribeToGroupMilestones,
  updateMilestone,
} from "../../lib/milestones.js";

// Shared incubation-plan view: objectives come from the group; milestones are
// real records with honest counts (no invented percentages).
function MilestonesPanel({ groupId, groupObjectives, actorId, canManage, canDelete = true, onCount }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", deliverable: "", dueDate: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    return subscribeToGroupMilestones(
      groupId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      () => {
        setError("Failed to load milestones.");
        setLoading(false);
      }
    );
  }, [groupId]);

  const completed = items.filter((m) => m.status === MILESTONE_STATUS.COMPLETED).length;
  const inProgress = items.filter((m) => m.status === MILESTONE_STATUS.IN_PROGRESS).length;
  const overdue = items.filter((m) => isMilestoneOverdue(m)).length;
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  // Optional head-count for overview metrics; the panel owns its data.
  // Ref-guarded so the fresh object identity can't loop the parent.
  const lastCountRef = useRef(null);
  useEffect(() => {
    if (!onCount) return;
    const next = `${completed}/${items.length}`;
    if (lastCountRef.current !== next) {
      lastCountRef.current = next;
      onCount({ done: completed, total: items.length });
    }
  }, [items, completed, onCount]);

  const openCreate = () => {
    setForm({ title: "", description: "", deliverable: "", dueDate: "" });
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (milestone) => {
    setForm({
      title: milestone.title || "",
      description: milestone.description || "",
      deliverable: milestone.deliverable || "",
      dueDate: milestone.dueDate || "",
    });
    setEditingId(milestone.id);
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateMilestone(editingId, actorId, form);
        toast("Milestone updated.");
      } else {
        await createMilestone(groupId, actorId, form);
        toast("Milestone added.");
      }
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error("Error saving milestone:", err);
      setFormError(err.message || "Failed to save the milestone.");
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (milestone, toStatus) => {
    setFormError("");
    try {
      await moveMilestone(milestone.id, actorId, toStatus);
    } catch (err) {
      console.error("Error moving milestone:", err);
      setFormError(err.message || "Failed to update the milestone.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMilestone(pendingDelete.id, actorId);
      toast("Milestone deleted.");
    } catch (err) {
      console.error("Error deleting milestone:", err);
      setFormError(err.message || "Failed to delete the milestone.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="mt-2 w-full">
      <SectionHeader
        hint="Objectives come from the startup record. Milestones are tracked individually."
        count={items.length}
        action={
          canManage ? (
            <Button onClick={openCreate} size="sm">
              Add milestone
            </Button>
          ) : null
        }
      >
        Incubation plan &amp; milestones
      </SectionHeader>

      {groupObjectives ? (
        <p className="mt-3.5 border-l-2 border-accent bg-accent-light px-3.5 py-2.5 text-sm leading-relaxed text-slate-700">
          <span className="font-medium text-slate-900">Plan objectives: </span>
          {groupObjectives}
        </p>
      ) : (
        <p className="mt-3.5 text-[13px] text-muted">
          No plan objectives recorded for this startup yet.
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium text-slate-700">Plan progress</span>
            <span className="text-[13px] tabular-nums text-muted">
              {completed} of {items.length} complete &middot; {pct}%
            </span>
          </div>
          <Progress value={pct} label={`${completed} of ${items.length} milestones complete`} />
        </div>
      )}

      <MetricRow
        className="mt-4"
        items={[
          { label: "Milestones", value: items.length },
          { label: "Completed", value: completed, suffix: `of ${items.length}` },
          { label: "In progress", value: inProgress },
          { label: "Overdue", value: overdue },
        ]}
      />

      <div className="mt-5">
        {loading ? (
          <InlineLoading label="Loading milestones…" />
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            No milestones yet.{" "}
            {canManage ? "Add the first milestone to start tracking this plan." : ""}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
            {items.map((m) => {
              const late = isMilestoneOverdue(m);
              const next = MILESTONE_TRANSITIONS[m.status] || [];
              return (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{m.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {m.dueDate ? `Due ${formatDateSafe(m.dueDate)}` : "No due date"}
                      </p>
                      {m.deliverable && (
                        <p className="mt-1 text-[13px] text-slate-600">
                          <span className="font-medium">Deliverable: </span>
                          {m.deliverable}
                        </p>
                      )}
                      {m.description && (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">
                          {m.description}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusBadge status={late ? "Overdue" : m.status} />
                      {canManage && (
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {next.map((to) => (
                            <Button
                              key={to}
                              onClick={() => handleMove(m, to)}
                              variant="outline"
                              size="sm"
                            >
                              {to}
                            </Button>
                          ))}
                          <Button onClick={() => openEdit(m)} variant="outline" size="sm">
                            Edit
                          </Button>
                          {canDelete && (
                            <Button
                              onClick={() => setPendingDelete(m)}
                              variant="ghost"
                              size="sm"
                              className="text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {formError && !showForm && (
        <p className="mt-2 text-sm text-red-600">{formError}</p>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit milestone" : "Add milestone"}</DialogTitle>
              <DialogDescription>
                Milestones are shared with everyone assigned to this startup.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="tbi-label" htmlFor="ms-title">
                  Title <span className="text-red-600">*</span>
                </label>
                <input
                  id="ms-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="tbi-input"
                />
              </div>
              <div>
                <label className="tbi-label" htmlFor="ms-desc">
                  Description
                </label>
                <textarea
                  id="ms-desc"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows="2"
                  className="tbi-input"
                />
              </div>
              <div>
                <label className="tbi-label" htmlFor="ms-deliverable">
                  Deliverable
                </label>
                <input
                  id="ms-deliverable"
                  type="text"
                  value={form.deliverable}
                  onChange={(e) => setForm((p) => ({ ...p, deliverable: e.target.value }))}
                  className="tbi-input"
                  placeholder="e.g. Customer validation report"
                />
              </div>
              <div>
                <label className="tbi-label" htmlFor="ms-due">
                  Due date
                </label>
                <input
                  id="ms-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="tbi-input"
                />
              </div>
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update milestone" : "Add milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        title={pendingDelete ? `Delete milestone "${pendingDelete.title}"?` : "Delete milestone?"}
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default MilestonesPanel;
