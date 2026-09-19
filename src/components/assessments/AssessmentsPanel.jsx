import { useEffect, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { formatDateSafe } from "../../lib/domain.js";
import {
  ASSESSMENT_TYPE_LIST,
  createAssessment,
  deleteAssessment,
  subscribeToGroupAssessments,
  updateAssessment,
} from "../../lib/assessments.js";

const EMPTY_FORM = {
  type: "Periodic",
  assessmentDate: new Date().toISOString().split("T")[0],
  assessorName: "",
  criteria: "",
  findings: "",
  recommendations: "",
  followUps: "",
};

// Shared assessments view: staff record formal evaluations; the startup reads.
// Props: canManage (staff), canDelete (manager), accentColor.
function AssessmentsPanel({ groupId, actorId, canManage, canDelete, accentColor }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const accent = accentColor || "bg-accent";

  useEffect(() => {
    setLoading(true);
    setError("");
    return subscribeToGroupAssessments(
      groupId,
      (list) => {
        setItems(list);
        setLoading(false);
      },
      () => {
        setError("Failed to load assessments.");
        setLoading(false);
      }
    );
  }, [groupId]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (assessment) => {
    setForm({
      type: assessment.type || "Periodic",
      assessmentDate: assessment.assessmentDate || "",
      assessorName: assessment.assessorName || "",
      criteria: assessment.criteria || "",
      findings: assessment.findings || "",
      recommendations: assessment.recommendations || "",
      followUps: assessment.followUps || "",
    });
    setEditing(assessment);
    setFormError("");
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.assessmentDate || !form.findings.trim()) {
      setFormError("Date and findings are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAssessment(editing.id, actorId, form);
        toast("Assessment updated.");
      } else {
        await createAssessment(groupId, actorId, form);
        toast("Assessment recorded.");
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error("Error saving assessment:", err);
      setFormError(err.message || "Failed to save the assessment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAssessment(pendingDelete.id, actorId);
      toast("Assessment deleted.");
    } catch (err) {
      console.error("Error deleting assessment:", err);
      setFormError(err.message || "Failed to delete the assessment.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="mt-2 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h3 className="font-bold text-lg">Assessments</h3>
        {canManage && (
          <button
            onClick={openCreate}
            className={`${accent} text-white px-4 py-2 text-xs rounded-sm hover:bg-opacity-80 transition`}
          >
            + New Assessment
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading assessments...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No assessments recorded yet. {canManage ? "Record the initial assessment to baseline this startup." : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id} className="bg-white border border-gray-200 rounded-sm p-3">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-gray-800">
                    {a.type} assessment
                    {a.assessmentDate ? ` · ${formatDateSafe(a.assessmentDate)}` : ""}
                  </p>
                  {a.assessorName && <p className="text-xs text-gray-500">Assessor: {a.assessorName}</p>}
                  {a.criteria && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Criteria: </span>
                      {a.criteria}
                    </p>
                  )}
                  <p className="text-xs text-gray-700 mt-1">
                    <span className="font-medium">Findings: </span>
                    {a.findings}
                  </p>
                  {a.recommendations && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Recommendations: </span>
                      {a.recommendations}
                    </p>
                  )}
                  {a.followUps && (
                    <p className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Follow-ups: </span>
                      {a.followUps}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(a)}
                      className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setPendingDelete(a)}
                        className="px-2 py-1 bg-red-500 text-white rounded-sm text-xs hover:bg-opacity-80"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {formError && <p className="text-red-500 text-sm mt-2">{formError}</p>}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50">
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-center">
              {editing ? "Edit Assessment" : "New Assessment"}
            </h2>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="as-type">
                  Type
                </label>
                <select
                  id="as-type"
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full p-2 border rounded-sm text-sm"
                >
                  {ASSESSMENT_TYPE_LIST.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="as-date">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="as-date"
                  type="date"
                  value={form.assessmentDate}
                  onChange={(e) => setForm((p) => ({ ...p, assessmentDate: e.target.value }))}
                  className="w-full p-2 border rounded-sm text-sm"
                />
              </div>
            </div>
            <label className="block text-sm font-medium mb-1" htmlFor="as-assessor">
              Assessor
            </label>
            <input
              id="as-assessor"
              type="text"
              value={form.assessorName}
              onChange={(e) => setForm((p) => ({ ...p, assessorName: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-2"
              placeholder="Who performed this assessment?"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="as-criteria">
              Criteria
            </label>
            <textarea
              id="as-criteria"
              value={form.criteria}
              onChange={(e) => setForm((p) => ({ ...p, criteria: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-2"
              placeholder="What was evaluated?"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="as-findings">
              Findings <span className="text-red-500">*</span>
            </label>
            <textarea
              id="as-findings"
              value={form.findings}
              onChange={(e) => setForm((p) => ({ ...p, findings: e.target.value }))}
              rows="3"
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="as-rec">
              Recommendations
            </label>
            <textarea
              id="as-rec"
              value={form.recommendations}
              onChange={(e) => setForm((p) => ({ ...p, recommendations: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="as-follow">
              Follow-up actions
            </label>
            <textarea
              id="as-follow"
              value={form.followUps}
              onChange={(e) => setForm((p) => ({ ...p, followUps: e.target.value }))}
              rows="2"
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
                {saving ? "Saving..." : editing ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this assessment?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}

export default AssessmentsPanel;
