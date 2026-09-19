import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { APPLICATION_STATUS, formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";
import { isStaffAppRole } from "../../lib/permissions.js";
import {
  createDraftApplication,
  subscribeToAllApplications,
  subscribeToMyApplications,
} from "../../lib/applications.js";

function Applications() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") === "review" ? "Needs Review" : "All"
  );
  const [showCreate, setShowCreate] = useState(false);
  const [enterpriseName, setEnterpriseName] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const isStaff = isStaffAppRole(role);

  // The review shortcut is staff-only; fall back for everyone else.
  useEffect(() => {
    if (role && !isStaffAppRole(role)) {
      setStatusFilter((current) => (current === "Needs Review" ? "All" : current));
    }
  }, [role]);

  useEffect(() => {
    document.title = "Applications";
    let unsubApps = () => {};
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
        setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());
        setRole(userData.role || "");

        const staff = isStaffAppRole(userData.role);
        unsubApps = staff
          ? subscribeToAllApplications((list) => {
              if (!cancelled) {
                setApps(list);
                setLoading(false);
              }
            })
          : subscribeToMyApplications(userData.id, (list) => {
              if (!cancelled) {
                setApps(list);
                setLoading(false);
              }
            });
      } catch (err) {
        console.error("Error loading applications:", err);
        if (!cancelled) {
          setError("Failed to load applications. Please try again.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsubApps();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").toLowerCase();
    return (apps || []).filter((app) => {
      if (statusFilter === "Needs Review") {
        if (
          ![APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.SCREENING, APPLICATION_STATUS.FOR_EVALUATION].includes(
            app.status
          )
        ) {
          return false;
        }
      } else if (statusFilter !== "All" && app.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (app.enterpriseName || "").toLowerCase().includes(q) ||
        (app.description || "").toLowerCase().includes(q)
      );
    });
  }, [apps, search, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!enterpriseName.trim()) {
      setFormError("Enterprise name is required.");
      return;
    }
    setCreating(true);
    try {
      const id = await createDraftApplication(user.id, {
        enterpriseName: enterpriseName.trim(),
        description: description.trim(),
      });
      setShowCreate(false);
      setEnterpriseName("");
      setDescription("");
      navigate(`/applications/${id}`);
    } catch (err) {
      console.error("Error creating application:", err);
      setFormError("Failed to create a draft. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title={isStaff ? "Application review queue" : "My applications"}
        description={
          isStaff
            ? "Screen, evaluate, and decide on submitted applications."
            : "Draft, submit, and track your TBI application. Returned applications can be revised here."
        }
        actions={
          !isStaff && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
            >
              Start application
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search by enterprise or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search applications"
          className="tbi-input max-w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="tbi-input max-w-52"
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {isStaff && <option value="Needs Review">Needs review</option>}
          {Object.values(APPLICATION_STATUS).map((s) => (
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
          title="No applications found"
          description={
            isStaff
              ? "New submissions will appear here once applicants submit."
              : "Start an application to begin. You can save a draft and submit when ready."
          }
          action={
            !isStaff && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
              >
                Start application
              </button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-line rounded overflow-x-auto">
          <table className="tbi-table min-w-[680px]">
            <thead>
              <tr>
                <th scope="col">Enterprise</th>
                <th scope="col">Status</th>
                <th scope="col">Last updated</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <tr
                  key={app.id}
                  onClick={() => navigate(`/applications/${app.id}`)}
                  className="cursor-pointer"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/applications/${app.id}`)}
                >
                  <td className="font-medium text-slate-900">{app.enterpriseName || "Untitled application"}</td>
                  <td>
                    <StatusBadge status={app.status} />
                  </td>
                  <td>{formatDateTimeSafe(toDateSafe(app.updatedAt))}</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Start application">
          <form onSubmit={handleCreate} className="bg-white p-6 rounded shadow-lg w-full max-w-md">
            <h2 className="text-lg font-semibold text-slate-900 text-center">Start application</h2>
            <p className="text-[13px] text-muted text-center mt-1 mb-4">
              Creates a draft. You can complete details and submit from the next screen.
            </p>
            <label className="tbi-label" htmlFor="enterpriseName">
              Enterprise name <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="enterpriseName"
              type="text"
              value={enterpriseName}
              onChange={(e) => setEnterpriseName(e.target.value)}
              className="tbi-input mb-3"
              placeholder="e.g. Marian AgriTech"
              required
            />
            <label className="tbi-label" htmlFor="appDescription">
              Short description
            </label>
            <textarea
              id="appDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="tbi-input mb-3"
              rows="3"
              placeholder="What venture are you proposing?"
            />
            {formError && (
              <p className="text-red-600 text-[13px] mb-3" role="alert">
                {formError}
              </p>
            )}
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
                {creating ? "Creating..." : "Create draft"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

export default Applications;
