import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { ACTIVITY_TYPE, formatDateSafe } from "../../lib/domain.js";
import { isStaffAppRole } from "../../lib/permissions.js";
import { createActivity, subscribeToActivities } from "../../lib/activities.js";
import { subscribeToPrograms } from "../../lib/programs.js";

const EMPTY_FORM = {
  title: "",
  type: ACTIVITY_TYPE.TRAINING,
  description: "",
  date: "",
  endDate: "",
  location: "",
  facilitator: "",
  programId: "",
};

function Activities() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);
  const [activities, setActivities] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const isStaff = isStaffAppRole(role);

  useEffect(() => {
    document.title = "Activities";
    let unsub = () => {};
    let unsubPrograms = () => {};
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
        setRole(userDoc.data().role || "");
        setUserName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
        setUserId(userDoc.id);
        unsub = subscribeToActivities(
          (list) => {
            if (!cancelled) {
              setActivities(list);
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setError("Failed to load activities.");
              setLoading(false);
            }
          }
        );
        unsubPrograms = subscribeToPrograms((list) => {
          if (!cancelled) setPrograms(list);
        });
      } catch (err) {
        console.error("Error loading activities:", err);
        if (!cancelled) {
          setError("Failed to load activities.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsub();
      unsubPrograms();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    return (activities || []).filter((a) => {
      if (typeFilter !== "All" && a.type !== typeFilter) return false;
      if (!q) return true;
      return (
        (a.title || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q) ||
        (a.location || "").toLowerCase().includes(q)
      );
    });
  }, [activities, search, typeFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.date) {
      setFormError("Title and date are required.");
      return;
    }
    setCreating(true);
    try {
      const id = await createActivity(userId, form);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      navigate(`/activities/${id}`);
    } catch (err) {
      console.error("Error creating activity:", err);
      setFormError(err.message || "Failed to create the activity.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Activities"
        description="Trainings, workshops, and TBI events with attendance."
        actions={
          isStaff && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
            >
              New activity
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search activities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search activities"
          className="tbi-input max-w-64"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="tbi-input max-w-52"
          aria-label="Filter by type"
        >
          <option value="All">All types</option>
          {Object.values(ACTIVITY_TYPE).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No activities found"
          description={isStaff ? "Create the first training, workshop, or event." : "Scheduled activities will appear here."}
        />
      ) : (
        <div className="bg-white border border-line rounded overflow-x-auto">
          <table className="tbi-table min-w-[680px]">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Type</th>
                <th scope="col">Date</th>
                <th scope="col">Location</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/activities/${a.id}`)}
                  className="cursor-pointer"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/activities/${a.id}`)}
                >
                  <td className="font-medium text-slate-900">{a.title}</td>
                  <td>
                    <StatusBadge status={a.type} tone="teal" />
                  </td>
                  <td>{a.date ? formatDateSafe(a.date) : "—"}</td>
                  <td>{a.location || "—"}</td>
                  <td className="text-right">
                    <span className="text-[13px] font-medium text-accent">Open →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="New activity">
            <form onSubmit={handleCreate} className="bg-white p-6 rounded shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">New activity</h2>
              <label className="tbi-label" htmlFor="ac-title">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="ac-title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="tbi-input mb-2"
              />
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
              <label className="tbi-label mt-2" htmlFor="ac-location">
                Location
              </label>
              <input
                id="ac-location"
                type="text"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="tbi-input mb-2"
              />
              <label className="tbi-label" htmlFor="ac-program">
                Program (optional)
              </label>
              <select
                id="ac-program"
                value={form.programId}
                onChange={(e) => setForm((p) => ({ ...p, programId: e.target.value }))}
                className="tbi-input mb-3"
              >
                <option value="">None</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {formError && <p className="text-red-600 text-[13px] mb-2" role="alert">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-800 rounded text-sm font-medium hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition disabled:opacity-60"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}
    </AppShell>
  );
}

export default Activities;

