import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../../config/marian-config.js";
import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import StatusBadge from "../ui/StatusBadge.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import Avatar from "../ui/Avatar.jsx";
import { toast } from "../../lib/toast.js";
import { writeAuditEntry } from "../../lib/audit.js";
import { GROUP_ROLE_LIST } from "../../lib/domain.js";
import { FiX, FiAlertTriangle } from "react-icons/fi";

// Spacious edit workspace for a startup (staff only): details, team
// management, and a separated danger zone. Replaces the cramped edit modal
// with the same database writes, plus audit entries and toasts.
// Props: group, groups (all startups, for the one-PM rule), canDelete,
// archiveTo, deleteTo, onClose, onSave(updatedGroup).
function EditStartupPanel({ group, groups, canDelete, archiveTo, deleteTo, onClose, onSave }) {
  const [name, setName] = useState(group.name || "");
  const [description, setDescription] = useState(group.description || "");
  const [members, setMembers] = useState(group.members || []);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [addError, setAddError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteChecked, setDeleteChecked] = useState(false);
  const [dangerBusy, setDangerBusy] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    setName(group.name || "");
    setDescription(group.description || "");
    setMembers(group.members || []);
  }, [group.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const fetchAvailableUsers = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const users = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Same eligibility as before: approved, not already assigned here,
        // never staff roles.
        setAvailableUsers(
          users.filter(
            (user) =>
              !(group.members || []).some((member) => member.id === user.id) &&
              user.status === "approved" &&
              !["Portfolio Manager", "TBI Manager", "TBI Assistant"].includes(user.role)
          )
        );
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };
    fetchAvailableUsers();
  }, [group.members]);

  const isPmElsewhere = (userId) =>
    (groups || []).some(
      (g) => g.id !== group.id && (g.members || []).some((m) => m.id === userId && m.groupRole === "Project Manager")
    );

  const handleAddMember = () => {
    setAddError("");
    if (!selectedUser || !selectedRole) {
      setAddError("Select a person and a startup role first.");
      return;
    }
    const userToAdd = availableUsers.find((user) => user.id === selectedUser);
    if (!userToAdd) {
      setAddError("That person is no longer available.");
      return;
    }
    if (selectedRole === "Project Manager" && isPmElsewhere(userToAdd.id)) {
      setAddError(`${userToAdd.name} is already a Project Manager in another startup.`);
      return;
    }
    if (members.some((m) => m.id === userToAdd.id)) {
      setAddError("That person is already on this team.");
      return;
    }
    setMembers([
      ...members,
      { id: userToAdd.id, name: userToAdd.name, lastname: userToAdd.lastname, groupRole: selectedRole },
    ]);
    setAvailableUsers(availableUsers.filter((u) => u.id !== userToAdd.id));
    setSelectedUser("");
    setSelectedRole("");
  };

  const handleChangeMemberRole = (memberId, nextRole) => {
    if (nextRole === "Project Manager" && isPmElsewhere(memberId)) {
      toast("That person is already a Project Manager in another startup.", "error");
      return;
    }
    setMembers(members.map((m) => (m.id === memberId ? { ...m, groupRole: nextRole } : m)));
  };

  const handleRemoveMember = (memberId) => {
    setMembers(members.filter((m) => m.id !== memberId));
  };

  const dirty = name !== (group.name || "") || description !== (group.description || "");

  const membersChanged = () => {
    const before = group.members || [];
    if (before.length !== members.length) return true;
    return members.some((m) => {
      const old = before.find((b) => b.id === m.id);
      return !old || old.groupRole !== m.groupRole;
    });
  };

  const handleSave = async () => {
    setSaveError("");
    if (!name.trim()) {
      setSaveError("Startup name is required.");
      return;
    }
    setSaving(true);
    try {
      const memberIds = members.map((member) => member.id);
      await updateDoc(doc(db, "groups", group.id), { name: name.trim(), description, members, memberIds });
      // Members taken off the roster return to the incubatee pool.
      const removed = (group.members || []).filter((m) => !members.some((kept) => kept.id === m.id));
      await Promise.all(
        removed.map((m) => updateDoc(doc(db, "users", m.id), { groupId: null, role: "Incubatee" }))
      );
      if (membersChanged()) {
        await writeAuditEntry({
          actorId: auth.currentUser?.uid,
          action: "group.members_changed",
          targetType: "group",
          targetId: group.id,
          detail: `${members.length} member(s) on roster`,
        });
      }
      toast("Startup saved.");
      onSave({ name: name.trim(), description, members, memberIds });
      onClose();
    } catch (error) {
      console.error("Error saving startup:", error);
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    setDangerBusy(true);
    try {
      await updateDoc(doc(db, "groups", group.id), { archived: true });
      await writeAuditEntry({
        actorId: auth.currentUser?.uid,
        action: "group.archived",
        targetType: "group",
        targetId: group.id,
        detail: group.name || "",
      });
      toast("Startup archived.");
      navigate(archiveTo);
    } catch (error) {
      console.error("Error archiving startup:", error);
      toast("Failed to archive the startup.", "error");
    } finally {
      setDangerBusy(false);
      setConfirmArchive(false);
      onClose();
    }
  };

  const handleDelete = async () => {
    setDangerBusy(true);
    try {
      await deleteDoc(doc(db, "groups", group.id));
      await writeAuditEntry({
        actorId: auth.currentUser?.uid,
        action: "group.deleted",
        targetType: "group",
        targetId: group.id,
        detail: group.name || "",
      });
      toast("Startup deleted.");
      navigate(deleteTo);
    } catch (error) {
      console.error("Error deleting startup:", error);
      toast("Failed to delete the startup.", "error");
    } finally {
      setDangerBusy(false);
      setShowDelete(false);
      setDeleteChecked(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Edit ${group.name}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-xl bg-surface shadow-xl flex flex-col">
        <div className="bg-primary-color px-6 py-5 flex items-start gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-slate-300">Edit startup</p>
            <h2 className="text-lg font-semibold text-white truncate">{group.name}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close edit startup"
            className="p-2 rounded text-slate-300 hover:bg-white/10 hover:text-white transition shrink-0"
          >
            <FiX aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <section aria-label="Startup details" className="bg-white border border-line rounded p-4">
            <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-3">Details</h3>
            <label htmlFor="edit-startup-name" className="tbi-label">Startup name</label>
            <input
              id="edit-startup-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="tbi-input"
            />
            <label htmlFor="edit-startup-desc" className="tbi-label mt-3">Description</label>
            <textarea
              id="edit-startup-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="tbi-input"
              rows="4"
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[13px] text-muted">Lifecycle status:</span>
              <StatusBadge status={group.incubateeStatus || "Active"} />
            </div>
            <p className="text-xs text-muted mt-1">
              Lifecycle moves happen in Overview → Lifecycle status, where transitions are validated.
            </p>
            {saveError && <p className="text-[13px] text-red-600 mt-2" role="alert">{saveError}</p>}
          </section>

          <section aria-label="Team management" className="bg-white border border-line rounded p-4">
            <h3 className="text-[13px] font-semibold tracking-wide text-muted uppercase mb-1">Team</h3>
            <p className="text-xs text-muted mb-3">Select a person, pick their startup role, then add them.</p>
            <div className="flex flex-col min-[480px]:flex-row gap-2">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="tbi-input flex-1"
                aria-label="Select person to add"
              >
                <option value="">Select person...</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.lastname} · {user.role}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="tbi-input min-[480px]:max-w-44"
                disabled={!selectedUser}
                aria-label="Select startup role"
              >
                <option value="">Select role...</option>
                {GROUP_ROLE_LIST.map((r) => (
                  <option
                    key={r}
                    value={r}
                    disabled={
                      r === "Project Manager" &&
                      selectedUser &&
                      (isPmElsewhere(selectedUser) || members.some((m) => m.groupRole === "Project Manager"))
                    }
                  >
                    {r}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                className="px-4 py-2 bg-primary-color text-white text-sm font-medium rounded hover:bg-primary-deep transition shrink-0"
              >
                Add
              </button>
            </div>
            {addError && <p className="text-xs text-red-600 mt-2" role="alert">{addError}</p>}
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {members.length === 0 && <li className="py-2 text-sm text-muted">No members yet.</li>}
              {members.map((member) => {
                const label = `${member.name || ""} ${member.lastname || ""}`.trim() || "Member";
                return (
                  <li key={member.id} className="py-2 flex items-center gap-2.5">
                    <Avatar name={label} size="sm" />
                    <span className="text-sm font-medium text-slate-900 flex-1 min-w-0 truncate">{label}</span>
                    <select
                      value={member.groupRole || ""}
                      onChange={(e) => handleChangeMemberRole(member.id, e.target.value)}
                      className="tbi-input !w-auto text-[13px]"
                      aria-label={`Startup role for ${label}`}
                    >
                      {GROUP_ROLE_LIST.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-xs font-medium text-red-600 hover:underline shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted mt-2">
              Removing takes the person off this roster and returns their account to the incubatee pool.
            </p>
          </section>

          <section aria-label="Danger zone" className="border border-red-200 bg-red-50/50 rounded p-4">
            <h3 className="text-[13px] font-semibold tracking-wide text-red-700 uppercase mb-1 flex items-center gap-1.5">
              <FiAlertTriangle aria-hidden="true" /> Danger zone
            </h3>
            <p className="text-xs text-red-700/80 mb-3">
              Archiving moves the startup out of the active list without deleting anything. Deletion is permanent.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setConfirmArchive(true)}
                className="px-4 py-2 bg-white border border-line text-slate-700 text-sm font-medium rounded hover:bg-slate-50 transition"
              >
                Archive startup...
              </button>
              {canDelete && (
                <button
                  onClick={() => setShowDelete(true)}
                  className="px-4 py-2 bg-white border border-red-300 text-red-700 text-sm font-medium rounded hover:bg-red-50 transition"
                >
                  Delete startup...
                </button>
              )}
            </div>
            {showDelete && (
              <div className="mt-3 bg-white border border-red-200 rounded p-3" role="alertdialog" aria-label="Confirm deletion">
                <p className="text-sm text-slate-900">
                  Delete <strong className="font-semibold">{group.name}</strong>? This is permanent and
                  cannot be undone.
                </p>
                <label className="flex items-center gap-2 text-[13px] mt-2">
                  <input
                    type="checkbox"
                    checked={deleteChecked}
                    onChange={(e) => setDeleteChecked(e.target.checked)}
                    className="accent-red-600"
                  />
                  I understand this cannot be undone.
                </label>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setShowDelete(false);
                      setDeleteChecked(false);
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-800 text-sm font-medium rounded hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={!deleteChecked || dangerBusy}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition disabled:opacity-60"
                  >
                    {dangerBusy ? "Deleting..." : "Delete permanently"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="shrink-0 border-t border-line bg-white px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-800 text-sm font-medium rounded hover:bg-slate-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && !membersChanged())}
            className="px-4 py-2 bg-primary-color text-white text-sm font-medium rounded hover:bg-primary-deep transition disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmArchive}
        title={`Archive ${group.name}?`}
        description="It leaves the active list but nothing is deleted. You can find it in Archives."
        confirmLabel="Archive"
        busy={dangerBusy}
        onConfirm={handleArchive}
        onCancel={() => !dangerBusy && setConfirmArchive(false)}
      />
    </div>
  );
}

export default EditStartupPanel;
