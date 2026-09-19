import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../../config/marian-config.js";
import AppShell from "../../../components/layout/AppShell.jsx";
import PageHeader from "../../../components/ui/PageHeader.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../../components/ui/states.jsx";
import { formatDateTimeSafe, toDateSafe } from "../../../lib/domain.js";
import { subscribeToAuditLog } from "../../../lib/audit.js";

// System audit trail viewer (Manager + System Administrator).
// Shows WHO did WHAT to WHICH record and when — never message content
// (writers only log metadata; see src/lib/audit.js).
function AuditLog() {
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("All");

  useEffect(() => {
    document.title = "Audit Log";
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
        unsub = subscribeToAuditLog(
          (list) => {
            if (!cancelled) {
              setEntries(list);
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setError("Failed to load the audit log.");
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.error("Error loading audit log:", err);
        if (!cancelled) {
          setError("Failed to load the audit log.");
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

  const actions = useMemo(
    () => ["All", ...Array.from(new Set(entries.map((e) => e.action).filter(Boolean))).sort()],
    [entries]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (actionFilter !== "All" && e.action !== actionFilter) return false;
      if (!q) return true;
      return [e.action, e.actorId, e.targetType, e.targetId, e.detail]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [entries, search, actionFilter]);

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Audit log"
        description="Who changed what, and when. Records are append-only — nothing here can be edited or deleted."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search actor, action, target..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search audit log"
          className="tbi-input max-w-64"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="tbi-input max-w-52"
          aria-label="Filter by action"
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "All" ? "All actions" : a}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="No audit entries" description="Administrative actions will be recorded here." />
      ) : (
        <div className="bg-white border border-line rounded overflow-x-auto">
          <table className="tbi-table min-w-[760px]">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Detail</th>
                <th scope="col">Actor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap">{formatDateTimeSafe(toDateSafe(e.createdAt))}</td>
                  <td className="font-medium text-slate-900 whitespace-nowrap">{e.action}</td>
                  <td className="whitespace-nowrap">
                    {e.targetType}
                    {e.targetId ? ` · ${String(e.targetId).slice(0, 8)}` : ""}
                  </td>
                  <td className="max-w-[280px] truncate" title={e.detail || ""}>
                    {e.detail || "—"}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">{e.actorId ? String(e.actorId).slice(0, 8) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="p-3 text-xs text-muted">Showing the 200 most recent of {filtered.length} matches.</p>
          )}
        </div>
      )}
    </AppShell>
  );
}

export default AuditLog;
