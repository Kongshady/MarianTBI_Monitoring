import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { auth, db } from "../../config/marian-config.js";
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import Avatar from "../ui/Avatar.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { FiX } from "react-icons/fi";
import { APP_ROLE_LIST, formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";
import { isSysAdminRole } from "../../lib/permissions.js";
import { writeAuditEntry } from "../../lib/audit.js";

// Full user-details experience as a slide-over drawer (all roles that reach
// user management). No social links, no group trivia — identity, standing,
// role control, status control, relevant activity, and a guarded danger zone.
// Props: userId, viewerRole, onClose, onRemoveRequest(user).
function UserDetailsDrawer({ userId, viewerRole, onClose, onRemoveRequest }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [groupName, setGroupName] = useState("");
  const [activity, setActivity] = useState([]);
  const [roleDraft, setRoleDraft] = useState("");
  const [roleMessage, setRoleMessage] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [confirmRole, setConfirmRole] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const showActivity = isSysAdminRole(viewerRole);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", userId),
      async (snap) => {
        if (!snap.exists()) {
          setLoadError("User record not found.");
          setLoading(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setUser(data);
        setRoleDraft(data.role || "");
        setRoleMessage("");
        setLoading(false);
        if (data.groupId) {
          try {
            const groupDoc = await getDoc(doc(db, "groups", data.groupId));
            setGroupName(groupDoc.exists() ? groupDoc.data().name || "" : "");
          } catch {
            setGroupName("");
          }
        } else {
          setGroupName("");
        }
      },
      () => {
        setLoadError("Failed to load this user.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    if (!userId || !showActivity) return;
    const q = query(collection(db, "auditLog"), where("targetId", "==", userId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setActivity(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0))
            .slice(0, 20)
        );
      },
      () => {}
    );
    return () => unsub();
  }, [userId, showActivity]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const lastOnline = toDateSafe(user?.lastOnline);
  const fullName = user ? `${user.name || ""} ${user.lastname || ""}`.trim() || "User" : "User";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`User details for ${fullName}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-md bg-surface shadow-xl overflow-y-auto">
        <div className="bg-primary-color px-6 py-5 flex items-center gap-4">
          {user?.profileImageUrl ? (
            <img src={user.profileImageUrl} alt={`${fullName}'s profile photo`} className="w-16 h-16 rounded-full object-cover border-2 border-white/40" />
          ) : (
            <Avatar name={fullName} size="lg" className="!w-16 !h-16 !text-lg !bg-white/15" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-white truncate">{loading ? "Loading..." : fullName}</h2>
            <p className="text-[13px] text-slate-300 truncate">{user?.email || ""}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close user details"
            className="p-2 rounded text-slate-300 hover:bg-white/10 hover:text-white transition shrink-0"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-muted">Loading user details...</p>
        ) : loadError || !user ? (
          <p className="p-6 text-sm text-red-600" role="alert">{loadError || "User unavailable."}</p>
        ) : (
          <div className="p-6 flex flex-col gap-5">
            <section aria-label="Account" className="bg-white border border-line rounded p-4">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-3">Account</h3>
              <dl className="text-sm flex flex-col gap-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Email</dt>
                  <dd className="font-medium text-slate-900 text-right break-all">{user.email}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Mobile</dt>
                  <dd className="font-medium text-slate-900">{user.mobile || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 items-center">
                  <dt className="text-muted">Status</dt>
                  <dd><StatusBadge status={user.status === "approved" ? "Active" : user.status === "disabled" ? "Disabled" : user.status || "—"} tone={user.status === "approved" ? "green" : user.status === "disabled" ? "red" : "gray"} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Registered</dt>
                  <dd className="font-medium text-slate-900 text-right">{formatDateTimeSafe(toDateSafe(user.timestamp))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Last login</dt>
                  <dd className="font-medium text-slate-900 text-right">
                    {lastOnline ? formatDistanceToNow(lastOnline, { addSuffix: true }) : "Never"}
                  </dd>
                </div>
                {groupName && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted">Startup</dt>
                    <dd className="font-medium text-slate-900 text-right">{groupName}</dd>
                  </div>
                )}
              </dl>
            </section>

            <section aria-label="Role assignment" className="bg-white border border-line rounded p-4">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-1">Role</h3>
              <p className="text-xs text-muted mb-3">Predefined roles only — assigning here never edits what the role contains. Configuration lives with the System Administrator.</p>
              <div className="flex flex-col min-[420px]:flex-row gap-2">
                <select
                  value={roleDraft}
                  onChange={(e) => setRoleDraft(e.target.value)}
                  className="tbi-input flex-1"
                  aria-label="Assign role"
                >
                  {APP_ROLE_LIST.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  onClick={() => roleDraft !== user.role && setConfirmRole(true)}
                  disabled={roleSaving || !roleDraft || roleDraft === user.role}
                  className="px-4 py-2 bg-primary-color text-white text-sm font-medium rounded hover:bg-primary-deep transition disabled:opacity-60 shrink-0"
                >
                  {roleSaving ? "Saving..." : "Assign"}
                </button>
              </div>
              {roleMessage && <p className="text-xs text-slate-600 mt-2" role="status">{roleMessage}</p>}
            </section>

            <section aria-label="Account status" className="bg-white border border-line rounded p-4">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-1">Account status</h3>
              <p className="text-xs text-muted mb-3">
                {user.status === "disabled"
                  ? "Disabled accounts cannot sign in. History is preserved."
                  : "Disabling revokes access immediately without deleting history."}
              </p>
              {user.status === "disabled" ? (
                <button
                  onClick={() => setConfirmStatus("approved")}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded hover:bg-emerald-700 transition"
                >
                  Reactivate account
                </button>
              ) : (
                <button
                  onClick={() => setConfirmStatus("disabled")}
                  className="px-4 py-2 bg-white border border-line text-amber-700 text-sm font-medium rounded hover:bg-amber-50 transition"
                >
                  Disable account
                </button>
              )}
            </section>

            {showActivity && (
              <section aria-label="Account activity" className="bg-white border border-line rounded p-4">
                <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-3">
                  Recent admin activity on this account
                </h3>
                {activity.length === 0 ? (
                  <p className="text-[13px] text-muted">No recorded actions for this account.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {activity.map((e) => (
                      <li key={e.id} className="py-2">
                        <p className="text-[13px] font-medium text-slate-900">{e.action}</p>
                        <p className="text-xs text-muted">
                          {formatDateTimeSafe(toDateSafe(e.createdAt))}
                          {e.detail ? ` · ${e.detail}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section aria-label="Danger zone" className="border border-red-200 bg-red-50/50 rounded p-4">
              <h3 className="text-[13px] font-semibold tracking-wide text-red-700 uppercase mb-1">Danger zone</h3>
              <p className="text-xs text-red-700/80 mb-3">
                Permanent deletion removes the account record. Prefer disabling unless removal is required.
              </p>
              <button
                onClick={() => onRemoveRequest(user)}
                className="px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded hover:bg-red-50 transition"
              >
                Remove account...
              </button>
            </section>
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={confirmRole}
        title={`Change ${user?.name || "user"}'s role to "${roleDraft}"?`}
        description="This changes what the user can access."
        confirmLabel="Change role"
        busy={roleSaving}
        onConfirm={async () => {
          const draft = roleDraft;
          if (!user || !draft || draft === user.role) {
            setConfirmRole(false);
            return;
          }
          setRoleSaving(true);
          try {
            await updateDoc(doc(db, "users", user.id), { role: draft });
            await writeAuditEntry({
              actorId: auth.currentUser?.uid,
              action: "user.role_changed",
              targetType: "user",
              targetId: user.id,
              detail: `${user.role} → ${draft}`,
            });
            setUser({ ...user, role: draft });
            setRoleMessage("Role updated.");
            toast(`Role changed to ${draft}.`);
          } catch (error) {
            console.error("Error updating role:", error);
            setRoleMessage("Failed to update the role.");
          } finally {
            setRoleSaving(false);
            setConfirmRole(false);
          }
        }}
        onCancel={() => !roleSaving && setConfirmRole(false)}
      />
      <ConfirmDialog
        open={!!confirmStatus}
        title={confirmStatus === "disabled" ? `Disable ${user?.name || "user"}'s account?` : `Reactivate ${user?.name || "user"}'s account?`}
        description={
          confirmStatus === "disabled"
            ? "Access is revoked immediately. Historical records are preserved."
            : "The user regains access with their existing role."
        }
        confirmLabel={confirmStatus === "disabled" ? "Disable" : "Reactivate"}
        danger={confirmStatus === "disabled"}
        busy={statusSaving}
        onConfirm={async () => {
          if (!confirmStatus || !user) return;
          const to = confirmStatus;
          setStatusSaving(true);
          try {
            await updateDoc(doc(db, "users", user.id), { status: to });
            await writeAuditEntry({
              actorId: auth.currentUser?.uid,
              action: to === "disabled" ? "user.disabled" : "user.enabled",
              targetType: "user",
              targetId: user.id,
              detail: `${user.status || "approved"} → ${to}`,
            });
            setUser({ ...user, status: to });
            toast(to === "disabled" ? "Account disabled." : "Account enabled.");
          } catch (error) {
            console.error("Error changing account status:", error);
            toast("Failed to change account status.", "error");
          } finally {
            setStatusSaving(false);
            setConfirmStatus(null);
          }
        }}
        onCancel={() => !statusSaving && setConfirmStatus(null)}
      />
    </div>
  );
}

export default UserDetailsDrawer;
