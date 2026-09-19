import { useState } from "react";
import { Link } from "react-router-dom";
import { auth } from "../../config/marian-config.js";
import Avatar from "../ui/Avatar.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { MODULES, PERMISSION_CATALOG, ROLE_SUMMARIES, SCOPE_DESCRIPTIONS, catalogEntryFor } from "../../lib/permissionCatalog.js";
import { defaultPermissionsFor } from "../../lib/roles.js";
import {
  archiveRoleOverrides,
  effectivePermissionsFor,
  grantedKeysFor,
  isProtectedRole,
  overrideForRole,
  restoreRoleOverrides,
  revokedKeysFor,
  savePermissionChange,
} from "../../lib/roleOverrides.js";
import { FiX, FiLock, FiAlertTriangle, FiInfo } from "react-icons/fi";

const SCOPE_STYLES = Object.freeze({
  All: "bg-primary-color/10 text-primary-color",
  Organization: "bg-teal-50 text-teal-700 border border-teal-200",
  Assigned: "bg-amber-50 text-amber-700 border border-amber-200",
  Own: "bg-slate-100 text-slate-600 border border-line",
});

// Role details as a slide-over: permission groups by module, override
// state per permission, users holding the role, and (System Administrator
// only) the controls that modify what the role contains. Assigning a
// predefined role to a person happens in user management — never here.
function RoleDetailsDrawer({ role, canConfigure, usersInRole, overrides, onClose }) {
  const [changeKey, setChangeKey] = useState("");
  const [changeMode, setChangeMode] = useState("grant");
  const [changeReason, setChangeReason] = useState("");
  const [pendingChange, setPendingChange] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [saving, setSaving] = useState(false);

  const locked = isProtectedRole(role);
  const effective = new Set(effectivePermissionsFor(role, overrides));
  const grants = new Set(grantedKeysFor(role, overrides));
  const revokes = new Set(revokedKeysFor(role, overrides));
  const overrideDoc = overrideForRole(overrides, role);
  const hasActiveOverrides = !!overrideDoc && overrideDoc.status === "active" && (grants.size > 0 || revokes.size > 0);
  const sensitiveCount = PERMISSION_CATALOG.filter((p) => p.sensitive && effective.has(p.key)).length;
  const sortedUsers = [...(usersInRole || [])].sort((a, b) =>
    `${a.name || ""} ${a.lastname || ""}`.toLowerCase().localeCompare(`${b.name || ""} ${b.lastname || ""}`.toLowerCase())
  );

  const selectedEntry = changeKey ? catalogEntryFor(changeKey) : null;
  const baselineHas = changeKey ? defaultPermissionsFor(role).includes(changeKey) : false;

  const runChange = async () => {
    if (!pendingChange) return;
    setSaving(true);
    try {
      await savePermissionChange({
        role,
        key: pendingChange.key,
        mode: pendingChange.mode,
        reason: pendingChange.reason,
        actorId: auth.currentUser?.uid,
      });
      toast(
        pendingChange.mode === "grant"
          ? "Permission granted."
          : pendingChange.mode === "revoke"
            ? "Permission revoked."
            : "Permission returned to its default."
      );
      setChangeKey("");
      setChangeReason("");
      setChangeMode("grant");
    } catch (error) {
      console.error("Error saving permission change:", error);
      toast(error.message || "Failed to save the change.", "error");
    } finally {
      setSaving(false);
      setPendingChange(null);
    }
  };

  const runArchive = async () => {
    setSaving(true);
    try {
      await archiveRoleOverrides({ role, reason: "Archived from role details.", actorId: auth.currentUser?.uid });
      toast("Custom adjustments archived. Defaults apply again.");
    } catch (error) {
      console.error("Error archiving overrides:", error);
      toast(error.message || "Failed to archive.", "error");
    } finally {
      setSaving(false);
      setConfirmArchive(false);
    }
  };

  const runRestore = async () => {
    setSaving(true);
    try {
      await restoreRoleOverrides({ role, reason: "Restored from role details.", actorId: auth.currentUser?.uid });
      toast("Custom adjustments restored.");
    } catch (error) {
      console.error("Error restoring overrides:", error);
      toast(error.message || "Failed to restore.", "error");
    } finally {
      setSaving(false);
      setConfirmRestore(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Role details for ${role}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-lg bg-surface shadow-xl overflow-y-auto">
        <div className="bg-primary-color px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wide text-slate-300">Role</p>
              <h2 className="text-lg font-semibold text-white">{role}</h2>
              <p className="text-[13px] text-slate-300 mt-0.5">{ROLE_SUMMARIES[role] || ""}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close role details"
              className="p-2 rounded text-slate-300 hover:bg-white/10 hover:text-white transition shrink-0"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs bg-white/15 text-white rounded px-2 py-1">
              {effective.size} permission{effective.size === 1 ? "" : "s"}
            </span>
            <span className="text-xs bg-white/15 text-white rounded px-2 py-1">
              {sensitiveCount} sensitive
            </span>
            <span className="text-xs bg-white/15 text-white rounded px-2 py-1">
              {sortedUsers.length} user{sortedUsers.length === 1 ? "" : "s"}
            </span>
            {hasActiveOverrides && (
              <span className="text-xs bg-amber-400/20 text-amber-200 rounded px-2 py-1">Custom adjustments active</span>
            )}
            {locked && (
              <span className="text-xs bg-white/15 text-white rounded px-2 py-1 inline-flex items-center gap-1">
                <FiLock aria-hidden="true" /> Locked role
              </span>
            )}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {locked && (
            <p className="text-[13px] bg-slate-100 border border-line rounded p-3 text-slate-700 flex gap-2">
              <FiLock aria-hidden="true" className="mt-0.5 shrink-0" />
              The System Administrator role is protected from modification so the system can never
              lock itself out or escalate by mistake.
            </p>
          )}

          <section aria-label="Permissions by module" className="flex flex-col gap-4">
            {MODULES.map((module) => {
              const entries = PERMISSION_CATALOG.filter((p) => p.module === module.name && effective.has(p.key));
              if (entries.length === 0) return null;
              return (
                <div key={module.name} className="bg-white border border-line rounded p-4">
                  <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">{module.name}</h3>
                  <ul className="mt-2 flex flex-col divide-y divide-line">
                    {entries.map((entry) => (
                      <li key={entry.key} className="py-2 flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 inline-flex items-center gap-1.5 flex-wrap">
                            {entry.action}
                            <span
                              className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${SCOPE_STYLES[entry.scope]}`}
                              title={SCOPE_DESCRIPTIONS[entry.scope]}
                            >
                              {entry.scope}
                            </span>
                            {entry.sensitive && (
                              <span
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5"
                                title="Sensitive action: needs explicit authority and confirmation."
                              >
                                <FiAlertTriangle aria-hidden="true" /> Sensitive
                              </span>
                            )}
                            {grants.has(entry.key) && (
                              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5" title="Added by a System Administrator adjustment.">
                                Granted
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted mt-0.5">{entry.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          {canConfigure && !locked && (
            <section aria-label="Modify role permissions" className="bg-white border border-line rounded p-4">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-1">Modify permissions</h3>
              <p className="text-xs text-muted mb-3 flex gap-1.5">
                <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
                This changes what the role contains for everyone holding it. Assigning the role to
                a person is a separate step in user management.
              </p>
              <label htmlFor="permSelect" className="tbi-label">Permission</label>
              <select
                id="permSelect"
                value={changeKey}
                onChange={(e) => setChangeKey(e.target.value)}
                className="tbi-input"
              >
                <option value="">Select a permission...</option>
                {MODULES.map((module) => (
                  <optgroup key={module.name} label={module.name}>
                    {PERMISSION_CATALOG.filter((p) => p.module === module.name).map((p) => {
                      const state = revokes.has(p.key)
                        ? "revoked"
                        : grants.has(p.key)
                          ? "granted by adjustment"
                          : defaultPermissionsFor(role).includes(p.key)
                            ? "default"
                            : "not granted";
                      return (
                        <option key={p.key} value={p.key}>
                          {p.action} · {p.scope} ({state}){p.sensitive ? " — sensitive" : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
              {selectedEntry && (
                <div className="mt-3">
                  <p className="text-xs text-muted mb-2">{selectedEntry.description}</p>
                  <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Change type">
                    {!baselineHas && !grants.has(changeKey) && (
                      <label className="flex items-center text-sm">
                        <input type="radio" name="changeMode" checked={changeMode === "grant"} onChange={() => setChangeMode("grant")} className="mr-2 accent-primary-color" />
                        Grant this permission
                      </label>
                    )}
                    {(baselineHas || grants.has(changeKey)) && (
                      <label className="flex items-center text-sm">
                        <input type="radio" name="changeMode" checked={changeMode === "revoke"} onChange={() => setChangeMode("revoke")} className="mr-2 accent-red-600" />
                        Revoke this permission
                      </label>
                    )}
                    {(grants.has(changeKey) || revokes.has(changeKey)) && (
                      <label className="flex items-center text-sm">
                        <input type="radio" name="changeMode" checked={changeMode === "restore"} onChange={() => setChangeMode("restore")} className="mr-2 accent-primary-color" />
                        Return to default ({baselineHas ? "granted" : "not granted"})
                      </label>
                    )}
                  </div>
                  <label htmlFor="permReason" className="tbi-label mt-3">Reason (recorded in the audit log)</label>
                  <input
                    id="permReason"
                    type="text"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="Why is this change needed?"
                    className="tbi-input"
                  />
                  <button
                    onClick={() => changeKey && setPendingChange({ key: changeKey, mode: changeMode, reason: changeReason.trim() })}
                    disabled={!changeKey}
                    className="mt-3 px-4 py-2 bg-primary-color text-white text-sm font-medium rounded hover:bg-primary-deep transition disabled:opacity-60"
                  >
                    Review change...
                  </button>
                </div>
              )}
              {hasActiveOverrides && (
                <div className="mt-4 pt-3 border-t border-line">
                  <button
                    onClick={() => setConfirmArchive(true)}
                    className="px-4 py-2 bg-white border border-line text-slate-700 text-sm font-medium rounded hover:bg-slate-50 transition"
                  >
                    Archive all adjustments...
                  </button>
                </div>
              )}
              {overrideDoc && overrideDoc.status === "archived" && (
                <div className="mt-4 pt-3 border-t border-line">
                  <p className="text-xs text-muted mb-2">Adjustments for this role are archived; defaults apply.</p>
                  <button
                    onClick={() => setConfirmRestore(true)}
                    className="px-4 py-2 bg-white border border-line text-slate-700 text-sm font-medium rounded hover:bg-slate-50 transition"
                  >
                    Restore archived adjustments...
                  </button>
                </div>
              )}
            </section>
          )}

          <section aria-label="Users with this role" className="bg-white border border-line rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase">
                Users with this role ({sortedUsers.length})
              </h3>
              <Link to="/admin-user-management" className="text-xs font-medium text-accent hover:underline">
                Manage users
              </Link>
            </div>
            {locked && sortedUsers.length <= 1 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-2 flex gap-1.5">
                <FiAlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" />
                {sortedUsers.length === 0
                  ? "No account currently holds this role. Keep at least one active System Administrator."
                  : "Only one account holds this role. Reassigning it would lock out system administration."}
              </p>
            )}
            {sortedUsers.length === 0 ? (
              <p className="text-[13px] text-muted">No accounts hold this role.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line max-h-64 overflow-y-auto">
                {sortedUsers.map((u) => {
                  const name = `${u.name || ""} ${u.lastname || ""}`.trim() || "User";
                  return (
                    <li key={u.id} className="py-2 flex items-center gap-2.5">
                      {u.profileImageUrl ? (
                        <img src={u.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <Avatar name={name} size="sm" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-slate-900 truncate">{name}</p>
                        <p className="text-xs text-muted truncate">{u.email}</p>
                      </div>
                      <StatusBadge
                        status={u.status === "approved" ? "Active" : u.status === "disabled" ? "Disabled" : u.status === "pending" ? "Pending" : u.status || "—"}
                        tone={u.status === "approved" ? "green" : u.status === "disabled" ? "red" : "gray"}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </aside>

      <ConfirmDialog
        open={!!pendingChange}
        title={
          pendingChange?.mode === "grant"
            ? `Grant "${catalogEntryFor(pendingChange?.key)?.action}" to ${role}?`
            : pendingChange?.mode === "revoke"
              ? `Revoke "${catalogEntryFor(pendingChange?.key)?.action}" from ${role}?`
              : `Return "${catalogEntryFor(pendingChange?.key)?.action}" to its default for ${role}?`
        }
        description={
          (selectedEntry?.sensitive
            ? "Sensitive permission — this changes access for everyone holding this role. "
            : "This changes access for everyone holding this role. ") +
          "The change is written to the audit log and enforced server-side."
        }
        confirmLabel={pendingChange?.mode === "revoke" ? "Revoke" : pendingChange?.mode === "grant" ? "Grant" : "Restore default"}
        danger={pendingChange?.mode === "revoke" || selectedEntry?.sensitive}
        busy={saving}
        onConfirm={runChange}
        onCancel={() => !saving && setPendingChange(null)}
      />
      <ConfirmDialog
        open={confirmArchive}
        title={`Archive all adjustments for ${role}?`}
        description="Defaults apply again. The archived record stays for history — nothing is deleted."
        confirmLabel="Archive"
        busy={saving}
        onConfirm={runArchive}
        onCancel={() => !saving && setConfirmArchive(false)}
      />
      <ConfirmDialog
        open={confirmRestore}
        title={`Restore archived adjustments for ${role}?`}
        description="The previously archived grants and revokes take effect again."
        confirmLabel="Restore"
        busy={saving}
        onConfirm={runRestore}
        onCancel={() => !saving && setConfirmRestore(false)}
      />
    </div>
  );
}

export default RoleDetailsDrawer;
