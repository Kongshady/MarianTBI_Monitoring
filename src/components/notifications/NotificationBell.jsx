import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { IoMdNotifications } from "react-icons/io";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.jsx";
import { Button } from "../ui/button.jsx";
import {
  isNotificationRead,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationUrl,
  subscribeNotifications,
} from "../../lib/notifications.js";
import { formatDateTimeSafe, getNotificationTime } from "../../lib/domain.js";
import NotificationText from "../NotificationText.jsx";
import { cn } from "../../lib/utils.js";

// Header bell: unread badge plus a preview of the latest notifications.
// Full management lives on the Notifications page.
//
// Now backed by Radix Popover, which replaces the previous hand-rolled
// click-outside/Escape listeners with real focus management, focus return
// on close, and viewport collision handling.
function NotificationBell({ userId, role, pagePath }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) {
      setItems([]);
      return undefined;
    }
    return subscribeNotifications(userId, setItems, () => {});
  }, [userId]);

  const unread = items.filter((n) => !isNotificationRead(n)).length;
  // Unread first, then most recent — matching how the page sorts.
  const preview = [...items]
    .sort(
      (a, b) =>
        Number(isNotificationRead(a)) - Number(isNotificationRead(b)) ||
        (getNotificationTime(b)?.getTime() || 0) - (getNotificationTime(a)?.getTime() || 0)
    )
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <IoMdNotifications className="text-xl" aria-hidden="true" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-semibold text-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,360px)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAllNotificationsRead(items).catch(() => {})}
              className="rounded text-xs font-medium text-accent hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {preview.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            You&apos;re all caught up.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {preview.map((n) => {
              const to = resolveNotificationUrl(n, role);
              const read = isNotificationRead(n);
              const body = (
                <>
                  {n.title && (
                    <span className="block text-[13px] font-semibold text-slate-900">
                      {n.title}
                    </span>
                  )}
                  <NotificationText
                    message={n.message}
                    className="text-[13px] leading-snug text-slate-700"
                  />
                  <span className="mt-0.5 block text-xs text-muted">
                    {formatDateTimeSafe(getNotificationTime(n))}
                  </span>
                </>
              );
              return (
                <li
                  key={n.id}
                  className={cn(!read && "bg-accent/6", "relative")}
                >
                  {/* Unread is signalled by a rail + weight, not colour
                      alone, so it survives greyscale and CVD. */}
                  {!read && (
                    <span
                      className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full bg-accent"
                      aria-hidden="true"
                    />
                  )}
                  {to ? (
                    <Link
                      to={to}
                      onClick={() => openItem(n)}
                      className="block py-2.5 pr-4 pl-4 transition-colors hover:bg-surface-hover"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      onClick={() => openItem(n)}
                      className="block w-full py-2.5 pr-4 pl-4 text-left transition-colors hover:bg-surface-hover"
                    >
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
          className="block border-t border-line px-4 py-2.5 text-center text-[13px] font-medium text-accent hover:bg-surface-hover"
        >
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
