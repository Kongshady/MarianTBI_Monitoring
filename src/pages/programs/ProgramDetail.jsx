import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { PROGRAM_STATUS, formatDateSafe } from "../../lib/domain.js";
import { isStaffAppRole, isManagerAppRole, isPortfolioManagerRole } from "../../lib/permissions.js";
import { deleteProgram, updateProgram } from "../../lib/programs.js";
import { subscribeToProgramActivities } from "../../lib/activities.js";

function groupPathForRole(userRole, groupId) {
  if (isStaffAppRole(userRole)) return `/admin/view-group/${groupId}`;
  if (isPortfolioManagerRole(userRole)) return `/employee/view-group/${groupId}`;
  return `/incubatee/view-group/${groupId}`;
}

function ProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [program, setProgram] = useState(null);
  const [groups, setGroups] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isStaff = isStaffAppRole(role);
  const isManager = isManagerAppRole(role);

  useEffect(() => {
    document.title = "Program Detail";
  }, []);

  useEffect(() => {
    let unsub = () => {};
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
        if (cancelled) return;
        setUserId(userDoc.id);
        setRole(userDoc.data().role || "");
        setUserName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());

        unsub = onSnapshot(
          doc(db, "programs", id),
          (snap) => {
            if (cancelled) return;
            if (!snap.exists()) {
              setError("Program not found.");
              setLoading(false);
              return;
            }
            const data = { id: snap.id, ...snap.data() };
            setProgram(data);
            setForm({
              name: data.name || "",
              description: data.description || "",
              objectives: data.objectives || "",
              startDate: data.startDate || "",
              endDate: data.endDate || "",
              eligibility: data.eligibility || "",
              capacity: data.capacity ?? "",
              status: data.status || PROGRAM_STATUS.DRAFT,
            });
            setLoading(false);
          },
          (err) => {
            console.error("Error loading program:", err);
            if (!cancelled) {
              setError("Failed to load the program.");
              setLoading(false);
            }
          }
        );

        const gSnap = await getDocs(query(collection(db, "groups"), where("programId", "==", id)));
        if (!cancelled) {
          setGroups(
            gSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
          );
        }

        const unsubActivities = subscribeToProgramActivities(id, (list) => {
          if (!cancelled) setActivities(list);
        });
        const prevUnsub = unsub;
        unsub = () => {
          prevUnsub();
          unsubActivities();
        };
      } catch (err) {
        console.error("Error opening program:", err);
        if (!cancelled) {
          setError("Failed to open the program.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Program name is required.");
      return;
    }
    setSaving(true);
    try {
      await updateProgram(id, userId, form);
      toast("Program saved.");
    } catch (err) {
      console.error("Error saving program:", err);
      setFormError(err.message || "Failed to save the program.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (groups.length > 0) {
      setFormError("This program still has linked incubatees. Reassign them before deleting.");
      return;
    }
    setConfirmDelete(true);
  };

  const runDelete = async () => {
    try {
      await deleteProgram(id, userId);
      toast("Program deleted.");
      navigate("/programs");
    } catch (err) {
      console.error("Error deleting program:", err);
      setFormError(err.message || "Failed to delete the program.");
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <>
          <PageHeader
            backTo="/programs"
            backLabel="Programs"
            title={program.name}
            description={`${
              program.startDate ? formatDateSafe(program.startDate) : "No start date"
            } → ${program.endDate ? formatDateSafe(program.endDate) : "open-ended"}${
              program.capacity != null ? ` · Capacity ${program.capacity}` : ""
            }`}
            actions={<StatusBadge status={program.status} />}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <section className="lg:col-span-2 bg-white border border-line rounded p-6">

              {isStaff ? (
                <form onSubmit={handleSave} className="mt-4 flex flex-col gap-3">
                  <div>
                    <label className="tbi-label" htmlFor="pg-name">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="pg-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      className="tbi-input"
                    />
                  </div>
                  <div>
                    <label className="tbi-label" htmlFor="pg-desc">
                      Description
                    </label>
                    <textarea
                      id="pg-desc"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows="3"
                      className="tbi-input"
                    />
                  </div>
                  <div>
                    <label className="tbi-label" htmlFor="pg-obj">
                      Objectives
                    </label>
                    <textarea
                      id="pg-obj"
                      value={form.objectives}
                      onChange={(e) => setForm((p) => ({ ...p, objectives: e.target.value }))}
                      rows="2"
                      className="tbi-input"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="tbi-label" htmlFor="pg-start">
                        Start date
                      </label>
                      <input
                        id="pg-start"
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                    <div>
                      <label className="tbi-label" htmlFor="pg-end">
                        End date
                      </label>
                      <input
                        id="pg-end"
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="tbi-label" htmlFor="pg-elig">
                        Eligibility
                      </label>
                      <input
                        id="pg-elig"
                        type="text"
                        value={form.eligibility}
                        onChange={(e) => setForm((p) => ({ ...p, eligibility: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                    <div>
                      <label className="tbi-label" htmlFor="pg-cap">
                        Capacity
                      </label>
                      <input
                        id="pg-cap"
                        type="number"
                        min="0"
                        value={form.capacity}
                        onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                        className="tbi-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="tbi-label" htmlFor="pg-status">
                      Status
                    </label>
                    <select
                      id="pg-status"
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      className="tbi-input"
                    >
                      {Object.values(PROGRAM_STATUS).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
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
                        Delete Program
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="mt-4 text-sm text-gray-700 flex flex-col gap-2">
                  {program.description && <p>{program.description}</p>}
                  {program.objectives && (
                    <p>
                      <span className="font-medium">Objectives: </span>
                      {program.objectives}
                    </p>
                  )}
                  {program.eligibility && (
                    <p>
                      <span className="font-medium">Eligibility: </span>
                      {program.eligibility}
                    </p>
                  )}
                </div>
              )}
            </section>

            <aside className="flex flex-col gap-4">
              <div className="bg-white border border-line rounded p-4 h-fit">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">Linked incubatees ({groups.length})</h2>
                {groups.length === 0 ? (
                  <p className="text-xs text-muted">No startups linked to this program yet. Link them from onboarding.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {groups.map((g) => (
                      <li key={g.id} className="text-sm border-b border-line last:border-b-0 pb-2">
                        <Link to={groupPathForRole(role, g.id)} className="text-accent hover:underline font-medium">
                          {g.name}
                        </Link>
                        {g.incubateeStatus && <p className="text-xs text-muted">{g.incubateeStatus}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-white border border-line rounded p-4 h-fit">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">Activities ({activities.length})</h2>
                {activities.length === 0 ? (
                  <p className="text-xs text-muted">No activities linked to this program yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {activities.slice(0, 8).map((a) => (
                      <li key={a.id} className="text-sm border-b border-line last:border-b-0 pb-2">
                        <Link to={`/activities/${a.id}`} className="text-accent hover:underline font-medium">
                          {a.title}
                        </Link>
                        <p className="text-xs text-muted">
                          {a.type}
                          {a.date ? ` · ${formatDateSafe(a.date)}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this program?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={runDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </AppShell>
  );
}

export default ProgramDetail;

