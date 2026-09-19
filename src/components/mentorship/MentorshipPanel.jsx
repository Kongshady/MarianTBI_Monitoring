import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/marian-config.js";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { formatDateSafe } from "../../lib/domain.js";
import {
  createAssignment,
  createSession,
  deleteSession,
  endAssignment,
  subscribeToGroupAssignments,
  subscribeToGroupSessions,
  updateSession,
} from "../../lib/mentorship.js";

// Shared mentorship view: assignments (staff assign, history preserved by
// ending instead of deleting) + sessions (staff or the assigned mentor).
function MentorshipPanel({ groupId, actorId, canAssign, accentColor }) {
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mentors, setMentors] = useState([]);
  const [mentorId, setMentorId] = useState("");
  const [assignError, setAssignError] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [sessionForm, setSessionForm] = useState({
    date: new Date().toISOString().split("T")[0],
    topic: "",
    discussion: "",
    recommendations: "",
    followUps: "",
    nextDate: "",
  });
  const [sessionError, setSessionError] = useState("");
  const [sessionSaving, setSessionSaving] = useState(false);
  const [pendingEnd, setPendingEnd] = useState(null);
  const [pendingSessionDelete, setPendingSessionDelete] = useState(null);

  const accent = accentColor || "bg-accent";

  useEffect(() => {
    setLoading(true);
    setError("");
    let done = 0;
    const ready = () => {
      done += 1;
      if (done >= 2) setLoading(false);
    };
    const unsubA = subscribeToGroupAssignments(groupId, (list) => {
      setAssignments(list);
      ready();
    });
    const unsubS = subscribeToGroupSessions(groupId, (list) => {
      setSessions(list);
      ready();
    });
    return () => {
      unsubA();
      unsubS();
    };
  }, [groupId]);

  useEffect(() => {
    if (!canAssign) return;
    let cancelled = false;
    getDocs(query(collection(db, "users"), where("role", "==", "Mentor")))
      .then((snap) => {
        if (cancelled) return;
        setMentors(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((u) => u.status === "approved")
            .sort((a, b) => `${a.name || ""} ${a.lastname || ""}`.localeCompare(`${b.name || ""} ${b.lastname || ""}`))
        );
      })
      .catch((err) => console.error("Error loading mentors:", err));
    return () => {
      cancelled = true;
    };
  }, [canAssign]);

  const activeAssignments = assignments.filter((a) => !a.endedAt);
  const myActiveAssignment = activeAssignments.find((a) => a.mentorId === actorId);
  const canRecord = canAssign || !!myActiveAssignment;

  const handleAssign = async (e) => {
    e.preventDefault();
    setAssignError("");
    if (!mentorId) {
      setAssignError("Select a mentor.");
      return;
    }
    setAssigning(true);
    try {
      const mentor = mentors.find((m) => m.id === mentorId);
      await createAssignment(groupId, actorId, {
        mentorId,
        mentorName: mentor ? `${mentor.name || ""} ${mentor.lastname || ""}`.trim() : "",
      });
      setMentorId("");
    } catch (err) {
      console.error("Error assigning mentor:", err);
      setAssignError(err.message || "Failed to assign the mentor.");
    } finally {
      setAssigning(false);
    }
  };

  const handleEnd = async () => {
    if (!pendingEnd) return;
    try {
      await endAssignment(pendingEnd.id, actorId);
      toast("Assignment ended. History is kept.");
    } catch (err) {
      console.error("Error ending assignment:", err);
      setAssignError(err.message || "Failed to end the assignment.");
    } finally {
      setPendingEnd(null);
    }
  };

  const openSessionCreate = () => {
    setSessionForm({
      date: new Date().toISOString().split("T")[0],
      topic: "",
      discussion: "",
      recommendations: "",
      followUps: "",
      nextDate: "",
    });
    setEditingSessionId(null);
    setSessionError("");
    setShowSessionForm(true);
  };

  const openSessionEdit = (session) => {
    setSessionForm({
      date: session.date || "",
      topic: session.topic || "",
      discussion: session.discussion || "",
      recommendations: session.recommendations || "",
      followUps: session.followUps || "",
      nextDate: session.nextDate || "",
    });
    setEditingSessionId(session.id);
    setSessionError("");
    setShowSessionForm(true);
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    setSessionError("");
    if (!sessionForm.topic.trim() || !sessionForm.date) {
      setSessionError("Date and topic are required.");
      return;
    }
    setSessionSaving(true);
    try {
      // Attribute to my own active assignment when I am the mentor; staff
      // attribute to the chosen context (first active assignment or self).
      const context = myActiveAssignment || activeAssignments[0] || null;
      if (editingSessionId) {
        await updateSession(editingSessionId, actorId, sessionForm);
        toast("Session updated.");
      } else {
        await createSession(groupId, actorId, {
          ...sessionForm,
          assignmentId: context?.id || null,
          mentorId: context?.mentorId || actorId,
          mentorName: context?.mentorName || "",
        });
        toast("Session recorded.");
      }
      setShowSessionForm(false);
      setEditingSessionId(null);
    } catch (err) {
      console.error("Error saving session:", err);
      setSessionError(err.message || "Failed to save the session.");
    } finally {
      setSessionSaving(false);
    }
  };

  const handleSessionDelete = async () => {
    if (!pendingSessionDelete) return;
    try {
      await deleteSession(pendingSessionDelete.id, actorId);
      toast("Session deleted.");
    } catch (err) {
      console.error("Error deleting session:", err);
      setSessionError(err.message || "Failed to delete the session.");
    } finally {
      setPendingSessionDelete(null);
    }
  };

  return (
    <div className="mt-2 w-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
        <h3 className="font-bold text-lg">Mentorship</h3>
        {canRecord && (
          <button
            onClick={openSessionCreate}
            className={`${accent} text-white px-4 py-2 text-xs rounded-sm hover:bg-opacity-80 transition`}
          >
            + Record Session
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading mentorship...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : (
        <>
          <h4 className="font-medium text-sm mb-1">Mentor assignments ({activeAssignments.length} active)</h4>
          {assignments.length === 0 ? (
            <p className="text-gray-500 text-sm mb-3">No mentors assigned yet.</p>
          ) : (
            <ul className="flex flex-col gap-2 mb-4">
              {assignments.map((a) => (
                <li key={a.id} className="bg-white border border-gray-200 rounded-sm p-3 text-sm">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <p className="font-medium text-gray-800">{a.mentorName || "Mentor"}</p>
                      <p className="text-xs text-gray-500">
                        Since {a.startedAt ? formatDateSafe(a.startedAt) : "N/A"}
                        {a.endedAt ? ` · Ended ${formatDateSafe(a.endedAt)}` : " · Active"}
                      </p>
                    </div>
                    {canAssign && !a.endedAt && (
                      <button
                        onClick={() => setPendingEnd(a)}
                        className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100"
                      >
                        End assignment
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canAssign && (
            <form onSubmit={handleAssign} className="flex flex-wrap items-end gap-2 mb-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium mb-1" htmlFor="mentor-select">
                  Assign mentor
                </label>
                <select
                  id="mentor-select"
                  value={mentorId}
                  onChange={(e) => setMentorId(e.target.value)}
                  className="w-full p-2 border rounded-sm text-sm"
                >
                  <option value="">Select mentor</option>
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.lastname}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={assigning}
                className={`${accent} px-4 py-2 text-white rounded-sm text-xs hover:bg-opacity-80 disabled:opacity-60`}
              >
                {assigning ? "Assigning..." : "Assign"}
              </button>
              {assignError && <p className="text-red-500 text-xs w-full">{assignError}</p>}
            </form>
          )}

          <h4 className="font-medium text-sm mb-1">Sessions ({sessions.length})</h4>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">No mentoring sessions recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <li key={s.id} className="bg-white border border-gray-200 rounded-sm p-3">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-gray-800">{s.topic}</p>
                      <p className="text-xs text-gray-500">
                        {s.date ? formatDateSafe(s.date) : "No date"}
                        {s.mentorName ? ` · ${s.mentorName}` : ""}
                        {s.nextDate ? ` · Next: ${formatDateSafe(s.nextDate)}` : ""}
                      </p>
                      {s.discussion && <p className="text-xs text-gray-600 mt-1">{s.discussion}</p>}
                      {s.recommendations && (
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Recommendations: </span>
                          {s.recommendations}
                        </p>
                      )}
                      {s.followUps && (
                        <p className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">Follow-ups: </span>
                          {s.followUps}
                        </p>
                      )}
                    </div>
                    {(canAssign || s.mentorId === actorId) && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openSessionEdit(s)}
                          className="px-2 py-1 border border-gray-300 rounded-sm text-xs hover:bg-gray-100"
                        >
                          Edit
                        </button>
                        {canAssign && (
                          <button
                            onClick={() => setPendingSessionDelete(s)}
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
        </>
      )}

      {sessionError && <p className="text-red-500 text-sm mt-2">{sessionError}</p>}

      {showSessionForm && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4 z-50">
          <form onSubmit={handleSessionSubmit} className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4 text-center">
              {editingSessionId ? "Edit Session" : "Record Session"}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="sess-date">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="sess-date"
                  type="date"
                  value={sessionForm.date}
                  onChange={(e) => setSessionForm((p) => ({ ...p, date: e.target.value }))}
                  className="w-full p-2 border rounded-sm text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="sess-next">
                  Next session
                </label>
                <input
                  id="sess-next"
                  type="date"
                  value={sessionForm.nextDate}
                  onChange={(e) => setSessionForm((p) => ({ ...p, nextDate: e.target.value }))}
                  className="w-full p-2 border rounded-sm text-sm"
                />
              </div>
            </div>
            <label className="block text-sm font-medium mb-1 mt-2" htmlFor="sess-topic">
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              id="sess-topic"
              type="text"
              value={sessionForm.topic}
              onChange={(e) => setSessionForm((p) => ({ ...p, topic: e.target.value }))}
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="sess-discussion">
              Discussion
            </label>
            <textarea
              id="sess-discussion"
              value={sessionForm.discussion}
              onChange={(e) => setSessionForm((p) => ({ ...p, discussion: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="sess-rec">
              Recommendations
            </label>
            <textarea
              id="sess-rec"
              value={sessionForm.recommendations}
              onChange={(e) => setSessionForm((p) => ({ ...p, recommendations: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-2"
            />
            <label className="block text-sm font-medium mb-1" htmlFor="sess-follow">
              Follow-up actions
            </label>
            <textarea
              id="sess-follow"
              value={sessionForm.followUps}
              onChange={(e) => setSessionForm((p) => ({ ...p, followUps: e.target.value }))}
              rows="2"
              className="w-full p-2 border rounded-sm text-sm mb-3"
            />
            {sessionError && <p className="text-red-500 text-sm mb-2">{sessionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSessionForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-sm text-sm hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sessionSaving}
                className={`${accent} px-4 py-2 text-white rounded-sm text-sm hover:bg-opacity-80 disabled:opacity-60`}
              >
                {sessionSaving ? "Saving..." : editingSessionId ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmDialog
        open={!!pendingEnd}
        title={`End ${pendingEnd?.mentorName || "this mentor"}'s assignment?`}
        description="History is kept."
        confirmLabel="End assignment"
        onConfirm={handleEnd}
        onCancel={() => setPendingEnd(null)}
      />
      <ConfirmDialog
        open={!!pendingSessionDelete}
        title="Delete this session record?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleSessionDelete}
        onCancel={() => setPendingSessionDelete(null)}
      />
    </div>
  );
}

export default MentorshipPanel;
