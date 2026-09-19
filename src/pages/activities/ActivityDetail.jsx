import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { ACTIVITY_TYPE, ATTENDANCE_STATUS, formatDateSafe } from "../../lib/domain.js";
import { isStaffAppRole, isManagerAppRole } from "../../lib/permissions.js";
import {
  deleteActivity,
  markAttendance,
  registerAttendance,
  removeAttendance,
  subscribeToActivityAttendance,
  updateActivity,
} from "../../lib/activities.js";

function ActivityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [activity, setActivity] = useState(null);
  const [roster, setRoster] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [registering, setRegistering] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [confirm, setConfirm] = useState(null);

  const isStaff = isStaffAppRole(role);
  const isManager = isManagerAppRole(role);
  const myRecord = user ? roster.find((r) => r.userId === user.id) : null;

  useEffect(() => {
    document.title = "Activity Detail";
  }, []);

  useEffect(() => {
    let unsubActivity = () => {};
    let unsubRoster = () => {};
    let cancelled = false;

    const init = async () => {
      try {
        const current = auth.currentUser;
        if (!current) {
          setError("You are not signed in.");
          setLoading(false);
          return;
        }
        const userDoc = await getDoc(doc(db, "users", current.uid));
        if (!userDoc.exists()) {
          setError("User record not found.");
          setLoading(false);
          return;
        }
        const userData = { id: userDoc.id, ...userDoc.data() };
        if (cancelled) return;
        setUser(userData);
        setRole(userData.role || "");
        setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());

        unsubActivity = onSnapshot(
          doc(db, "activities", id),
          (snap) => {
            if (cancelled) return;
            if (!snap.exists()) {
              setError("Activity not found.");
              setLoading(false);
              return;
            }
            const data = { id: snap.id, ...snap.data() };
            setActivity(data);
            setForm({
              title: data.title || "",
              type: data.type || ACTIVITY_TYPE.OTHER,
              description: data.description || "",
              date: data.date || "",
              endDate: data.endDate || "",
              location: data.location || "",
              facilitator: data.facilitator || "",
            });
            setLoading(false);
          },
          (err) => {
            console.error("Error loading activity:", err);
            if (!cancelled) {
              setError("Failed to load the activity.");
              setLoading(false);
            }
          }
        );

        unsubRoster = subscribeToActivityAttendance(id, (list) => {
          if (!cancelled) setRoster(list);
        });

        // Groups I belong to (for self-registration context).
        const gSnap = await getDocs(collection(db, "groups"));
        if (!cancelled) {
          setMyGroups(
            gSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((g) => (g.members || []).some((m) => m.id === userData.id))
          );
        }
      } catch (err) {
        console.error("Error opening activity:", err);
        if (!cancelled) {
          setError("Failed to open the activity.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsubActivity();
      unsubRoster();
    };
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.date) {
      setFormError("Title and date are required.");
      return;
    }
    setSaving(true);
    try {
      await updateActivity(id, user.id, form);
      toast("Activity saved.");
    } catch (err) {
      console.error("Error saving activity:", err);
      setFormError(err.message || "Failed to save the activity.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setConfirm({
      title: "Delete this activity?",
      description: "Attendance records are kept.",
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        try {
          await deleteActivity(id, user.id);
          toast("Activity deleted.");
          navigate("/activities");
        } catch (err) {
          console.error("Error deleting activity:", err);
          setFormError(err.message || "Failed to delete the activity.");
        }
      },
    });
  };

  const handleRegister = async () => {
    setRosterError("");
    setRegistering(true);
    try {
      const group = myGroups.find((g) => g.id === selectedGroupId) || null;
      await registerAttendance(id, user, group);
      toast("Registered for this activity.");
    } catch (err) {
      console.error("Error registering:", err);
      setRosterError(err.message || "Failed to register.");
    } finally {
      setRegistering(false);
    }
  };

  const handleMark = async (recordId, status) => {
    setRosterError("");
    try {
      await markAttendance(recordId, user.id, status);
    } catch (err) {
      console.error("Error marking attendance:", err);
      setRosterError(err.message || "Failed to update attendance.");
    }
  };

  const handleRemove = async (recordId) => {
    setConfirm({
      title: "Remove this attendance record?",
      description: undefined,
      confirmLabel: "Remove",
      danger: true,
      run: async () => {
        try {
          await removeAttendance(recordId, user.id);
        } catch (err) {
          console.error("Error removing attendance:", err);
          setRosterError(err.message || "Failed to remove the record.");
        }
      },
    });
  };

  const counts = roster.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <AppShell role={role} userName={userName}>
      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <PageHeader
            backTo="/activities"
            backLabel="Activities"
            title={activity.title}
            description={`${activity.type}${
              activity.date ? ` · ${formatDateSafe(activity.date)}` : ""
            }${activity.location ? ` · ${activity.location}` : ""}${
              activity.facilitator ? ` · ${activity.facilitator}` : ""
            }`}
            actions={<StatusBadge status={activity.type} tone="teal" />}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <section className="lg:col-span-2 bg-white border border-line rounded p-6">

              {isStaff ? (
                <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
                  <div>
                    <label className="tbi-label" htmlFor="ac-title">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="ac-title"
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                      className="tbi-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="tbi-label" htmlFor="ac-type">
                        Type
                      </label>
                      <select
                        id="ac-type"
                        value={form.type}
                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                        className="tbi-input"
                      >
                        {Object.values(ACTIVITY_TYPE).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="tbi-label" htmlFor="ac-date">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="ac-date"
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="tbi-label" htmlFor="ac-desc">
                      Description
                    </label>
                    <textarea
                      id="ac-desc"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows="3"
                      className="tbi-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="tbi-label" htmlFor="ac-location">
                        Location
                      </label>
                      <input
                        id="ac-location"
                        type="text"
                        value={form.location}
                        onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                    <div>
                      <label className="tbi-label" htmlFor="ac-facilitator">
                        Facilitator
                      </label>
                      <input
                        id="ac-facilitator"
                        type="text"
                        value={form.facilitator}
                        onChange={(e) => setForm((p) => ({ ...p, facilitator: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                  </div>
                  {formError && <p className="text-red-500 text-sm">{formError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-accent text-white rounded-sm text-sm hover:bg-opacity-80 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                    {isManager && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-500 text-white rounded-sm text-sm hover:bg-opacity-80"
                      >
                        Delete Activity
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                activity.description && <p className="mt-4 text-sm text-gray-700">{activity.description}</p>
              )}
            </section>

            <aside className="bg-white border border-line rounded p-4 h-fit">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Attendance ({roster.length})</h2>
              <p className="text-xs text-muted mb-3">
                {Object.values(ATTENDANCE_STATUS)
                  .map((s) => `${s}: ${counts[s] || 0}`)
                  .join(" · ")}
              </p>

              {!isStaff &&
                (myRecord ? (
                  <p className="text-xs bg-slate-50 border border-line rounded p-2 mb-3">
                    Your status: <StatusBadge status={myRecord.status} />
                  </p>
                ) : (
                  <div className="mb-3">
                    {myGroups.length > 0 && (
                      <select
                        value={selectedGroupId}
                        onChange={(e) => setSelectedGroupId(e.target.value)}
                        className="tbi-input text-xs mb-2"
                        aria-label="Registering startup"
                      >
                        <option value="">Register as individual</option>
                        {myGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleRegister}
                      disabled={registering}
                      className="w-full px-3 py-2 bg-primary-color text-white rounded text-xs font-medium hover:bg-primary-deep transition disabled:opacity-60"
                    >
                      {registering ? "Registering..." : "Register for this activity"}
                    </button>
                  </div>
                ))}

              {rosterError && (
                <p className="text-red-600 text-xs mb-2" role="alert">
                  {rosterError}
                </p>
              )}

              {roster.length === 0 ? (
                <p className="text-xs text-muted">No attendance records yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {roster.map((r) => (
                    <li key={r.id} className="border-b border-line last:border-b-0 pb-2">
                      <p className="font-medium text-sm text-slate-900">{r.userName}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {r.groupName || "Individual"} · <StatusBadge status={r.status} />
                      </p>
                      {isStaff && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.values(ATTENDANCE_STATUS)
                            .filter((s) => s !== r.status)
                            .map((s) => (
                              <button
                                key={s}
                                onClick={() => handleMark(r.id, s)}
                                className="px-2 py-1 border border-line rounded text-xs hover:bg-slate-50 transition"
                              >
                                {s}
                              </button>
                            ))}
                          {isManager && (
                            <button
                              onClick={() => handleRemove(r.id)}
                              className="px-2 py-1 text-red-600 hover:underline text-xs"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        danger={confirm?.danger || false}
        onConfirm={async () => {
          const run = confirm?.run;
          setConfirm(null);
          if (run) await run();
        }}
        onCancel={() => setConfirm(null)}
      />
    </AppShell>
  );
}

export default ActivityDetail;

