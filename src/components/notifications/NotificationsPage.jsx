import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { doc, getDoc } from "firebase/firestore";
import { IoMdNotifications } from "react-icons/io";
import { IoChatbox } from "react-icons/io5";
import { MdAssignment, MdCampaign, MdGroups, MdManageAccounts, MdVpnKey } from "react-icons/md";
import AppShell from "../layout/AppShell.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import Tabs from "../ui/Tabs.jsx";
import { EmptyState, PageSkeleton } from "../ui/states.jsx";
import NotificationText from "../NotificationText.jsx";
import { BUCKET_LABELS, NOTIFICATION_BUCKETS, bucketForType, normalizeNotificationType } from "../../lib/notificationCatalog.js";
import {
  clearReadNotifications,
  deleteNotification,
  getNotificationPrefs,
  isNotificationRead,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationUrl,
  setCategoryMuted,
  subscribeNotifications,
} from "../../lib/notifications.js";
import { formatDateTimeSafe, getNotificationTime } from "../../lib/domain.js";
import { toast } from "../../lib/toast.js";

const FILTERS = ["all", "unread", NOTIFICATION_BUCKETS.ACTION, NOTIFICATION_BUCKETS.UPDATE, NOTIFICATION_BUCKETS.REMINDER];

const FILTER_LABELS = Object.freeze({
  all: "All",
  unread: "Unread",
  [NOTIFICATION_BUCKETS.ACTION]: BUCKET_LABELS[NOTIFICATION_BUCKETS.ACTION],
  [NOTIFICATION_BUCKETS.UPDATE]: BUCKET_LABELS[NOTIFICATION_BUCKETS.UPDATE],
  [NOTIFICATION_BUCKETS.REMINDER]: BUCKET_LABELS[NOTIFICATION_BUCKETS.REMINDER],
});

const BUCKET_STYLES = Object.freeze({
  [NOTIFICATION_BUCKETS.ACTION]: "bg-red-50 text-red-700 border-red-200",
  [NOTIFICATION_BUCKETS.UPDATE]: "bg-slate-100 text-slate-600 border-line",
  [NOTIFICATION_BUCKETS.REMINDER]: "bg-violet-50 text-violet-700 border-violet-200",
});

function iconFor(n) {
  const cls = "text-xl shrink-0";
  switch (n.relatedType) {
    case "application":
      return <MdAssignment className={`${cls} text-accent`} aria-hidden="true" />;
    case "group":
      return <MdGroups className={`${cls} text-accent`} aria-hidden="true" />;
    case "announcement":
      return <MdCampaign className={`${cls} text-teal-600`} aria-hidden="true" />;
    case "user":
      return <MdManageAccounts className={`${cls} text-violet-600`} aria-hidden="true" />;
    case "message":
      return <IoChatbox className={`${cls} text-accent`} aria-hidden="true" />;
    case "role":
      return <MdVpnKey className={`${cls} text-violet-600`} aria-hidden="true" />;
    default:
      return <IoMdNotifications className={`${cls} text-slate-400`} aria-hidden="true" />;
  }
}

// Shared notifications experience for every role: filterable list,
// deep links to the related record, read-state management, and per-person
// preferences. Thin role wrappers keep the existing routes working.
function NotificationsPage({ role: roleProp, userName: nameProp }) {
  const [role, setRole] = useState(roleProp || "");
  const [userName, setUserName] = useState(nameProp || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [prefs, setPrefs] = useState({ mutedCategories: [], mutedTypes: [] });
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Notifications";
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setLoading(false);
      return;
    }
    getDoc(doc(db, "users", uid))
      .then((snap) => {
        if (snap.exists()) {
          setRole((r) => r || snap.data().role || "");
          setUserName((n) => n || `${snap.data().name || ""} ${snap.data().lastname || ""}`.trim());
        }
      })
      .catch(() => {});
    getNotificationPrefs(uid).then(setPrefs).catch(() => {});
    return subscribeNotifications(uid, (list) => {
      setItems(list);
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c = { all: items.length, unread: 0, [NOTIFICATION_BUCKETS.ACTION]: 0, [NOTIFICATION_BUCKETS.UPDATE]: 0, [NOTIFICATION_BUCKETS.REMINDER]: 0 };
    items.forEach((n) => {
      if (!isNotificationRead(n)) c.unread += 1;
      const b = n.category || bucketForType(n.type);
      if (c[b] !== undefined) c[b] += 1;
    });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((n) => !isNotificationRead(n));
    return items.filter((n) => (n.category || bucketForType(n.type)) === filter);
  }, [items, filter]);

  const openItem = async (n) => {
    setNotice("");
    if (!isNotificationRead(n)) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // Best-effort; navigation still proceeds.
      }
    }
    const to = resolveNotificationUrl(n, role);
    if (to) navigate(to);
    else setNotice("This notification has no linked page to open.");
  };

  const removeItem = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
    } catch {
      toast("Failed to remove the notification.", "error");
    }
  };

  const toggleMute = async (bucket) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const muted = !(prefs.mutedCategories || []).includes(bucket);
    try {
      await setCategoryMuted(uid, bucket, muted);
      setPrefs((p) => ({
        ...p,
        mutedCategories: muted
          ? [...(p.mutedCategories || []), bucket]
          : (p.mutedCategories || []).filter((c) => c !== bucket),
      }));
      toast(muted ? `${BUCKET_LABELS[bucket]} muted.` : `${BUCKET_LABELS[bucket]} unmuted.`);
    } catch {
      toast("Failed to save preferences.", "error");
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Notifications"
        description="Workflow updates scoped to your responsibilities. Conversations stay under Messages."
        actions={
          <>
            <button
              onClick={() => markAllNotificationsRead(items).catch(() => toast("Failed to update.", "error"))}
              className="px-4 py-2 bg-white border border-line text-slate-700 rounded text-[13px] font-medium hover:bg-slate-50 transition"
            >
              Mark all as read
            </button>
            <button
              onClick={() =>
                clearReadNotifications(items)
                  .then((n) => n > 0 && toast(`${n} read notification${n === 1 ? "" : "s"} cleared.`))
                  .catch(() => toast("Failed to clear.", "error"))
              }
              className="px-4 py-2 bg-white border border-line text-slate-700 rounded text-[13px] font-medium hover:bg-slate-50 transition"
            >
              Clear read
            </button>
          </>
        }
      />
      {notice && (
        <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
          {notice}
        </p>
      )}
      {loading ? (
        <PageSkeleton rows={5} />
      ) : (
        <>
          <Tabs
            tabs={FILTERS.map((f) => ({ key: f, label: FILTER_LABELS[f], count: counts[f] }))}
            active={filter}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <EmptyState
              title={filter === "unread" ? "Nothing unread" : filter === "all" ? "You're all caught up" : `No ${FILTER_LABELS[filter].toLowerCase()}`}
              description="New updates scoped to your work will appear here."
            />
          ) : (
            <ul className="bg-white border border-line rounded divide-y divide-line">
              {visible.map((n) => {
                const bucket = n.category || bucketForType(n.type);
                const unread = !isNotificationRead(n);
                return (
                  <li key={n.id}>
                    <div
                      onClick={() => openItem(n)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openItem(n);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`p-4 flex gap-3 items-start cursor-pointer hover:bg-slate-50 transition ${unread ? "" : "opacity-70"}`}
                    >
                      <span className="mt-0.5 flex flex-col items-center gap-1.5">
                        {iconFor(n)}
                        {unread && <span className="w-2 h-2 rounded-full bg-accent" aria-label="Unread" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        {n.title && <span className="block text-sm font-semibold text-slate-900">{n.title}</span>}
                        <NotificationText message={n.message} className="text-sm text-slate-700" />
                        <span className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted">{formatDateTimeSafe(getNotificationTime(n))}</span>
                          <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${BUCKET_STYLES[bucket]}`} title={normalizeNotificationType(n.type)}>
                            {BUCKET_LABELS[bucket]}
                          </span>
                        </span>
                      </span>
                      <button
                        onClick={(e) => removeItem(e, n.id)}
                        className="text-xs font-medium text-slate-400 hover:text-red-600 px-1 shrink-0"
                        aria-label="Remove notification"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <section aria-label="Notification preferences" className="mt-6 bg-white border border-line rounded p-4">
            <h2 className="text-sm font-semibold text-slate-900">Preferences</h2>
            <p className="text-[13px] text-muted mt-0.5 mb-3">
              Muted kinds stop arriving. Approval, assignment, and security items stay scoped to your role either way.
            </p>
            <div className="flex flex-col gap-2">
              {[NOTIFICATION_BUCKETS.ACTION, NOTIFICATION_BUCKETS.UPDATE, NOTIFICATION_BUCKETS.REMINDER].map((bucket) => {
                const muted = (prefs.mutedCategories || []).includes(bucket);
                return (
                  <label key={bucket} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!muted}
                      onChange={() => toggleMute(bucket)}
                      className="accent-primary-color"
                    />
                    {BUCKET_LABELS[bucket]}
                  </label>
                );
              })}
            </div>
          </section>
        </>
      )}
    </AppShell>
  );
}

export default NotificationsPage;
