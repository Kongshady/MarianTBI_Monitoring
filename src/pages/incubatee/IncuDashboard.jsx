import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../../config/marian-config";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import AppShell from "../../components/layout/AppShell.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { SectionHeader } from "../../components/ui/PageHeader.jsx";
import { MetricRow } from "../../components/ui/dashboard.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { formatDateSafe, normalizeTaskStatus, toDateSafe } from "../../lib/domain.js";

function IncuDashboard() {
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [groups, setGroups] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activities, setActivities] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "Dashboard";
    let cancelled = false;

    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("You are not signed in.");
          setLoading(false);
          return;
        }
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          setError("User record not found.");
          setLoading(false);
          return;
        }
        const userData = { id: userDoc.id, ...userDoc.data() };
        const fullName = `${userData.name || ""} ${userData.lastname || ""}`.trim();
        if (cancelled) return;
        setUserName(fullName);
        setRole(userData.role || "");

        const safeDocs = async (promise) => {
          try {
            return (await promise).docs.map((d) => ({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error("Dashboard source unavailable:", err);
            return [];
          }
        };

        if (userData.role === "Mentor") {
          const [assignList, sessionList] = await Promise.all([
            safeDocs(getDocs(query(collection(db, "mentorAssignments"), where("mentorId", "==", userData.id)))),
            safeDocs(getDocs(query(collection(db, "mentoringSessions"), where("mentorId", "==", userData.id)))),
          ]);
          if (cancelled) return;
          setAssignments(assignList.filter((a) => !a.endedAt));
          const todayStart = new Date().setHours(0, 0, 0, 0);
          setSessions(
            sessionList
              .filter((s) => (toDateSafe(s.date)?.getTime() || 0) >= todayStart)
              .sort((a, b) => (toDateSafe(a.date)?.getTime() || 0) - (toDateSafe(b.date)?.getTime() || 0))
              .slice(0, 5)
          );
          const groupDocs = await Promise.all(
            assignList
              .filter((a) => !a.endedAt && a.groupId)
              .slice(0, 10)
              .map((a) => safeDocs(getDocs(query(collection(db, "groups"), where("__name__", "==", a.groupId)))))
          );
          if (cancelled) return;
          setGroups(groupDocs.flat());
        } else {
          const [allGroups, allTasks, allRequests, allActivities] = await Promise.all([
            safeDocs(getDocs(collection(db, "groups"))),
            safeDocs(getDocs(collection(db, "workplan"))),
            safeDocs(getDocs(collection(db, "requests"))),
            safeDocs(getDocs(collection(db, "activities"))),
          ]);
          if (cancelled) return;
          const myGroups = allGroups.filter((g) => (g.members || []).some((m) => m.id === userData.id));
          const myGroupIds = new Set(myGroups.map((g) => g.id));
          setGroups(myGroups);
          setTasks(
            allTasks
              .filter(
                (t) =>
                  myGroupIds.has(t.groupId) &&
                  (t.assignedToUid === userData.id || (!t.assignedToUid && t.assignedTo === fullName)) &&
                  normalizeTaskStatus(t.status) !== "Completed"
              )
              .sort((a, b) => (toDateSafe(a.endDate)?.getTime() || Infinity) - (toDateSafe(b.endDate)?.getTime() || Infinity))
          );
          setRequests(
            allRequests.filter((r) => myGroupIds.has(r.groupId) && r.responsibleTeamMember === fullName)
          );
          const todayStart = new Date().setHours(0, 0, 0, 0);
          setActivities(
            allActivities
              .filter((a) => (toDateSafe(a.date)?.getTime() || 0) >= todayStart)
              .sort((a, b) => (toDateSafe(a.date)?.getTime() || 0) - (toDateSafe(b.date)?.getTime() || 0))
              .slice(0, 5)
          );
        }
        if (!cancelled) setLoading(false);
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

  const isMentor = role === "Mentor";
  const firstName = userName?.split(" ")[0] || "there";
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const upcomingTasks = tasks.filter((t) => (toDateSafe(t.endDate)?.getTime() || 0) >= todayStart).length;
  const myRequestCount = requests.length;

  return (
    <AppShell role={role} userName={userName}>
      <header className="mb-6 sm:mb-7">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[26px] lg:text-[30px]">
          Good day, {firstName}.
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          {isMentor
            ? "Your assigned incubatees and upcoming sessions."
            : "Your tasks, requests, and startups at a glance."}
        </p>
      </header>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : isMentor ? (
        <div className="space-y-8">
          <section aria-labelledby="sec-assign">
            <SectionHeader hint="Startups currently under your mentorship." count={assignments.length}>
              <span id="sec-assign">Assigned incubatees</span>
            </SectionHeader>
            <div className="mt-3.5 overflow-hidden rounded-lg border border-line bg-white">
              {assignments.length === 0 ? (
                <EmptyState
                  title="No assignments yet"
                  description="Startups assigned to you will appear here."
                  className="py-6"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {assignments.map((a) => {
                    const g = groups.find((x) => x.id === a.groupId);
                    return (
                      <li key={a.id}>
                        {g ? (
                          <Link
                            to={`/incubatee/view-group/${g.id}`}
                            className="block px-4 py-3 transition-colors hover:bg-surface-hover"
                          >
                            <span className="block text-sm font-medium text-slate-900">{g.name}</span>
                            <span className="block text-xs text-muted">
                              Since {a.startedAt ? formatDateSafe(a.startedAt) : "—"}
                            </span>
                          </Link>
                        ) : (
                          <div className="px-4 py-3">
                            <span className="block text-sm font-medium text-slate-900">{a.groupId}</span>
                            <span className="block text-xs text-muted">
                              Since {a.startedAt ? formatDateSafe(a.startedAt) : "—"}
                            </span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby="sec-sessions">
            <SectionHeader hint="Your next mentoring sessions." count={sessions.length}>
              <span id="sec-sessions">Upcoming sessions</span>
            </SectionHeader>
            <div className="mt-3.5 overflow-hidden rounded-lg border border-line bg-white">
              {sessions.length === 0 ? (
                <EmptyState
                  title="Nothing scheduled"
                  description="Sessions you have been booked for will appear here."
                  className="py-6"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {sessions.map((s) => (
                    <li key={s.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{s.topic}</p>
                      <p className="text-xs text-muted">{s.date ? formatDateSafe(s.date) : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="sec-figures">
            <SectionHeader hint="Your open work and the teams you belong to.">
              <span id="sec-figures">At a glance</span>
            </SectionHeader>
            <MetricRow
              className="mt-3.5"
              items={[
                { label: "Open tasks", value: tasks.length, note: `${upcomingTasks} not yet due` },
                { label: "My startups", value: groups.length },
                { label: "My requests", value: myRequestCount },
                { label: "Upcoming events", value: activities.length },
              ]}
            />
          </section>

          <section aria-labelledby="sec-tasks">
            <SectionHeader hint="Open work assigned to you, soonest due first." count={tasks.length}>
              <span id="sec-tasks">My tasks</span>
            </SectionHeader>
            <div className="mt-3.5 overflow-hidden rounded-lg border border-line bg-white">
              {tasks.length === 0 ? (
                <EmptyState
                  title="Nothing assigned"
                  description="When TBI assigns you a task it will appear here, soonest due first."
                  className="py-6"
                />
              ) : (
                <ul className="divide-y divide-line">
                  {tasks.slice(0, 8).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">
                          {t.taskName}
                        </span>
                        <span className="block text-xs text-muted">
                          Due {t.endDate ? formatDateSafe(t.endDate) : "no date"}
                        </span>
                      </span>
                      <StatusBadge status={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section aria-labelledby="sec-startups">
              <SectionHeader hint="Teams you belong to." count={groups.length}>
                <span id="sec-startups">My startups</span>
              </SectionHeader>
              <div className="mt-3.5 overflow-hidden rounded-lg border border-line bg-white">
                {groups.length === 0 ? (
                  <EmptyState
                    title="No startup yet"
                    description="Once staff place you in a startup team, it appears here."
                    className="py-6"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {groups.map((g) => (
                      <li key={g.id}>
                        <Link
                          to={`/incubatee/view-group/${g.id}`}
                          className="block px-4 py-3 transition-colors hover:bg-surface-hover"
                        >
                          <span className="block text-sm font-medium text-slate-900">{g.name}</span>
                          <span className="block text-xs text-muted">
                            {requests.filter((r) => r.groupId === g.id).length} requests involving you
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="sec-activities">
              <SectionHeader hint="Next 5 scheduled." count={activities.length}>
                <span id="sec-activities">Upcoming activities</span>
              </SectionHeader>
              <div className="mt-3.5 overflow-hidden rounded-lg border border-line bg-white">
                {activities.length === 0 ? (
                  <EmptyState
                    title="Nothing scheduled"
                    description="Upcoming trainings and events will appear here."
                    className="py-6"
                  />
                ) : (
                  <ul className="divide-y divide-line">
                    {activities.map((a) => (
                      <li key={a.id}>
                        <Link
                          to={`/activities/${a.id}`}
                          className="block px-4 py-3 transition-colors hover:bg-surface-hover"
                        >
                          <span className="block truncate text-sm font-medium text-slate-900">
                            {a.title}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {a.date ? formatDateSafe(a.date) : ""}
                            {a.location ? ` · ${a.location}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default IncuDashboard;
