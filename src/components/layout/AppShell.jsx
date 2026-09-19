import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import { FiMenu, FiSearch, FiX, FiLogOut, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import MarianLogo from "../../assets/images/MarianLogoWtext.png";
import Avatar from "../ui/Avatar.jsx";
import NotificationBell from "../notifications/NotificationBell.jsx";
import { Toasts } from "../ui/Toast.jsx";
import { navSections, notificationsPath, profilePath } from "./nav.js";
import { isStaffAppRole } from "../../lib/permissions.js";
import { getRoleFamily } from "../../lib/permissions.js";

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

function GlobalSearch({ role, userId, onNavigate }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const q = term.trim().toLowerCase();
    if (q.length < 2 || !userId) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const staff = isStaffAppRole(role) || role === "Management";
        const matches = (text) => (text || "").toLowerCase().includes(q);
        const out = [];

        const appSnaps = staff
          ? await getDocs(query(collection(db, "applications"), limit(30)))
          : await getDocs(query(collection(db, "applications"), where("applicantId", "==", userId), limit(30)));
        appSnaps.forEach((d) => {
          const a = d.data();
          if (matches(a.enterpriseName) || matches(a.description)) {
            out.push({ kind: "Application", title: a.enterpriseName || "Untitled application", sub: a.status, to: `/applications/${d.id}` });
          }
        });

        const groupSnap = await getDocs(query(collection(db, "groups"), limit(60)));
        groupSnap.forEach((d) => {
          const g = d.data();
          const mine = staff || (g.members || []).some((m) => m.id === userId) || g.portfolioManager?.id === userId;
          if (mine && (matches(g.name) || matches(g.description))) {
            const base = role === "Portfolio Manager" ? "/employee/view-group" : isStaffAppRole(role) || role === "Management" ? "/admin/view-group" : "/incubatee/view-group";
            out.push({ kind: "Startup", title: g.name, sub: g.incubateeStatus || "Active", to: `${base}/${d.id}` });
          }
        });

        const progSnap = await getDocs(query(collection(db, "programs"), limit(20)));
        progSnap.forEach((d) => {
          const p = d.data();
          if (matches(p.name)) out.push({ kind: "Program", title: p.name, sub: p.status, to: `/programs/${d.id}` });
        });

        const actSnap = await getDocs(query(collection(db, "activities"), limit(20)));
        actSnap.forEach((d) => {
          const a = d.data();
          if (matches(a.title)) out.push({ kind: "Activity", title: a.title, sub: a.type, to: `/activities/${d.id}` });
        });

        setResults(out.slice(0, 12));
        setOpen(true);
      } catch {
        setResults([]);
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [term, role, userId]);

  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search applications, startups, programs..."
        aria-label="Global search"
        className="w-full pl-9 pr-8 py-2 border border-line rounded bg-white text-sm placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      {term && (
        <button
          onClick={() => {
            setTerm("");
            setOpen(false);
          }}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <FiX />
        </button>
      )}
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-line rounded shadow-lg max-h-80 overflow-y-auto z-50">
          {searching ? (
            <p className="p-3 text-sm text-muted">Searching...</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted">No matches. Try at least 2 characters.</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={`${r.to}-${i}`}>
                  <Link
                    to={r.to}
                    onClick={() => {
                      setOpen(false);
                      setTerm("");
                      onNavigate && onNavigate();
                    }}
                    className="block px-3 py-2 hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-900">{r.title}</p>
                    <p className="text-xs text-muted">
                      {r.kind}
                      {r.sub ? ` · ${r.sub}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function SidebarBody({ role, userName, collapsed, onNavigate, badges, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      <Link to="/" onClick={onNavigate} className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/10">
        <img src={MarianLogo} alt="Marian TBI" className="w-9 h-9 bg-white rounded object-contain p-0.5 shrink-0" />
        {!collapsed && (
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-wide text-white">MARIAN TBI</span>
            <span className="block text-[11px] tracking-[0.2em] text-slate-300">PMIS</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto py-4" aria-label="Primary">
        {navSections(role).map((section) => (
          <div key={section.label} className="mb-5">
            {!collapsed && (
              <p className="px-5 mb-1.5 text-[11px] font-semibold tracking-[0.14em] text-slate-400">{section.label}</p>
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => (
                <li key={item.key}>
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                        isActive
                          ? "bg-white/10 text-white font-medium"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      } ${collapsed ? "justify-center" : ""}`
                    }
                  >
                    <item.icon className="text-lg shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && item.badge && badges[item.badge] > 0 && (
                      <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-semibold inline-flex items-center justify-center">
                        {badges[item.badge]}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
          <Avatar name={userName} size="md" />
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{userName || "User"}</p>
              <p className="text-xs text-slate-300 truncate">{role || ""}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={onLogout}
              title="Log out"
              aria-label="Log out"
              className="p-2 rounded text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              <FiLogOut />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Application shell: grouped role-based sidebar, lightweight header with
// working global search, and a calm content column. Replaces the three
// legacy hover-expand sidebars page by page.
function AppShell({ role, userName, children }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("tbi-shell-collapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  const userId = auth.currentUser?.uid;
  const badges = useUnreadCounts(userId);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
    <div className="min-h-screen bg-surface" data-tbi-family={getRoleFamily(role)}>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 bg-primary-color z-30 transition-[width] duration-200"
        style={{ width }}
        aria-label="Application navigation"
      >
        <div className="flex-1 min-h-0">
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
          className="m-2 p-2 rounded text-slate-300 hover:bg-white/10 hover:text-white transition self-center"
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-primary-color">
            <SidebarBody
              role={role}
              userName={userName}
              collapsed={false}
              badges={badges}
              onNavigate={() => setMobileOpen(false)}
              onLogout={handleLogout}
            />
          </aside>
        </div>
      )}

      <div className="min-h-screen flex flex-col" style={isDesktop ? { marginLeft: width } : undefined}>
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-line">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16 max-w-[1200px] mx-auto w-full">
            <button
              className="lg:hidden p-2 -ml-2 rounded text-slate-600 hover:bg-slate-100"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <FiMenu className="text-xl" />
            </button>
            <GlobalSearch role={role} userId={userId} />
            <div className="flex-1" />
            <NotificationBell userId={userId} role={role} pagePath={notificationsPath(role)} />
            <span className="hidden sm:flex items-center gap-2 pl-1">
              <Avatar name={userName} size="sm" />
              <span className="text-left leading-tight">
                <Link to={profilePath(role)} className="block text-[13px] font-medium text-slate-900 max-w-[140px] truncate hover:text-accent">
                  {userName || "User"}
                </Link>
                <span className="block text-[11px] text-muted">{role || ""}</span>
              </span>
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      </div>
      <Toasts />
    </div>
  );
}

export default AppShell;
