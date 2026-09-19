import { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
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
function MilestonesPanel({ groupId, groupObjectives, actorId, canManage, canDelete = true, accentColor, onCount }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", deliverable: "", dueDate: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const accent = accentColor || "bg-accent";

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
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h3 className="font-bold text-lg">Incubation Plan &amp; Milestones</h3>
        {canManage && (
          <button
            onClick={openCreate}
            className={`${accent} text-white px-4 py-2 text-xs rounded-sm hover:bg-opacity-80 transition`}
          >
            + Add Milestone
          </button>
        )}
      </div>

      {groupObjectives ? (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-sm p-3 mb-3">
          <span className="font-medium text-gray-800">Plan objectives: </span>
          {groupObjectives}
        </p>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No plan objectives recorded for this startup yet.</p>
      )}

      <div className="flex flex-wrap gap-2 mb-3 text-center">
        <div className="bg-blue-500 text-white p-2 rounded-sm shadow-md min-w-[110px]">
          <p className="text-xs">Milestones</p>
          <p className="text-md font-semibold mt-1">{items.length}</p>
        </div>
        <div className="bg-green-500 text-white p-2 rounded-sm shadow-md min-w-[110px]">
          <p className="text-xs">Completed</p>
          <p className="text-md font-semibold mt-1">
            {completed} of {items.length}
          </p>
        </div>
        <div className="bg-yellow-500 text-white p-2 rounded-sm shadow-md min-w-[110px]">
          <p className="text-xs">In Progress</p>
          <p className="text-md font-semibold mt-1">{inProgress}</p>
        </div>
        <div className={`${overdue > 0 ? "bg-red-500" : "bg-gray-500"} text-white p-2 rounded-sm shadow-md min-w-[110px]`}>
          <p className="text-xs">Overdue</p>
          <p className="text-md font-semibold mt-1">{overdue}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading milestones...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No milestones yet. {canManage ? "Add the first milestone to start tracking this plan." : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((m) => {
            const late = isMilestoneOverdue(m);
            const next = MILESTONE_TRANSITIONS[m.status] || [];
            return (
              <li key={m.id} className="bg-white border border-gray-200 rounded-sm p-3">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Status: {m.status}
                      {late && <span className="ml-2 font-bold text-red-600">Overdue</span>}
                      {" · "}Due: {m.dueDate ? formatDateSafe(m.dueDate) : "No due date"}
                    </p>
                    {m.deliverable && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-medium">Deliverable: </span>
                        {m.deliverable}
                      </p>
                    )}
                    {m.description && <p className="text-xs text-gray-600 mt-1">{m.description}</p>}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1">
                      {next.map((to) => (
                        <button
                          key={to}
                          onClick={() => handleMove(m, to)}
                          className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100"
                        >
                          {to}
                        </button>
                      ))}
                      <button
                        onClick={() => openEdit(m)}
                        className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => setPendingDelete(m)}
                          className="px-2 py-1 bg-red-500 text-white rounded-sm text-xs hover:bg-opacity-80"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formError && <p className="text-red-500 text-sm mt-2">{formError}</p>}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4 text-center">{editingId ? "Edit Milestone" : "Add Milestone"}</h2>
            <label className="block text-sm font-medium mb-1" htmlFor="ms-title">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="ms-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="ms-desc">
              Description
            </label>
            <textarea
              id="ms-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="ms-deliverable">
              Deliverable
            </label>
            <input
              id="ms-deliverable"
              type="text"
              value={form.deliverable}
              onChange={(e) => setForm((p) => ({ ...p, deliverable: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-2"
              placeholder="e.g. Customer validation report"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="ms-due">
              Due date
            </label>
            <input
              id="ms-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-3"
            />
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
                className={`${accent} px-4 py-2 text-white rounded-sm text-sm hover:bg-opacity-80 disabled:opacity-60`}
              >
                {saving ? "Saving..." : editingId ? "Update" : "Add"}
              </button>
            </div>
          </form>
        </div>
      )}
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
