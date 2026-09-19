import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IoMdNotifications } from "react-icons/io";
import {
  isNotificationRead,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationUrl,
  subscribeNotifications,
} from "../../lib/notifications.js";
import { formatDateTimeSafe, getNotificationTime } from "../../lib/domain.js";
import NotificationText from "../NotificationText.jsx";

// Header bell: unread badge plus a dropdown of the latest notifications.
// Full management lives on the Notifications page; the bell is a preview.
function NotificationBell({ userId, role, pagePath }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }
    return subscribeNotifications(userId, setItems, () => {});
  }, [userId]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const unread = items.filter((n) => !isNotificationRead(n)).length;
  const preview = [...items]
    .sort((a, b) => Number(isNotificationRead(a)) - Number(isNotificationRead(b)))
    .slice(0, 8);

  const openItem = async (n) => {
    setOpen(false);
    if (!isNotificationRead(n)) {
      try {
        await markNotificationRead(n.id);
      } catch {
        // Read state is best-effort; navigation still proceeds.
      }
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded text-slate-600 hover:bg-slate-100"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <IoMdNotifications className="text-xl" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-semibold inline-flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[min(92vw,360px)] bg-white border border-line rounded shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => markAllNotificationsRead(items).catch(() => {})}
                className="text-xs font-medium text-accent hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>
          {preview.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted text-center">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-line">
              {preview.map((n) => {
                const to = resolveNotificationUrl(n, role);
                const body = (
                  <span className="block">
                    {n.title && <span className="block text-[13px] font-semibold text-slate-900">{n.title}</span>}
                    <NotificationText message={n.message} className="text-[13px] text-slate-700 leading-snug" />
                    <span className="block text-xs text-muted mt-0.5">{formatDateTimeSafe(getNotificationTime(n))}</span>
                  </span>
                );
                return (
                  <li key={n.id} className={!isNotificationRead(n) ? "bg-accent/5" : undefined}>
                    {to ? (
                      <Link to={to} onClick={() => openItem(n)} className="block px-4 py-2.5 hover:bg-slate-50">
                        {body}
                      </Link>
                    ) : (
                      <button onClick={() => openItem(n)} className="block w-full text-left px-4 py-2.5 hover:bg-slate-50">
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            to={pagePath}
            onClick={() => setOpen(false)}
            className="block text-center text-[13px] font-medium text-accent hover:underline px-4 py-2.5 border-t border-line"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
