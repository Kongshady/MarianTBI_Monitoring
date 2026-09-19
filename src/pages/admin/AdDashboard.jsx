import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "firebase/auth";
import AppShell from "../../components/layout/AppShell.jsx";
import { SectionTitle } from "../../components/ui/PageHeader.jsx";
import { EmptyState, ErrorState, PageSkeleton } from "../../components/ui/states.jsx";
import { db } from "../../config/marian-config.js";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { APPLICATION_STATUS, INCUBATEE_STATUS, REPORT_STATUS, formatDateSafe, toDateSafe } from "../../lib/domain.js";
import { isMilestoneOverdue } from "../../lib/domain.js";
import { subscribeToAllApplications } from "../../lib/applications.js";
import { subscribeToPendingDocuments } from "../../lib/documents.js";

const REVIEW_APPLICATIONS = [
  APPLICATION_STATUS.SUBMITTED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.FOR_EVALUATION,
];

const REVIEW_REPORTS = [REPORT_STATUS.SUBMITTED, REPORT_STATUS.UNDER_REVIEW];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function AdDashboard() {
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [apps, setApps] = useState([]);
  const [groups, setGroups] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [reports, setReports] = useState([]);
  const [activities, setActivities] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [pendingUsers, setPendingUsers] = useState(0);
  const [pendingDocs, setPendingDocs] = useState([]);

  useEffect(() => {
    document.title = "Dashboard";
    let cancelled = false;

    const unsubApps = subscribeToAllApplications((list) => {
      if (!cancelled) setApps(list);
    });

    const unsubDocs = subscribeToPendingDocuments((list) => {
      if (!cancelled) setPendingDocs(list);
    });

    const load = async () => {
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (!cancelled && userDoc.exists()) {
            const userData = userDoc.data();
            setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());
            setRole(userData.role || "");
          }
        }

        // Each source degrades independently: a denied/unavailable collection
        // (e.g. role-scoped reads) must not blank the whole dashboard.
        const safeDocs = async (promise) => {
          try {
            const snap = await promise;
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          } catch (err) {
            console.error("Dashboard source unavailable:", err);
            return [];
          }
        };

        const [groupsList, milestonesList, activitiesList, outcomesList, reportsList] = await Promise.all([
          safeDocs(getDocs(collection(db, "groups"))),
          safeDocs(getDocs(collection(db, "milestones"))),
          safeDocs(getDocs(collection(db, "activities"))),
          safeDocs(getDocs(collection(db, "outcomes"))),
          safeDocs(getDocs(query(collection(db, "progressReports"), where("status", "in", REVIEW_REPORTS)))),
        ]);
        let pendingCount = 0;
        try {
          pendingCount = (await getDocs(query(collection(db, "users"), where("status", "==", "pending")))).size;
        } catch (err) {
          console.error("Dashboard source unavailable:", err);
        }

        if (cancelled) return;
        setGroups(groupsList);
        setMilestones(milestonesList);
        setActivities(
          activitiesList.sort((a, b) => (toDateSafe(a.date)?.getTime() || 0) - (toDateSafe(b.date)?.getTime() || 0))
        );
        setOutcomes(outcomesList);
        setPendingUsers(pendingCount);
        setReports(reportsList);
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
      unsubApps();
      unsubDocs();
    };
  }, []);

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const needsReviewApps = apps.filter((a) => REVIEW_APPLICATIONS.includes(a.status));
  const activeGroups = groups.filter(
    (g) => !g.archived && [INCUBATEE_STATUS.ONBOARDING, INCUBATEE_STATUS.ACTIVE, INCUBATEE_STATUS.ON_HOLD, INCUBATEE_STATUS.CONTINUING].includes(g.incubateeStatus || INCUBATEE_STATUS.ACTIVE)
  );
  const overdueMilestones = milestones.filter((m) => isMilestoneOverdue(m, new Date()));
  const upcomingActivities = activities.filter((a) => (toDateSafe(a.date)?.getTime() || 0) >= todayStart).slice(0, 5);
  const graduated = outcomes.filter((o) => o.type === "Graduated").length;
  const exited = outcomes.filter((o) => o.type === "Exited" || o.type === "Withdrawn").length;
  const recentApps = [...needsReviewApps]
    .sort((a, b) => (toDateSafe(b.updatedAt)?.getTime() || 0) - (toDateSafe(a.updatedAt)?.getTime() || 0))
    .slice(0, 5);
  const pipeline = [
    APPLICATION_STATUS.SUBMITTED,
    APPLICATION_STATUS.SCREENING,
    APPLICATION_STATUS.FOR_EVALUATION,
    APPLICATION_STATUS.ACCEPTED,
  ].map((status) => ({ status, count: apps.filter((a) => a.status === status).length }));

  const groupName = (id) => groups.find((g) => g.id === id)?.name || "Startup";
  const groupLink = (id) => {
    if (role === "Portfolio Manager") return `/employee/view-group/${id}`;
    if (role === "TBI Manager" || role === "TBI Assistant" || role === "Management") return `/admin/view-group/${id}`;
    return `/incubatee/view-group/${id}`;
  };

  const attention = [
    { label: "Applications needing review", count: needsReviewApps.length, to: "/applications?status=review", tone: needsReviewApps.length > 0 ? "red" : "gray" },
    { label: "Reports awaiting review", count: reports.length, to: null, tone: reports.length > 0 ? "amber" : "gray" },
    { label: "Documents needing verification", count: pendingDocs.length, to: null, tone: pendingDocs.length > 0 ? "amber" : "gray" },
    { label: "Overdue milestones", count: overdueMilestones.length, to: null, tone: overdueMilestones.length > 0 ? "red" : "gray" },
    { label: "Pending user approvals", count: pendingUsers, to: "/admin-user-management", tone: pendingUsers > 0 ? "blue" : "gray" },
  ];

  return (
    <AppShell role={role} userName={userName}>
      <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-slate-900">
        {greeting()}, {userName?.split(" ")[0] || "there"}.
      </h1>
      <p className="text-sm text-muted mt-1 mb-6">Here is what is happening in the Marian TBI program today.</p>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <SectionTitle hint="Items waiting on someone — click through to act.">Action required</SectionTitle>
          <ul className="bg-white border border-line rounded divide-y divide-line mb-8">
            {attention.map((item) => (
              <li key={item.label} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    item.tone === "red" ? "bg-red-500" : item.tone === "amber" ? "bg-amber-500" : item.tone === "blue" ? "bg-sky-600" : "bg-slate-300"
                  }`}
                  aria-hidden="true"
                />
                <span className="text-2xl font-semibold text-slate-900 tabular-nums w-10">{item.count}</span>
                <span className="flex-1 text-sm text-slate-700">{item.label}</span>
                {item.to && item.count > 0 && (
                  <Link to={item.to} className="text-[13px] font-medium text-accent hover:underline">
                    Review →
                  </Link>
                )}
              </li>
            ))}
          </ul>

          <SectionTitle hint="Live counts from program records — never estimates.">Program at a glance</SectionTitle>
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line rounded overflow-hidden mb-8">
            {[
              { label: "Active incubatees", value: activeGroups.length },
              { label: "Total applications", value: apps.length },
              { label: "Graduated", value: graduated },
              { label: "Exited / withdrawn", value: exited },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white px-4 py-4">
                <dt className="text-xs text-muted">{kpi.label}</dt>
                <dd className="text-[28px] leading-8 font-semibold text-slate-900 tabular-nums">{kpi.value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Application pipeline</h2>
              <p className="text-xs text-muted mb-3">Click a stage to filter the queue.</p>
              <ol className="flex flex-col gap-0">
                {pipeline.map((stage, i) => (
                  <li key={stage.status}>
                    <Link
                      to={stage.status === "Accepted" ? "/applications" : "/applications?status=review"}
                      className="flex items-center gap-3 py-2 border-b border-line last:border-b-0 hover:bg-slate-50 -mx-1 px-1 rounded"
                    >
                      <span className="text-xs font-semibold text-muted w-5">{i + 1}</span>
                      <span className="flex-1 text-sm text-slate-700">{stage.status}</span>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">{stage.count}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>

            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Upcoming activities</h2>
              <p className="text-xs text-muted mb-3">Next 5 scheduled.</p>
              {upcomingActivities.length === 0 ? (
                <EmptyState title="Nothing scheduled" description="Upcoming trainings and events will appear here." />
              ) : (
                <ul className="flex flex-col">
                  {upcomingActivities.map((a) => (
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
            </section>

            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Recent applications</h2>
              <p className="text-xs text-muted mb-3">Latest needing review.</p>
              {recentApps.length === 0 ? (
                <p className="text-sm text-muted">Queue is clear.</p>
              ) : (
                <ul className="flex flex-col">
                  {recentApps.map((a) => (
                    <li key={a.id} className="py-2 border-b border-line last:border-b-0">
                      <Link to={`/applications/${a.id}`} className="text-sm font-medium text-slate-900 hover:text-accent">
                        {a.enterpriseName || "Untitled application"}
                      </Link>
                      <span className="block text-xs text-muted">
                        {a.status} · {a.updatedAt ? formatDateSafe(a.updatedAt) : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white border border-line rounded p-4">
              <h2 className="text-sm font-semibold text-slate-900 mb-1">Overdue milestones</h2>
              <p className="text-xs text-muted mb-3">Derived from due dates.</p>
              {overdueMilestones.length === 0 ? (
                <p className="text-sm text-muted">Nothing overdue.</p>
              ) : (
                <ul className="flex flex-col max-h-64 overflow-y-auto">
                  {overdueMilestones.slice(0, 20).map((m) => (
                    <li key={m.id} className="py-2 border-b border-line last:border-b-0">
                      <Link to={groupLink(m.groupId)} className="text-sm font-medium text-slate-900 hover:text-accent">
                        {m.title}
                      </Link>
                      <span className="block text-xs text-muted">
                        {groupName(m.groupId)} · due {m.dueDate ? formatDateSafe(m.dueDate) : "no date"}
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

export default AdDashboard;
