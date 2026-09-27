import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../components/layout/AppShell.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { SectionHeader } from "../../components/ui/PageHeader.jsx";
import { ActionQueue, MetricRow } from "../../components/ui/dashboard.jsx";
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

  const attention = [
    {
      label: "Requests awaiting triage in your startups",
      count: needsTriage.length,
      to: null,
      tone: "warning",
    },
    {
      label: "Overdue milestones in your startups",
      count: overdue.length,
      to: null,
      tone: "critical",
    },
  ];

  const firstName = userName?.split(" ")[0] || "there";

  return (
    <AppShell role={role} userName={userName}>
      <header className="mb-6 sm:mb-7">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[26px] lg:text-[30px]">
          Good day, {firstName}.
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Your assigned startups, requests needing triage, and upcoming activities.
        </p>
      </header>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="sec-attention">
            <SectionHeader hint="Requests waiting on you, and milestones past due.">
              <span id="sec-attention">Needs your attention</span>
            </SectionHeader>
            <ActionQueue items={attention} className="mt-3.5" />
          </section>

          <section aria-labelledby="sec-portfolio">
            <SectionHeader hint="Your caseload, and the live count of open work behind it.">
              <span id="sec-portfolio">Your portfolio</span>
            </SectionHeader>
            <MetricRow
              className="mt-3.5"
              items={[
                { label: "Assigned startups", value: groups.length },
                { label: "Open requests", value: needsTriage.length },
                { label: "Overdue milestones", value: overdue.length },
                { label: "Milestones tracked", value: myMilestones.length },
              ]}
            />
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section aria-labelledby="sec-startups">
              <SectionHeader
                hint="Sorted by how much open work each startup is carrying."
                count={groups.length}
              >
                <span id="sec-startups">My startups</span>
              </SectionHeader>
              <div className="mt-3.5 overflow-hidden rounded-lg border border-line bg-white">
                {groups.length === 0 ? (
                  <EmptyState
                    title="No startups assigned"
                    description="Startups assigned to you will appear here."
                    className="py-6"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {[...groups]
                      .sort((a, b) => (openByGroup[b.id] || 0) - (openByGroup[a.id] || 0))
                      .map((g) => (
                        <li key={g.id}>
                          <Link
                            to={`/employee/view-group/${g.id}`}
                            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-900">
                                {g.name}
                              </span>
                              <span className="block text-xs text-muted">
                                {openByGroup[g.id] || 0} open{" "}
                                {openByGroup[g.id] === 1 ? "request" : "requests"}
                              </span>
                            </span>
                            <StatusBadge status={g.incubateeStatus || "Active"} />
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="sec-upcoming">
              <SectionHeader hint="Next 5 scheduled.">
                <span id="sec-upcoming">Upcoming activities</span>
              </SectionHeader>
              <div className="mt-3.5">
                {upcoming.length === 0 ? (
                  <div className="rounded-lg border border-line bg-white">
                    <EmptyState
                      title="Nothing scheduled"
                      description="Upcoming trainings and events will appear here."
                      className="py-6"
                    />
                  </div>
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line bg-white">
                    {upcoming.map((a) => (
                      <li key={a.id}>
                        <Link
                          to={`/activities/${a.id}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover"
                        >
                          <span className="w-11 shrink-0 text-center">
                            <span className="block text-[11px] font-semibold uppercase text-muted">
                              {toDateSafe(a.date)?.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="block text-lg leading-6 font-semibold text-slate-900">
                              {toDateSafe(a.date)?.getDate()}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-900">
                              {a.title}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              {a.type}
                              {a.location ? ` · ${a.location}` : ""}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {overdue.length > 0 && (
            <section aria-labelledby="sec-overdue">
              <SectionHeader
                hint="Past their due date. Open the startup to renegotiate or complete."
                count={overdue.length}
              >
                <span id="sec-overdue">Overdue milestones</span>
              </SectionHeader>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
                {overdue.slice(0, 8).map((m) => (
                  <li key={m.id}>
                    <Link
                      to={`/employee/view-group/${m.groupId}`}
                      className="flex items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 transition-colors hover:bg-surface-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {m.title}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {groups.find((g) => g.id === m.groupId)?.name || "Startup"} · due{" "}
                          {m.dueDate ? formatDateSafe(m.dueDate) : "no date"}
                        </span>
                      </span>
                      <span className="shrink-0">
                        <StatusBadge status="Overdue" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

export default EmDashboard;
