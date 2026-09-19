import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader, { SectionTitle } from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";
import { isStaffAppRole, isManagerAppRole } from "../../lib/permissions.js";
import {
  AUDIENCE_ROLES,
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementPublished,
  subscribeToAnnouncements,
  updateAnnouncement,
} from "../../lib/announcements.js";

const EMPTY_FORM = { title: "", body: "", audience: [] };

function Announcements() {
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const isStaff = isStaffAppRole(role);
  const isManager = isManagerAppRole(role);

  useEffect(() => {
    document.title = "Announcements";
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
        unsub = subscribeToAnnouncements(
          (list) => {
            if (!cancelled) {
              setItems(list);
              setLoading(false);
            }
          },
          () => {
            if (!cancelled) {
              setError("Failed to load announcements.");
              setLoading(false);
            }
          }
        );
      } catch (err) {
        console.error("Error loading announcements:", err);
        if (!cancelled) {
          setError("Failed to load announcements.");
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

  // Readers only ever see published items for their audience; staff see all.
  const visible = useMemo(() => {
    if (isStaffAppRole(role)) return items;
    return items.filter(
      (a) => a.published && ((a.audience || []).length === 0 || (a.audience || []).includes(role))
    );
  }, [items, role]);

  const drafts = useMemo(() => items.filter((a) => !a.published), [items]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (item) => {
    setForm({ title: item.title || "", body: item.body || "", audience: item.audience || [] });
    setEditing(item);
    setFormError("");
    setShowForm(true);
  };

  const toggleAudience = (r) => {
    setForm((p) => ({
      ...p,
      audience: p.audience.includes(r) ? p.audience.filter((x) => x !== r) : [...p.audience, r],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.title.trim() || !form.body.trim()) {
      setFormError("Title and body are required.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, userId, form);
        toast("Announcement updated.");
      } else {
        await createAnnouncement(userId, form);
        toast("Announcement drafted. Publish it to notify the audience.");
      }
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      console.error("Error saving announcement:", err);
      setFormError(err.message || "Failed to save the announcement.");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (item, published) => {
    try {
      await setAnnouncementPublished(item.id, userId, published);
      toast(published ? "Announcement published." : "Announcement archived.");
    } catch (err) {
      console.error("Error changing announcement state:", err);
      setFormError(err.message || "Failed to update the announcement.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAnnouncement(pendingDelete.id, userId);
      toast("Announcement deleted.");
    } catch (err) {
      console.error("Error deleting announcement:", err);
      setFormError(err.message || "Failed to delete the announcement.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Announcements"
        description={
          isStaff
            ? "Publish updates to role audiences. Unpublished drafts stay staff-only."
            : "Official updates from the TBI office."
        }
        actions={
          isStaff && (
            <button
              onClick={openCreate}
              className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
            >
              New announcement
            </button>
          )
        }
      />

      {formError && !showForm && (
        <p className="text-red-600 text-sm mb-4" role="alert">
          {formError}
        </p>
      )}

      {loading ? (
        <PageSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          {isStaff && drafts.length > 0 && (
            <section className="mb-8">
              <SectionTitle hint="Only staff can see these.">Drafts ({drafts.length})</SectionTitle>
              <ul className="bg-white border border-line rounded divide-y divide-line">
                {drafts.map((a) => (
                  <li key={a.id} className="p-4 flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{a.title}</span>
                      <span className="block text-xs text-muted">
                        Audience: {(a.audience || []).length === 0 ? "Everyone" : a.audience.join(", ")}
                      </span>
                    </span>
                    <button
                      onClick={() => openEdit(a)}
                      className="px-3 py-1.5 border border-line rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handlePublish(a, true)}
                      className="px-3 py-1.5 bg-primary-color text-white rounded text-xs font-medium hover:bg-primary-deep transition"
                    >
                      Publish
                    </button>
                    {isManager && (
                      <button
                        onClick={() => setPendingDelete(a)}
                        className="px-3 py-1.5 bg-white border border-line text-red-600 rounded text-xs font-medium hover:bg-red-50 transition"
                      >
                        Delete
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <SectionTitle hint={isStaff ? "Published, newest first." : "Newest first."}>
            {isStaff ? "Published" : "Latest updates"}
          </SectionTitle>
          {visible.filter((a) => a.published).length === 0 && (!isStaff || visible.length === 0) ? (
            <EmptyState
              title="No announcements yet"
              description={
                isStaff
                  ? "Draft the first program update above."
                  : "Official TBI updates will appear here."
              }
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {(isStaff ? visible : visible.filter((a) => a.published)).map((a) => (
                <li key={a.id} className="bg-white border border-line rounded p-5">
                  <div className="flex flex-wrap items-start gap-2 mb-1">
                    <h2 className="flex-1 min-w-0 text-lg font-semibold text-slate-900">{a.title}</h2>
                    {isStaff && <StatusBadge status={a.published ? "Published" : "Draft"} tone={a.published ? "green" : "gray"} />}
                  </div>
                  <p className="text-xs text-muted mb-3">
                    {formatDateTimeSafe(toDateSafe(a.publishedAt || a.createdAt))}
                    {(a.audience || []).length > 0 ? ` · To: ${a.audience.join(", ")}` : " · To: Everyone"}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.body}</p>
                  {isStaff && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      <button
                        onClick={() => openEdit(a)}
                        className="px-3 py-1.5 border border-line rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handlePublish(a, !a.published)}
                        className="px-3 py-1.5 border border-line rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                      >
                        {a.published ? "Archive" : "Publish"}
                      </button>
                      {isManager && (
                        <button
                          onClick={() => setPendingDelete(a)}
                          className="px-3 py-1.5 bg-white border border-line text-red-600 rounded text-xs font-medium hover:bg-red-50 transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={editing ? "Edit announcement" : "New announcement"}>
          <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">
              {editing ? "Edit announcement" : "New announcement"}
            </h2>
            <label className="tbi-label" htmlFor="ann-title">
              Title <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="ann-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="tbi-input mb-3"
            />
            <label className="tbi-label" htmlFor="ann-body">
              Body <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <textarea
              id="ann-body"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
              rows="5"
              className="tbi-input mb-3"
            />
            <span className="tbi-label" id="ann-audience-label">
              Audience (none selected = everyone)
            </span>
            <div className="grid grid-cols-2 gap-1 mb-3" role="group" aria-labelledby="ann-audience-label">
              {AUDIENCE_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.audience.includes(r)}
                    onChange={() => toggleAudience(r)}
                    className="accent-teal-700"
                  />
                  {r}
                </label>
              ))}
            </div>
            {formError && (
              <p className="text-red-600 text-[13px] mb-2" role="alert">
                {formError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-slate-100 text-slate-800 rounded text-sm font-medium hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition disabled:opacity-60"
              >
                {saving ? "Saving..." : editing ? "Update" : "Create draft"}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this announcement?"
        description="This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </AppShell>
  );
}

export default Announcements;
