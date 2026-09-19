import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { auth, db } from "../../config/marian-config.js";
import { doc, updateDoc } from "firebase/firestore";
import Avatar from "../ui/Avatar.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";
import { writeAuditEntry } from "../../lib/audit.js";

// Managed-users table: Name, Email, Role, Account Status, Registered Date,
// Last Login, Actions (View, Disable/Enable). Permanent removal lives in
// the details drawer danger zone — never as a routine row action.
// Props: title, users, onView(user).
function ApprovedUsersTable({ title = "Users", users, onView }) {
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const sortedUsers = [...(users || [])].sort((a, b) => {
    const nameA = `${a.name || ""} ${a.lastname || ""}`.toLowerCase();
    const nameB = `${b.name || ""} ${b.lastname || ""}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const runStatusToggle = async () => {
    if (!statusTarget) return;
    const { user: target, to } = statusTarget;
    setStatusSaving(true);
    try {
      await updateDoc(doc(db, "users", target.id), { status: to });
      await writeAuditEntry({
        actorId: auth.currentUser?.uid,
        action: to === "disabled" ? "user.disabled" : "user.enabled",
        targetType: "user",
        targetId: target.id,
        detail: `${target.status || "approved"} → ${to}`,
      });
      toast(to === "disabled" ? "Account disabled. Access is revoked; history is preserved." : "Account enabled.");
    } catch (error) {
      console.error("Error changing account status:", error);
      toast("Failed to change account status.", "error");
    } finally {
      setStatusSaving(false);
      setStatusTarget(null);
    }
  };

  if (sortedUsers.length === 0) {
    return <p className="text-sm text-muted">No users in this view.</p>;
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-3">{title}</h2>

      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {sortedUsers.map((user) => {
          const fullName = `${user.name || ""} ${user.lastname || ""}`.trim() || "User";
          const lastOnline = toDateSafe(user.lastOnline);
          const disabled = user.status === "disabled";
          return (
            <li key={user.id} className="bg-white border border-line rounded p-4">
              <div className="flex items-center gap-3">
                {user.profileImageUrl ? (
                  <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <Avatar name={fullName} size="md" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900 truncate">{fullName}</p>
                  <p className="text-[13px] text-muted truncate">{user.email}</p>
                </div>
                <StatusBadge
                  status={disabled ? "Disabled" : user.status === "approved" ? "Active" : user.status || "—"}
                  tone={disabled ? "red" : user.status === "approved" ? "green" : "gray"}
                />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                <div>
                  <dt className="text-muted">Role</dt>
                  <dd className="font-medium text-slate-900">{user.role}</dd>
                </div>
                <div>
                  <dt className="text-muted">Registered</dt>
                  <dd className="font-medium text-slate-900">{formatDateTimeSafe(toDateSafe(user.timestamp))}</dd>
                </div>
                <div>
                  <dt className="text-muted">Last login</dt>
                  <dd className="font-medium text-slate-900">
                    {lastOnline ? formatDistanceToNow(lastOnline, { addSuffix: true }) : "Never"}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onView(user)}
                  className="flex-1 px-3 py-2 bg-primary-color text-white rounded text-xs font-medium hover:bg-primary-deep transition"
                >
                  View
                </button>
                {disabled ? (
                  <button
                    onClick={() => setStatusTarget({ user, to: "approved" })}
                    className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
                  >
                    Reactivate
                  </button>
                ) : (
                  <button
                    onClick={() => setStatusTarget({ user, to: "disabled" })}
                    className="flex-1 px-3 py-2 bg-white border border-line text-amber-700 rounded text-xs font-medium hover:bg-amber-50 transition"
                  >
                    Disable
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block bg-white border border-line rounded overflow-x-auto">
        <table className="tbi-table min-w-[820px]">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Account status</th>
              <th scope="col">Registered</th>
              <th scope="col">Last login</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => {
              const fullName = `${user.name || ""} ${user.lastname || ""}`.trim() || "User";
              const lastOnline = toDateSafe(user.lastOnline);
              const disabled = user.status === "disabled";
              return (
                <tr key={user.id}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      {user.profileImageUrl ? (
                        <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <Avatar name={fullName} size="sm" />
                      )}
                      <span className="font-medium text-slate-900">{fullName}</span>
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate" title={user.email}>{user.email}</td>
                  <td className="whitespace-nowrap">{user.role}</td>
                  <td>
                    <StatusBadge
                      status={disabled ? "Disabled" : user.status === "approved" ? "Active" : user.status || "—"}
                      tone={disabled ? "red" : user.status === "approved" ? "green" : "gray"}
                    />
                  </td>
                  <td className="whitespace-nowrap">{formatDateTimeSafe(toDateSafe(user.timestamp))}</td>
                  <td className="whitespace-nowrap">
                    {lastOnline ? formatDistanceToNow(lastOnline, { addSuffix: true }) : "Never"}
                  </td>
                  <td>
                    <span className="flex justify-end gap-1.5">
                      <button
                        onClick={() => onView(user)}
                        className="px-3 py-1.5 bg-primary-color text-white rounded text-xs font-medium hover:bg-primary-deep transition"
                      >
                        View
                      </button>
                      {disabled ? (
                        <button
                          onClick={() => setStatusTarget({ user, to: "approved" })}
                          className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
                        >
                          Reactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => setStatusTarget({ user, to: "disabled" })}
                          className="px-3 py-1.5 bg-white border border-line text-amber-700 rounded text-xs font-medium hover:bg-amber-50 transition"
                        >
                          Disable
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!statusTarget}
        title={statusTarget?.to === "disabled" ? `Disable ${statusTarget?.user?.name || "user"}'s account?` : `Reactivate ${statusTarget?.user?.name || "user"}'s account?`}
        description={
          statusTarget?.to === "disabled"
            ? "Access is revoked immediately. Historical records are preserved."
            : "The user regains access with their existing role."
        }
        confirmLabel={statusTarget?.to === "disabled" ? "Disable" : "Reactivate"}
        danger={statusTarget?.to === "disabled"}
        busy={statusSaving}
        onConfirm={runStatusToggle}
        onCancel={() => !statusSaving && setStatusTarget(null)}
      />
    </div>
  );
}

export default ApprovedUsersTable;
