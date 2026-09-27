import { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import AppShell from "../../components/layout/AppShell.jsx";
import { SectionHeader } from "../../components/ui/PageHeader.jsx";
import { ActionQueue, MetricRow, QueueColumn, QueueRow, Sparkline, StageBar } from "../../components/ui/dashboard.jsx";
import { ErrorState, PageSkeleton } from "../../components/ui/states.jsx";import StatusBadge from "../../components/ui/StatusBadge.jsx";
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

const STAGE_ORDER = [
  APPLICATION_STATUS.SUBMITTED,
  APPLICATION_STATUS.SCREENING,
  APPLICATION_STATUS.FOR_EVALUATION,
  APPLICATION_STATUS.ACCEPTED,
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Eight-week activity trend, derived from the activities already loaded for
// the dashboard. Adds no new query — it only reshapes existing records.
function weeklyTrend(activities) {
  const weeks = [];
  const now = new Date();
  for (let i = 7; i >= 0; i -= 1) {
    const end = new Date(now);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const count = activities.filter((a) => {
      const t = toDateSafe(a.date)?.getTime();
      return t != null && t >= start.getTime() && t <= end.getTime();
    }).length;
    weeks.push({
      key: end.toISOString().slice(0, 10),
      label: `w/c ${start.getDate()}/${start.getMonth() + 1}`,
      value: count,
    });
  }
  return weeks;
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
  const pipeline = useMemo(
    () =>
      STAGE_ORDER.map((status) => ({
        label: status,
        status,
        count: apps.filter((a) => a.status === status).length,
        to: status === "Accepted" ? "/applications" : "/applications?status=review",
      })),
    [apps]
  );
  const trend = useMemo(() => weeklyTrend(activities), [activities]);

  const groupName = (id) => groups.find((g) => g.id === id)?.name || "Startup";
  const groupLink = (id) => {
    if (role === "Portfolio Manager") return `/employee/view-group/${id}`;
    if (role === "TBI Manager" || role === "TBI Assistant" || role === "Management") return `/admin/view-group/${id}`;
    return `/incubatee/view-group/${id}`;
  };

  const attention = [
    { label: "Applications needing review", count: needsReviewApps.length, to: "/applications?status=review", tone: "critical" },
    { label: "Reports awaiting review", count: reports.length, to: null, tone: "warning" },
    { label: "Documents needing verification", count: pendingDocs.length, to: null, tone: "warning" },
    { label: "Overdue milestones", count: overdueMilestones.length, to: null, tone: "critical" },
    { label: "Pending user approvals", count: pendingUsers, to: "/admin-user-management", tone: "info" },
  ];

  const firstName = userName?.split(" ")[0] || "there";

  return (
    <AppShell role={role} userName={userName}>
      <header className="mb-6 sm:mb-7">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[26px] lg:text-[30px]">
          {greeting()}, {firstName}.
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Here is what is happening in the Marian TBI program today.
        </p>
      </header>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <div className="space-y-8">
          {/* ── What requires attention ─────────────────────────────── */}
          <section aria-labelledby="sec-attention">
            <SectionHeader hint="Items waiting on someone. Open one to act on it.">
              <span id="sec-attention">Action required</span>
            </SectionHeader>
            <ActionQueue items={attention} className="mt-3.5" />
          </section>

          {/* ── Program figures ──────────────────────────────────────── */}
          <section aria-labelledby="sec-program">
            <SectionHeader hint="Live counts from program records — never estimates.">
              <span id="sec-program">Program at a glance</span>
            </SectionHeader>
            <MetricRow
              className="mt-3.5"
              items={[
                { label: "Active incubatees", value: activeGroups.length },
                { label: "Total applications", value: apps.length },
                { label: "Graduated", value: graduated },
                { label: "Exited / withdrawn", value: exited },
              ]}
            />
          </section>

          {/* ── Pipeline + activity trend ───────────────────────────── */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <section aria-labelledby="sec-pipeline">
              <SectionHeader hint="Where every application currently sits. Select a stage to filter the queue.">
                <span id="sec-pipeline">Application pipeline</span>
              </SectionHeader>
              <div className="mt-4">
                <StageBar stages={pipeline} />
              </div>
            </section>

            <section aria-labelledby="sec-trend">
              <SectionHeader hint="Scheduled activities per week across the last eight weeks.">
                <span id="sec-trend">Activity trend</span>
              </SectionHeader>
              <div className="mt-4">
                <Sparkline
                  data={trend}
                  label={`Activities per week over the last eight weeks. Peak ${Math.max(
                    0,
                    ...trend.map((t) => t.value)
                  )}.`}
                  caption={`${trend.reduce((s, t) => s + t.value, 0)} scheduled in 8 weeks`}
                />
              </div>
            </section>
          </div>

          {/* ── Working queues ──────────────────────────────────────── */}
          <section aria-labelledby="sec-work">
            <SectionHeader hint="The three lists a program manager actually works from.">
              <span id="sec-work">Needs follow-up</span>
            </SectionHeader>

            <div className="mt-3.5 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-3">
              <QueueColumn
                title="Upcoming activities"
                caption="Next 5 scheduled"
                isEmpty={upcomingActivities.length === 0}
                emptyTitle="Nothing scheduled"
                emptyBody="Upcoming trainings and events will appear here."
              >
                {upcomingActivities.map((a) => (
                  <QueueRow key={a.id} to={`/activities/${a.id}`} title={a.title}>
                    <span className="block text-xs text-muted">
                      {a.type}
                      {a.location ? ` · ${a.location}` : ""}
                    </span>
                  </QueueRow>
                ))}
              </QueueColumn>

              <QueueColumn
                title="Recent applications"
                caption="Latest needing review"
                isEmpty={recentApps.length === 0}
                emptyTitle="Queue is clear"
                emptyBody="No application is waiting for review right now."
              >
                {recentApps.map((a) => (
                  <QueueRow
                    key={a.id}
                    to={`/applications/${a.id}`}
                    title={a.enterpriseName || "Untitled application"}
                  >
                    <span className="mt-0.5 inline-block">
                      <StatusBadge status={a.status} />
                    </span>
                    <span className="block text-xs text-muted">
                      {a.updatedAt ? formatDateSafe(a.updatedAt) : ""}
                    </span>
                  </QueueRow>
                ))}
              </QueueColumn>

              <QueueColumn
                title="Overdue milestones"
                caption="Derived from due dates"
                isEmpty={overdueMilestones.length === 0}
                emptyTitle="Nothing overdue"
                emptyBody="Every milestone in the program is within its due date."
              >
                {overdueMilestones.slice(0, 20).map((m) => (
                  <QueueRow key={m.id} to={groupLink(m.groupId)} title={m.title}>
                    <span className="block text-xs text-muted">
                      {groupName(m.groupId)} · due{" "}
                      {m.dueDate ? formatDateSafe(m.dueDate) : "no date"}
                    </span>
                  </QueueRow>
                ))}
              </QueueColumn>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

export default AdDashboard;
