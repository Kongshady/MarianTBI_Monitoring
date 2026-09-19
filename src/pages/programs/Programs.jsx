import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { PROGRAM_STATUS, formatDateSafe } from "../../lib/domain.js";
import { isStaffAppRole } from "../../lib/permissions.js";
import { createProgram, subscribeToPrograms } from "../../lib/programs.js";

const EMPTY_FORM = {
  name: "",
  description: "",
  objectives: "",
  startDate: "",
  endDate: "",
  eligibility: "",
  capacity: "",
  status: PROGRAM_STATUS.DRAFT,
};

function Programs() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const isStaff = isStaffAppRole(role);

  useEffect(() => {
    document.title = "Programs";
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
        setRole(userDoc.data().role || "");
        setUserName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
        setUserId(userDoc.id);
        unsub = subscribeToPrograms(
          (list) => {
            if (!cancelled) {
              setPrograms(list);
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setError("Failed to load programs.");
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.error("Error loading programs:", err);
        if (!cancelled) {
          setError("Failed to load programs.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    return (programs || []).filter((p) => {
      if (statusFilter !== "All" && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (p.name || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    });
  }, [programs, search, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Program name is required.");
      return;
    }
    setCreating(true);
    try {
      const id = await createProgram(userId, form);
      setShowCreate(false);
      setForm(EMPTY_FORM);
      navigate(`/programs/${id}`);
    } catch (err) {
      console.error("Error creating program:", err);
      setFormError(err.message || "Failed to create the program.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Programs"
        description="Cohorts incubatees participate in. Incubatees are linked from onboarding."
        actions={
          isStaff && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
            >
              New program
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search programs"
          className="tbi-input max-w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="tbi-input max-w-52"
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {Object.values(PROGRAM_STATUS).map((s) => (
            <option key={s} value={s}>
              {s}
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
          title="No programs found"
          description={isStaff ? "Create the first program or cohort." : "Programs will appear here once created."}
        />
      ) : (
        <div className="bg-white border border-line rounded overflow-x-auto">
          <table className="tbi-table min-w-[640px]">
            <thead>
              <tr>
                <th scope="col">Program</th>
                <th scope="col">Status</th>
                <th scope="col">Period</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/programs/${p.id}`)}
                  className="cursor-pointer"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/programs/${p.id}`)}
                >
                  <td className="font-medium text-slate-900">{p.name}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>
                    {p.startDate ? formatDateSafe(p.startDate) : "—"}
                    {" → "}
                    {p.endDate ? formatDateSafe(p.endDate) : "—"}
                  </td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="New program">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">New program</h2>
              <label className="tbi-label" htmlFor="pg-name">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                id="pg-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className="tbi-input mb-2"
              />
              <label className="tbi-label" htmlFor="pg-desc">
                Description
              </label>
              <textarea
                id="pg-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows="2"
                className="tbi-input mb-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="tbi-label" htmlFor="pg-start">
                    Start
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
                    End
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
              <label className="tbi-label mt-2" htmlFor="pg-status">
                Status
              </label>
              <select
                id="pg-status"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="tbi-input mb-3"
              >
                {Object.values(PROGRAM_STATUS).map((s) => (
                  <option key={s} value={s}>
                    {s}
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

export default Programs;

