import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import { FiMenu, FiSearch, FiX, FiLogOut, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MarianLogo from "../../assets/images/MarianLogoWtext.png";
import Avatar from "../ui/Avatar.jsx";
import NotificationBell from "../notifications/NotificationBell.jsx";
import { Toasts } from "../ui/Toast.jsx";
import { Button } from "../ui/button.jsx";
import { Sheet, SheetContent, SheetTitle } from "../ui/sheet.jsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.jsx";
import { navSections, notificationsPath, profilePath } from "./nav.js";
import { getRoleFamily, isStaffAppRole } from "../../lib/permissions.js";
import { cn } from "../../lib/utils.js";

const EXPANDED = 264;
const COLLAPSED = 76;

function useUnreadCounts(userId) {
  const [notifications, setNotifications] = useState(0);
  const [messages, setMessages] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const unsubs = [
      onSnapshot(
        query(collection(db, "notifications"), where("userId", "==", userId), where("read", "==", false)),
        (snap) => setNotifications(snap.size),
        () => {}
      ),
      onSnapshot(
        query(collection(db, "messages"), where("receiverId", "==", userId), where("seen", "==", false)),
        (snap) => setMessages(snap.size),
        () => {}
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [userId]);

  return { notifications, messages };
}

// Runs the role-scoped search. Shared by the inline desktop field and the
// mobile Sheet so both surfaces return identical results.
//
// NOTE: the role gate below is load-bearing. Staff search spans all
// applications; everyone else is scoped to their own records. It uses the
// same isStaffAppRole() helper as the rest of the app and must not be
// inlined into a literal role list.
function useGlobalSearch({ role, userId, enabled }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const staff = isStaffAppRole(role) || role === "Management";

  useEffect(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2 || !userId || !enabled) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const matches = (text) => (text || "").toLowerCase().includes(q);
        const out = [];

        const appSnaps = staff
          ? await getDocs(query(collection(db, "applications"), limit(30)))
          : await getDocs(
              query(collection(db, "applications"), where("applicantId", "==", userId), limit(30))
            );
        appSnaps.forEach((d) => {
          const a = d.data();
          if (matches(a.enterpriseName) || matches(a.description)) {
            out.push({
              kind: "Application",
              title: a.enterpriseName || "Untitled application",
              sub: a.status,
              to: `/applications/${d.id}`,
            });
          }
        });

        const groupSnap = await getDocs(query(collection(db, "groups"), limit(60)));
        groupSnap.forEach((d) => {
          const g = d.data();
          const mine =
            staff ||
            (g.members || []).some((m) => m.id === userId) ||
            g.portfolioManager?.id === userId;
          if (mine && (matches(g.name) || matches(g.description))) {
            const base =
              role === "Portfolio Manager"
                ? "/employee/view-group"
                : staff
                ? "/admin/view-group"
                : "/incubatee/view-group";
            out.push({
              kind: "Startup",
              title: g.name,
              sub: g.incubateeStatus || "Active",
              to: `${base}/${d.id}`,
            });
          }
        });

        const progSnap = await getDocs(query(collection(db, "programs"), limit(20)));
        progSnap.forEach((d) => {
          const p = d.data();
          if (matches(p.name)) {
            out.push({ kind: "Program", title: p.name, sub: p.status, to: `/programs/${d.id}` });
          }
        });

        const actSnap = await getDocs(query(collection(db, "activities"), limit(20)));
        actSnap.forEach((d) => {
          const a = d.data();
          if (matches(a.title)) {
            out.push({ kind: "Activity", title: a.title, sub: a.type, to: `/activities/${d.id}` });
          }
        });

        setResults(out.slice(0, 12));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [term, role, userId, staff, enabled]);

  return { term, setTerm, results, searching };
}

function SearchResults({ results, searching, term, onNavigate }) {
  if (term.trim().length < 2) {
    return <p className="p-3 text-sm text-muted">Type at least 2 characters to search.</p>;
  }
  if (searching) return <p className="p-3 text-sm text-muted">Searching…</p>;
  if (results.length === 0) {
    return <p className="p-3 text-sm text-muted">No matches. Try a different term.</p>;
  }
  return (
    <ul className="py-1">
      {results.map((r, i) => (
        <li key={`${r.to}-${i}`}>
          <Link
            to={r.to}
            onClick={onNavigate}
            className="block px-3 py-2 transition-colors hover:bg-surface-hover"
          >
            <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
            <p className="truncate text-xs text-muted">
              {r.kind}
              {r.sub ? ` · ${r.sub}` : ""}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Desktop / tablet: always-visible inline field.
function GlobalSearch({ role, userId, onNavigate }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const { term, setTerm, results, searching } = useGlobalSearch({ role, userId });

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

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <FiSearch
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search applications, startups, programs…"
        aria-label="Global search"
        className="h-9 w-full rounded-md border border-line bg-white py-2 pr-8 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {term && (
        <button
          onClick={() => {
            setTerm("");
            setOpen(false);
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:text-slate-700"
        >
          <FiX aria-hidden="true" />
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-line bg-popover shadow-popover">
          <SearchResults
            results={results}
            searching={searching}
            term={term}
            onNavigate={() => {
              setOpen(false);
              setTerm("");
              onNavigate?.();
            }}
          />
        </div>
      )}
    </div>
  );
}

// Mobile: the field moves into a top Sheet so it gets the full viewport
// width instead of truncating to "Search applications, star" in a 390px
// header.
function MobileSearch({ role, userId, open, onOpenChange }) {
  const { term, setTerm, results, searching } = useGlobalSearch({ role, userId, enabled: open });

  useEffect(() => {
    if (!open) setTerm("");
  }, [open, setTerm]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="top" className="bg-white text-slate-900">
        <SheetTitle className="sr-only">Search</SheetTitle>
        <div className="p-4">
          <div className="relative">
            <FiSearch
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="search"
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search applications, startups, programs…"
              aria-label="Global search"
              className="h-10 w-full rounded-md border border-line bg-white py-2 pr-3 pl-9 text-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto">
            <SearchResults
              results={results}
              searching={searching}
              term={term}
              onNavigate={() => onOpenChange(false)}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function NavItem({ item, collapsed, badges, onNavigate }) {
  const badge = item.badge ? badges[item.badge] : 0;

  const link = (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      aria-current={undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-md py-2 pr-3 pl-3 text-sm transition-colors",
          isActive
            ? "bg-accent/18 font-medium text-white"
            : "text-slate-300 hover:bg-white/8 hover:text-white",
          collapsed && "justify-center px-0"
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Accent rail: the role colour is legible in the navigation even
              when every count on the dashboard happens to be zero. */}
          <span
            className={cn(
              "absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-r-full transition-colors",
              isActive ? "bg-accent" : "bg-transparent"
            )}
            aria-hidden="true"
          />
          <item.icon className="shrink-0 text-[19px]" aria-hidden="true" />
          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!collapsed && badge > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white tabular-nums">
              {badge}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </>
      )}
    </NavLink>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function SidebarBody({ role, userName, collapsed, onNavigate, badges, onLogout }) {
  const sections = useMemo(() => navSections(role), [role]);

  return (
    <div className="flex h-full flex-col">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-4"
      >
        <img
          src={MarianLogo}
          alt=""
          className="h-9 w-9 shrink-0 rounded bg-white object-contain p-0.5"
        />
        {!collapsed && (
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-wide text-white">
              MARIAN TBI
            </span>
            <span className="block text-[11px] tracking-[0.2em] text-slate-400">PMIS</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto py-4" aria-label="Primary">
        {sections.map((section) => (
          <div key={section.label} className="mb-5 last:mb-0">
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => (
                <li key={item.key}>
                  <NavItem
                    item={item}
                    collapsed={collapsed}
                    badges={badges}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            "flex items-center gap-3",
            collapsed ? "justify-center" : ""
          )}
        >
          <Avatar name={userName} size="md" />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {userName || "User"}
                </p>
                <p className="truncate text-xs text-slate-400">{role || ""}</p>
              </div>
              <button
                onClick={onLogout}
                aria-label="Log out"
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <FiLogOut aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Application shell: grouped role-based sidebar, lightweight header with
// working global search, and a calm content column.
function AppShell({ role, userName, children }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("tbi-shell-collapsed") === "1"
  );
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.innerWidth >= 1024
  );
  const userId = auth.currentUser?.uid;
  const badges = useUnreadCounts(userId);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Radix renders popovers, sheets, dialogs and tooltips into a portal on
  // <body>, which sits *outside* the [data-tbi-family] wrapper. Without
  // mirroring the attribute onto <html>, every portaled surface would fall
  // back to the default teal accent and a TBI Manager would see teal
  // dialogs. Mirrored here, and removed on unmount so public pages
  // (landing, login) revert to the neutral default.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-tbi-family", getRoleFamily(role));
    return () => root.removeAttribute("data-tbi-family");
  }, [role]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem("currentUser");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem("tbi-shell-collapsed", prev ? "0" : "1");
      return !prev;
    });
  };

  const width = collapsed ? COLLAPSED : EXPANDED;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-surface" data-tbi-family={getRoleFamily(role)}>
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden flex-col bg-primary transition-[width] duration-200 lg:flex"
        style={{ width }}
        aria-label="Application navigation"
      >
        <div className="min-h-0 flex-1">
          <SidebarBody
            role={role}
            userName={userName}
            collapsed={collapsed}
            badges={badges}
            onLogout={handleLogout}
          />
        </div>
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className="m-2 self-center rounded-md p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <FiChevronRight aria-hidden="true" /> : <FiChevronLeft aria-hidden="true" />}
        </button>
      </aside>

      {/* Mobile navigation — Radix Sheet supplies the focus trap, Escape
          handling and body-scroll lock the old overlay lacked. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" hideClose={false} aria-label="Navigation">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody
            role={role}
            userName={userName}
            collapsed={false}
            badges={badges}
            onNavigate={() => setNavOpen(false)}
            onLogout={handleLogout}
          />
        </SheetContent>
      </Sheet>

      <MobileSearch
        role={role}
        userId={userId}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />

      <div
        className="flex min-h-screen flex-col"
        style={isDesktop ? { marginLeft: width } : undefined}
      >
        <header className="sticky top-0 z-20 border-b border-line bg-white/92 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-2 px-4 sm:h-16 sm:gap-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
            >
              <FiMenu className="text-xl" aria-hidden="true" />
            </Button>

            {/* Mobile: search lives behind an icon so the header is not
                dominated by a truncated input on narrow viewports. */}
            <div className="sm:hidden">
              <Button variant="ghost" size="icon" aria-label="Open search" onClick={() => setSearchOpen(true)}>
                <FiSearch className="text-lg" aria-hidden="true" />
              </Button>
            </div>

            <div className="hidden min-w-0 flex-1 sm:block">
              <GlobalSearch role={role} userId={userId} />
            </div>

            <div className="flex-1 sm:hidden" />

            <NotificationBell userId={userId} role={role} pagePath={notificationsPath(role)} />

            <span className="hidden items-center gap-2 border-l border-line pl-3 sm:flex">
              <Avatar name={userName} size="sm" />
              <span className="text-left leading-tight">
                <Link
                  to={profilePath(role)}
                  className="block max-w-[140px] truncate text-[13px] font-medium text-slate-900 hover:text-accent"
                >
                  {userName || "User"}
                </Link>
                <span className="block text-[11px] text-muted">{role || ""}</span>
              </span>
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
      <Toasts />
      </div>
    </TooltipProvider>
  );
}

export default AppShell;
