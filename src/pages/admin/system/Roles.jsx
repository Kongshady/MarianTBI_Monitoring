import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../config/marian-config.js";
import AppShell from "../../../components/layout/AppShell.jsx";
import PageHeader, { SectionTitle } from "../../../components/ui/PageHeader.jsx";
import Tabs from "../../../components/ui/Tabs.jsx";
import StatusBadge from "../../../components/ui/StatusBadge.jsx";
import { ErrorState, PageSkeleton } from "../../../components/ui/states.jsx";
import { APP_ROLE_LIST } from "../../../lib/domain.js";
import { MODULES, PERMISSION_CATALOG, ROLE_SUMMARIES, SCOPE_DESCRIPTIONS } from "../../../lib/permissionCatalog.js";
import { isProtectedRole, overrideForRole, subscribeRoleOverrides } from "../../../lib/roleOverrides.js";
import { effectivePermissionsFor } from "../../../lib/roleOverrides.js";
import { isSysAdminRole } from "../../../lib/permissions.js";
import { subscribeToAuditLog } from "../../../lib/audit.js";
import { formatDateTimeSafe, toDateSafe } from "../../../lib/domain.js";
import RoleDetailsDrawer from "../../../components/modals/RoleDetailsDrawer.jsx";
import { FiLock, FiAlertTriangle, FiChevronRight, FiInfo } from "react-icons/fi";

const SHORT_ROLE_LABELS = Object.freeze({
  "TBI Manager": "Manager",
  "TBI Assistant": "Assistant",
  "Portfolio Manager": "Portfolio",
  Incubatee: "Incubatee",
  Applicant: "Applicant",
  Mentor: "Mentor",
  Management: "Mgmt",
  "System Administrator": "SysAdmin",
});

const SHORT_SCOPES = Object.freeze({
  All: "All",
  Organization: "Org",
  Assigned: "Asg",
  Own: "Own",
});

// Roles & Permissions: Role → Module → Action → Scope.
// - TBI Managers get a read-only reference (they assign predefined roles in
//   user management; configuration stays with the System Administrator).
// - System Administrators configure via adjustments that are confirmed,
//   audit-logged, archived instead of deleted, and enforced in
//   firestore.rules — never by hiding UI alone.
function Roles() {
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("roles");
  const [users, setUsers] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);

  const canConfigure = isSysAdminRole(role);

  useEffect(() => {
    document.title = "Roles & Permissions";
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
        setRole(userDoc.data().role || "");
        setUserName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
        setLoading(false);
      } catch (err) {
        console.error("Error loading viewer:", err);
        setError("Failed to load.");
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    const unsubOverrides = subscribeRoleOverrides(setOverrides, () => {});
    return () => {
      unsubUsers();
      unsubOverrides();
    };
  }, []);

  useEffect(() => {
    if (!isSysAdminRole(role)) return;
    return subscribeToAuditLog(
      (entries) =>
        setAuditEntries(
          entries.filter((e) => e.action?.startsWith("role.") || e.action?.startsWith("user.")).slice(0, 30)
        ),
      () => {}
    );
  }, [role]);

  const usersByRole = useMemo(() => {
    const map = {};
    APP_ROLE_LIST.forEach((r) => {
      map[r] = [];
    });
    users.forEach((u) => {
      if (map[u.role]) map[u.role].push(u);
    });
    return map;
  }, [users]);

  const effectiveByRole = useMemo(() => {
    const map = {};
    APP_ROLE_LIST.forEach((r) => {
      map[r] = new Set(effectivePermissionsFor(r, overrides));
    });
    return map;
  }, [overrides]);

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Roles & permissions"
        description="What each role can do, grouped by module with action and scope. Assigning a predefined role happens per account in user management; changing what a role contains happens here and is limited to the System Administrator."
        actions={
          <Link
            to="/admin-user-management"
            className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
          >
            Assign roles in user management
          </Link>
        }
      />

      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <div className="mb-5 bg-white border border-line rounded p-4 flex gap-2.5">
            <FiInfo aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
            <p className="text-[13px] text-slate-700">
              <strong className="font-semibold">Assigning</strong> gives a person a predefined role
              (user management{canConfigure ? "" : ", where you already work"}).{" "}
              <strong className="font-semibold">Configuring</strong> changes what a role itself can
              do — {canConfigure ? "available to you as System Administrator" : "limited to the System Administrator"} —
              and every change needs a reason, a confirmation, and an audit entry.
              {!canConfigure && " This page is your read-only reference."}
            </p>
          </div>

          <Tabs
            tabs={[
              { key: "roles", label: "Roles", count: APP_ROLE_LIST.length },
              { key: "matrix", label: "Permission matrix" },
              { key: "changes", label: "Changes" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === "roles" && (
            <>
              <SectionTitle hint="Effective permissions include active System Administrator adjustments.">
                Roles
              </SectionTitle>
              <ul className="grid gap-3 sm:grid-cols-2">
                {APP_ROLE_LIST.map((r) => {
                  const effective = effectiveByRole[r] || new Set();
                  const sensitiveCount = PERMISSION_CATALOG.filter((p) => p.sensitive && effective.has(p.key)).length;
                  const overrideDoc = overrideForRole(overrides, r);
                  const adjusted = !!overrideDoc && overrideDoc.status === "active";
                  return (
                    <li key={r}>
                      <button
                        onClick={() => setSelectedRole(r)}
                        className="w-full text-left bg-white border border-line rounded p-4 hover:border-accent hover:shadow-sm transition"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 flex-1">{r}</span>
                          {isProtectedRole(r) && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-line rounded px-1.5 py-0.5">
                              <FiLock aria-hidden="true" /> Locked
                            </span>
                          )}
                          {adjusted && (
                            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                              Adjusted
                            </span>
                          )}
                          <FiChevronRight aria-hidden="true" className="text-muted" />
                        </span>
                        <span className="block text-[13px] text-muted mt-1">{ROLE_SUMMARIES[r]}</span>
                        <span className="block text-xs text-slate-600 mt-2">
                          {effective.size} permission{effective.size === 1 ? "" : "s"} · {sensitiveCount} sensitive · {(usersByRole[r] || []).length} user{(usersByRole[r] || []).length === 1 ? "" : "s"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {activeTab === "matrix" && (
            <>
              <SectionTitle hint="Scope per cell — hover for the full meaning. Lock marks a sensitive action.">
                Permission matrix
              </SectionTitle>
              <div className="bg-white border border-line rounded overflow-x-auto">
                <table className="text-[13px] min-w-[880px] w-full">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-line">
                      <th scope="col" className="text-left font-semibold px-4 py-2.5 sticky left-0 bg-slate-50 z-10 min-w-[220px]">
                        Module · Action
                      </th>
                      {APP_ROLE_LIST.map((r) => (
                        <th key={r} scope="col" className="font-semibold px-2 py-2.5 text-center whitespace-nowrap" title={r}>
                          {SHORT_ROLE_LABELS[r] || r}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((module) => {
                      const rows = PERMISSION_CATALOG.filter((p) => p.module === module.name);
                      if (rows.length === 0) return null;
                      return [
                        <tr key={`${module.name}-header`} className="bg-slate-50/70 border-y border-line">
                          <td colSpan={APP_ROLE_LIST.length + 1} className="px-4 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase sticky left-0">
                            {module.name}
                          </td>
                        </tr>,
                        ...rows.map((entry) => (
                          <tr key={entry.key} className="border-b border-line last:border-b-0 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 sticky left-0 bg-white" title={entry.description}>
                              <span className="inline-flex items-center gap-1.5 text-slate-900 font-medium">
                                {entry.action}
                                {entry.sensitive && (
                                  <FiAlertTriangle aria-hidden="true" className="text-red-600 shrink-0" title="Sensitive action" />
                                )}
                              </span>
                            </td>
                            {APP_ROLE_LIST.map((r) => {
                              const granted = (effectiveByRole[r] || new Set()).has(entry.key);
                              return (
                                <td key={r} className="px-2 py-2 text-center">
                                  {granted ? (
                                    <span
                                      className="inline-block text-[11px] font-medium px-1.5 py-0.5 rounded bg-primary-color/10 text-primary-color whitespace-nowrap"
                                      title={`${entry.scope}: ${SCOPE_DESCRIPTIONS[entry.scope]}`}
                                    >
                                      {SHORT_SCOPES[entry.scope]}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300" aria-label="Not granted">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        )),
                      ];
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted mt-2">
                All = program-wide · Org = organization oversight (read-oriented) · Asg = assigned records only · Own = own records only.
              </p>
            </>
          )}

          {activeTab === "changes" && (
            <>
              <SectionTitle hint="Adjustments are archived, never deleted. Full history lives in the audit log.">
                Changes
              </SectionTitle>
              {overrides.length === 0 && auditEntries.length === 0 && (
                <p className="text-sm text-muted">No adjustments recorded. Roles currently run on their defaults.</p>
              )}
              <div className="flex flex-col gap-3">
                {overrides.map((o) => (
                  <div key={o.id} className="bg-white border border-line rounded p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-slate-900 flex-1">{o.id}</h3>
                      <StatusBadge status={o.status === "active" ? "Active" : "Archived"} tone={o.status === "active" ? "green" : "gray"} />
                      <button
                        onClick={() => setSelectedRole(o.id)}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Open role
                      </button>
                    </div>
                    {(o.grants || []).length > 0 && (
                      <p className="text-xs mt-2">
                        <span className="font-medium text-emerald-700">Granted: </span>
                        <span className="text-slate-600">{o.grants.join(", ")}</span>
                      </p>
                    )}
                    {(o.revokes || []).length > 0 && (
                      <p className="text-xs mt-1">
                        <span className="font-medium text-red-700">Revoked: </span>
                        <span className="text-slate-600">{o.revokes.join(", ")}</span>
                      </p>
                    )}
                    <p className="text-xs text-muted mt-1">
                      {o.reason ? `${o.reason} · ` : ""}
                      {o.updatedAt ? formatDateTimeSafe(toDateSafe(o.updatedAt)) : ""}
                      {o.updatedBy ? ` · by ${o.updatedBy}` : ""}
                    </p>
                  </div>
                ))}
                {canConfigure && auditEntries.length > 0 && (
                  <div className="bg-white border border-line rounded p-4">
                    <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-2">
                      Recent role & account administration
                    </h3>
                    <ul className="flex flex-col divide-y divide-line">
                      {auditEntries.map((e) => (
                        <li key={e.id} className="py-2">
                          <p className="text-[13px] font-medium text-slate-900">{e.action}</p>
                          <p className="text-xs text-muted">
                            {e.targetType ? `${e.targetType}: ` : ""}{e.targetId || ""}
                            {e.detail ? ` — ${e.detail}` : ""}
                            {e.createdAt ? ` · ${formatDateTimeSafe(toDateSafe(e.createdAt))}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {selectedRole && !loading && !error && (
        <RoleDetailsDrawer
          role={selectedRole}
          canConfigure={canConfigure}
          usersInRole={usersByRole[selectedRole] || []}
          overrides={overrides}
          onClose={() => setSelectedRole(null)}
        />
      )}
    </AppShell>
  );
}

export default Roles;
