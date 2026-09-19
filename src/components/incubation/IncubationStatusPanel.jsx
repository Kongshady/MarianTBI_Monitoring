import { useEffect, useState } from "react";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { formatDateSafe } from "../../lib/domain.js";
import {
  TERMINAL_OUTCOMES,
  currentIncubationStatus,
  moveIncubationStatus,
  nextIncubationStatuses,
  subscribeToGroupOutcomes,
} from "../../lib/incubation.js";

// Shared incubation-status view: current lifecycle state, incubation context,
// outcome history, and staff transitions. Terminal moves record an outcome
// (date + reason required); history is preserved, never overwritten.
// Props: group (live doc), actorId, canManage (staff), accentColor.
function IncubationStatusPanel({ group, groupId, actorId, canManage, accentColor }) {
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingTo, setPendingTo] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState({
    date: new Date().toISOString().split("T")[0],
    reason: "",
    achievements: "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);

  const accent = accentColor || "bg-accent";
  const current = currentIncubationStatus(group);
  const next = nextIncubationStatuses(group);
  const isTerminal = group && TERMINAL_OUTCOMES.includes(current);

  useEffect(() => {
    setLoading(true);
    setError("");
    return subscribeToGroupOutcomes(
      groupId,
      (list) => {
        setOutcomes(list);
        setLoading(false);
      },
      () => {
        setError("Failed to load outcome history.");
        setLoading(false);
      }
    );
  }, [groupId]);

  const handleMove = (toStatus) => {
    if (TERMINAL_OUTCOMES.includes(toStatus)) {
      setPendingTo(toStatus);
      setFormError("");
      setOutcomeForm({
        date: new Date().toISOString().split("T")[0],
        reason: "",
        achievements: "",
      });
      return;
    }
    setPendingMove(toStatus);
  };

  const runMove = async () => {
    if (!pendingMove) return;
    setSaving(true);
    try {
      await moveIncubationStatus(groupId, actorId, pendingMove);
      setFormError("");
      toast(`Startup moved to ${pendingMove}.`);
    } catch (err) {
      console.error("Error changing status:", err);
      setFormError(err.message || "Failed to change the status.");
    } finally {
      setSaving(false);
      setPendingMove(null);
    }
  };

  const handleOutcomeSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await moveIncubationStatus(groupId, actorId, pendingTo, outcomeForm);
      setPendingTo(null);
      toast(`Outcome recorded: ${pendingTo}.`);
    } catch (err) {
      console.error("Error recording outcome:", err);
      setFormError(err.message || "Failed to record the outcome.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 w-full">
      <h3 className="font-bold text-lg mb-2">Incubation Status</h3>

      <div className="bg-white border border-gray-200 rounded-sm p-4 mb-3">
        <p className="text-sm">
          <span className="font-medium">Current state: </span>
          {current}
          {!group?.incubateeStatus && (
            <span className="ml-2 text-xs text-gray-500">(legacy record — assumed Active)</span>
          )}
        </p>
        {group?.incubationStartDate && (
          <p className="text-xs text-gray-600 mt-1">
            Period: {formatDateSafe(group.incubationStartDate)}
            {" → "}
            {group.incubationExpectedEndDate ? formatDateSafe(group.incubationExpectedEndDate) : "open-ended"}
          </p>
        )}
        {group?.objectives && <p className="text-xs text-gray-600 mt-1">Objectives: {group.objectives}</p>}
        {group?.applicationId && (
          <p className="text-xs text-gray-500 mt-1">Onboarded from a reviewed application (see history).</p>
        )}
        {isTerminal && (
          <p className="text-xs mt-2 p-2 rounded-sm bg-gray-100 border border-gray-200">
            This lifecycle is closed. Records below are kept for alumni tracking — nothing was deleted.
          </p>
        )}
      </div>

      {canManage && next.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-sm p-4 mb-3">
          <h4 className="font-medium text-sm mb-2">Change state</h4>
          <div className="flex flex-wrap gap-2">
            {next.map((to) => (
              <button
                key={to}
                onClick={() => handleMove(to)}
                disabled={saving}
                className="px-3 py-2 border border-gray-300 rounded-sm text-xs hover:bg-gray-100 disabled:opacity-60"
              >
                {TERMINAL_OUTCOMES.includes(to) ? `Record: ${to}` : `Move to ${to}`}
              </button>
            ))}
          </div>
          {formError && !pendingTo && <p className="text-red-500 text-xs mt-2">{formError}</p>}
        </div>
      )}

      <h4 className="font-medium text-sm mb-1">Outcome history ({outcomes.length})</h4>
      {loading ? (
        <p className="text-gray-500 text-sm">Loading outcomes...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : outcomes.length === 0 ? (
        <p className="text-gray-500 text-sm">No outcomes recorded yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {outcomes.map((o) => (
            <li key={o.id} className="bg-white border border-gray-200 rounded-sm p-3">
              <p className="font-medium text-sm text-gray-800">
                {o.type}
                {o.date ? ` · ${formatDateSafe(o.date)}` : ""}
              </p>
              {o.reason && <p className="text-xs text-gray-600 mt-1">Reason: {o.reason}</p>}
              {o.achievements && (
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-medium">Achievements: </span>
                  {o.achievements}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendingTo && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50">
          <form onSubmit={handleOutcomeSubmit} className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-1 text-center">Record outcome: {pendingTo}</h2>
            <p className="text-xs text-gray-500 text-center mb-4">
              This closes (or continues) the lifecycle with a permanent record.
            </p>
            <label className="block text-sm font-medium mb-1" htmlFor="oc-date">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id="oc-date"
              type="date"
              value={outcomeForm.date}
              onChange={(e) => setOutcomeForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="oc-reason">
              Reason / context <span className="text-red-500">*</span>
            </label>
            <textarea
              id="oc-reason"
              value={outcomeForm.reason}
              onChange={(e) => setOutcomeForm((p) => ({ ...p, reason: e.target.value }))}
              rows="3"
              className="w-full p-2 border rounded-sm text-sm mb-2"
              placeholder="Final assessment summary, exit reason, continuation terms..."
            />
            <label className="block text-sm font-medium mb-1" htmlFor="oc-ach">
              Achievements
            </label>
            <textarea
              id="oc-ach"
              value={outcomeForm.achievements}
              onChange={(e) => setOutcomeForm((p) => ({ ...p, achievements: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-3"
              placeholder="Completed milestones, products, funding, jobs..."
            />
            {formError && <p className="text-red-500 text-sm mb-2">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTo(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-sm text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${accent} px-4 py-2 text-white rounded-sm text-sm hover:bg-opacity-80 disabled:opacity-60`}
              >
                {saving ? "Recording..." : `Record ${pendingTo}`}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingMove}
        title={`Move this startup from "${current}" to "${pendingMove}"?`}
        description="Simple state changes are recorded in history."
        confirmLabel={`Move to ${pendingMove}`}
        busy={saving}
        onConfirm={runMove}
        onCancel={() => !saving && setPendingMove(null)}
      />

    </div>
  );
}

export default IncubationStatusPanel;
