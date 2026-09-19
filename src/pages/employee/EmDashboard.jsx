import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../components/layout/AppShell.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { SectionTitle } from "../../components/ui/PageHeader.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { auth, db } from "../../config/marian-config.js";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { formatDateSafe, normalizeRequestStatus, toDateSafe } from "../../lib/domain.js";
import { isMilestoneOverdue } from "../../lib/domain.js";

const ACTIONABLE_REQUESTS = ["Pending", "Requested"];

function EmDashboard() {
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [groups, setGroups] = useState([]);
  const [requests, setRequests] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Dashboard";
    let cancelled = false;

    const load = async () => {
      try {
        // Role is always revalidated from Firestore — the sessionStorage
        // copy is a display hint only and must never grant access.
        let userData = null;
        const current = auth.currentUser;
        if (current) {
          const userDoc = await getDoc(doc(db, "users", current.uid));
          if (userDoc.exists()) {
            userData = { id: userDoc.id, ...userDoc.data() };
            sessionStorage.setItem("currentUser", JSON.stringify(userData));
          }
        }
        if (!userData) {
          const stored = sessionStorage.getItem("currentUser");
          if (stored) userData = JSON.parse(stored);
        }
        if (!userData) {
          if (!cancelled) {
            setError("You are not signed in.");
            setLoading(false);
          }
          return;
        }
        if (cancelled) return;
        setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());
        setRole(userData.role || "");

        const groupsQuery =
          userData.role === "Portfolio Manager"
            ? query(collection(db, "groups"), where("portfolioManager.id", "==", userData.id))
            : collection(db, "groups");
        const safeDocs = async (promise) => {
          try {
            return (await promise).docs.map((d) => ({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error("Dashboard source unavailable:", err);
            return [];
          }
        };
        const [groupsList, requestsList, milestonesList, activitiesList] = await Promise.all([
          safeDocs(getDocs(groupsQuery)),
          safeDocs(getDocs(collection(db, "requests"))),
          safeDocs(getDocs(collection(db, "milestones"))),
          safeDocs(getDocs(collection(db, "activities"))),
        ]);
        if (cancelled) return;
        setGroups(groupsList);
        setRequests(requestsList);
        setMilestones(milestonesList);
        setActivities(
          activitiesList.sort((a, b) => (toDateSafe(a.date)?.getTime() || 0) - (toDateSafe(b.date)?.getTime() || 0))
        );
        setLoading(false);
      } catch (err) {
        console.error("Error loading dashboard:", err);
        if (!cancelled) {
          setError("We couldn't load the dashboard. Please try again.");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const groupIds = new Set(groups.map((g) => g.id));
  const myRequests = requests.filter((r) => groupIds.has(r.groupId));
  const needsTriage = myRequests.filter((r) => ACTIONABLE_REQUESTS.includes(normalizeRequestStatus(r.status)));
  const myMilestones = milestones.filter((m) => groupIds.has(m.groupId));
  const overdue = myMilestones.filter((m) => isMilestoneOverdue(m, now));
  const upcoming = activities.filter((a) => (toDateSafe(a.date)?.getTime() || 0) >= todayStart).slice(0, 5);
  const openByGroup = {};
  myRequests.forEach((r) => {
    if (ACTIONABLE_REQUESTS.includes(normalizeRequestStatus(r.status))) {
      openByGroup[r.groupId] = (openByGroup[r.groupId] || 0) + 1;
    }
  });

  return (
    <AppShell role={role} userName={userName}>
      <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-slate-900">
        Good day, {userName?.split(" ")[0] || "there"}.
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        Your assigned startups, requests needing triage, and upcoming activities.
      </p>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <SectionTitle hint="Requests waiting on you, and milestones past due.">Needs your attention</SectionTitle>
          <ul className="bg-white border border-line rounded divide-y divide-line mb-8">
            <li className="flex items-center gap-3 px-4 py-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${needsTriage.length > 0 ? "bg-amber-500" : "bg-slate-300"}`} aria-hidden="true" />
              <span className="text-2xl font-semibold text-slate-900 tabular-nums w-10">{needsTriage.length}</span>
              <span className="flex-1 text-sm text-slate-700">Requests awaiting triage in your startups</span>
            </li>
            <li className="flex items-center gap-3 px-4 py-3">
              <span className={`w-2 h-2 rounded-full shrink-0 ${overdue.length > 0 ? "bg-red-500" : "bg-slate-300"}`} aria-hidden="true" />
              <span className="text-2xl font-semibold text-slate-900 tabular-nums w-10">{overdue.length}</span>
              <span className="flex-1 text-sm text-slate-700">Overdue milestones in your startups</span>
            </li>
          </ul>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">My startups ({groups.length})</h2>
              <p className="text-xs text-muted mb-3">Open requests and status per startup.</p>
              {groups.length === 0 ? (
                <EmptyState title="No startups assigned" description="Startups assigned to you will appear here." />
              ) : (
                <ul className="flex flex-col">
                  {[...groups]
                    .sort((a, b) => (openByGroup[b.id] || 0) - (openByGroup[a.id] || 0))
                    .map((g) => (
                      <li key={g.id} className="flex items-center gap-3 py-2 border-b border-line last:border-b-0">
                        <span className="flex-1 min-w-0">
                          <Link to={`/employee/view-group/${g.id}`} className="text-sm font-medium text-slate-900 hover:text-accent">
                            {g.name}
                          </Link>
                          <span className="block text-xs text-muted">
                            {openByGroup[g.id] || 0} open requests
                          </span>
                        </span>
                        <StatusBadge status={g.incubateeStatus || "Active"} />
                      </li>
                    ))}
                </ul>
              )}
            </section>

            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Upcoming activities</h2>
              <p className="text-xs text-muted mb-3">Next 5 scheduled.</p>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted">Nothing scheduled.</p>
              ) : (
                <ul className="flex flex-col">
                  {upcoming.map((a) => (
                    <li key={a.id} className="flex gap-3 py-2 border-b border-line last:border-b-0">
                      <span className="text-center shrink-0 w-11">
                        <span className="block text-[11px] font-semibold uppercase text-muted">
                          {toDateSafe(a.date)?.toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="block text-lg font-semibold text-slate-900 leading-6">
                          {toDateSafe(a.date)?.getDate()}
                        </span>
                      </span>
                      <span>
                        <Link to={`/activities/${a.id}`} className="text-sm font-medium text-slate-900 hover:text-accent">
                          {a.title}
                        </Link>
                        <span className="block text-xs text-muted">
                          {a.type}
                          {a.location ? ` · ${a.location}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {overdue.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-900 mb-1">Overdue milestones</h3>
                  <ul className="flex flex-col">
                    {overdue.slice(0, 8).map((m) => (
                      <li key={m.id} className="py-1.5 border-b border-line last:border-b-0 text-sm">
                        <span className="font-medium text-slate-900">{m.title}</span>
                        <span className="block text-xs text-muted">
                          {groups.find((g) => g.id === m.groupId)?.name || "Startup"} · due{" "}
                          {m.dueDate ? formatDateSafe(m.dueDate) : "no date"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}

export default EmDashboard;
