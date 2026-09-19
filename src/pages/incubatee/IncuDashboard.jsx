import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../../config/marian-config";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import AppShell from "../../components/layout/AppShell.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import { SectionTitle } from "../../components/ui/PageHeader.jsx";
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

  const firstName = userName?.split(" ")[0] || "there";

  return (
    <AppShell role={role} userName={userName}>
      <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-slate-900">
        Good day, {firstName}.
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">
        {role === "Mentor" ? "Your assigned incubatees and upcoming sessions." : "Your tasks, requests, and startups at a glance."}
      </p>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : role === "Mentor" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="bg-white border border-line rounded p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Assigned incubatees ({assignments.length})</h2>
            <p className="text-xs text-muted mb-3">Startups under your mentorship.</p>
            {assignments.length === 0 ? (
              <EmptyState title="No assignments yet" description="Startups assigned to you will appear here." />
            ) : (
              <ul className="flex flex-col">
                {assignments.map((a) => {
                  const g = groups.find((g) => g.id === a.groupId);
                  return (
                    <li key={a.id} className="py-2 border-b border-line last:border-b-0">
                      {g ? (
                        <Link to={`/incubatee/view-group/${g.id}`} className="text-sm font-medium text-slate-900 hover:text-accent">
                          {g.name}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-slate-900">{a.groupId}</span>
                      )}
                      <span className="block text-xs text-muted">
                        Since {a.startedAt ? formatDateSafe(a.startedAt) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <section className="bg-white border border-line rounded p-4">
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Upcoming sessions</h2>
            <p className="text-xs text-muted mb-3">Your next mentoring sessions.</p>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled.</p>
            ) : (
              <ul className="flex flex-col">
                {sessions.map((s) => (
                  <li key={s.id} className="py-2 border-b border-line last:border-b-0">
                    <p className="text-sm font-medium text-slate-900">{s.topic}</p>
                    <p className="text-xs text-muted">
                      {s.date ? formatDateSafe(s.date) : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <>
          <SectionTitle hint="Open work assigned to you, soonest due first.">My tasks ({tasks.length})</SectionTitle>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted mb-6">Nothing assigned. Enjoy the quiet.</p>
          ) : (
            <ul className="bg-white border border-line rounded divide-y divide-line mb-8">
              {tasks.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900 truncate">{t.taskName}</span>
                    <span className="block text-xs text-muted">
                      Due {t.endDate ? formatDateSafe(t.endDate) : "no date"}
                    </span>
                  </span>
                  <StatusBadge status={t.status} />
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">My startups ({groups.length})</h2>
              <p className="text-xs text-muted mb-3">Teams you belong to.</p>
              {groups.length === 0 ? (
                <EmptyState title="No startup yet" description="Once staff place you in a startup team, it appears here." />
              ) : (
                <ul className="flex flex-col">
                  {groups.map((g) => (
                    <li key={g.id} className="py-2 border-b border-line last:border-b-0">
                      <Link to={`/incubatee/view-group/${g.id}`} className="text-sm font-medium text-slate-900 hover:text-accent">
                        {g.name}
                      </Link>
                      <span className="block text-xs text-muted">
                        {requests.filter((r) => r.groupId === g.id).length} requests involving you
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Upcoming activities</h2>
              <p className="text-xs text-muted mb-3">Next 5 scheduled.</p>
              {activities.length === 0 ? (
                <p className="text-sm text-muted">Nothing scheduled.</p>
              ) : (
                <ul className="flex flex-col">
                  {activities.map((a) => (
                    <li key={a.id} className="py-2 border-b border-line last:border-b-0">
                      <Link to={`/activities/${a.id}`} className="text-sm font-medium text-slate-900 hover:text-accent">
                        {a.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        {a.date ? formatDateSafe(a.date) : ""}
                        {a.location ? ` · ${a.location}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}

export default IncuDashboard;
