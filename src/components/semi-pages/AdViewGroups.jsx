import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { doc, query, where, onSnapshot, collection, getDoc, getDocs } from "firebase/firestore";
import AppShell from "../layout/AppShell.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import Tabs from "../ui/Tabs.jsx";
import { ErrorState, PageSkeleton } from "../ui/states.jsx";
import { MdEdit } from "react-icons/md";
import EditStartupPanel from "../groups/EditStartupPanel.jsx";
import StartupMetrics from "../groups/StartupMetrics.jsx";
import TeamSection from "../groups/TeamSection.jsx";
import SectionEmptyState from "../groups/SectionEmptyState.jsx";
import MilestonesPanel from "../milestones/MilestonesPanel.jsx";
import MentorshipPanel from "../mentorship/MentorshipPanel.jsx";
import ReportsPanel from "../reports/ReportsPanel.jsx";
import AssessmentsPanel from "../assessments/AssessmentsPanel.jsx";
import IncubationStatusPanel from "../incubation/IncubationStatusPanel.jsx";
import DocumentsPanel from "../documents/DocumentsPanel.jsx";
import {
  comparePriority,
  formatDateSafe,
  normalizePriority,
  normalizeRequestStatus,
  normalizeTaskStatus,
  toDateSafe,
} from "../../lib/domain.js";
import { canAssignMentors, canDeleteAssessment, canDeleteMilestone, canManageAssessments, canManageIncubationStatus, canReviewReports, isStaffAppRole } from "../../lib/permissions.js";

function AdViewGroups() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [groupError, setGroupError] = useState("");
  const [requests, setRequests] = useState([]);
  const [workplan, setWorkplan] = useState([]);
  const [tab, setTab] = useState("overview");
  const [viewerRole, setViewerRole] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [portfolioManager, setPortfolioManager] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [groups, setGroups] = useState([]); // State for all groups
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatus, setTaskStatus] = useState("all");
  const [milestoneCounts, setMilestoneCounts] = useState(null);
  const [documentCount, setDocumentCount] = useState(null);
  const [reportCount, setReportCount] = useState(null);

  useEffect(() => {
    const fetchGroup = () => {
      const groupDocRef = doc(db, "groups", groupId);
      const unsubscribeGroup = onSnapshot(groupDocRef, async (docSnapshot) => {
        try {
          if (docSnapshot.exists()) {
          const groupData = docSnapshot.data();

          // Fetch member details
          const membersWithDetails = await Promise.all(
            (groupData.members || []).map(async (member) => {
              const memberDocRef = doc(db, "users", member.id);
              const memberDoc = await getDoc(memberDocRef);
              if (memberDoc.exists()) {
                return {
                  ...memberDoc.data(),
                  id: member.id,
                  groupRole: member.groupRole, // Use groupRole from the group data
                };
              }
              return member; // Return member as is if user details are not found
            })
          );

          setGroup({ id: docSnapshot.id, ...groupData, members: membersWithDetails });

          // Fetch portfolio manager details
          if (groupData.portfolioManager?.id) {
            const portfolioManagerDocRef = doc(db, "users", groupData.portfolioManager.id);
            const portfolioManagerDoc = await getDoc(portfolioManagerDocRef);
            if (portfolioManagerDoc.exists()) {
              setPortfolioManager(portfolioManagerDoc.data());
            }
          }
          } else {
            setGroupError("Startup not found.");
          }
        } catch (error) {
          console.error("Error fetching group:", error);
          setGroupError("We couldn't load this startup. Please try again.");
        }
      });

      return unsubscribeGroup;
    };

    const unsubscribeGroup = fetchGroup();

    return () => {
      unsubscribeGroup();
    };
  }, [groupId]);

  useEffect(() => {
    const fetchViewerRole = async () => {
      try {
        const current = auth.currentUser;
        if (!current) return;
        const userDoc = await getDoc(doc(db, "users", current.uid));
        if (userDoc.exists()) {
          setViewerRole(userDoc.data().role || "");
          setViewerName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
        }
      } catch (error) {
        console.error("Error fetching viewer role:", error);
      }
    };
    fetchViewerRole();
  }, []);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groupsQuery = collection(db, "groups");
        const querySnapshot = await getDocs(groupsQuery);
        const fetchedGroups = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setGroups(fetchedGroups); // Set the groups data
      } catch (error) {
        console.error("Error fetching groups:", error);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    const fetchRequests = () => {
      const q = query(collection(db, "requests"), where("groupId", "==", groupId));
      const unsubscribeRequests = onSnapshot(q, (querySnapshot) => {
        setRequests(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return unsubscribeRequests;
    };

    const fetchWorkplan = () => {
      const q = query(collection(db, "workplan"), where("groupId", "==", groupId));
      const unsubscribeWorkplan = onSnapshot(q, (querySnapshot) => {
        setWorkplan(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return unsubscribeWorkplan;
    };

    const unsubscribeRequests = fetchRequests();
    const unsubscribeWorkplan = fetchWorkplan();

    return () => {
      unsubscribeRequests();
      unsubscribeWorkplan();
    };
  }, [groupId]);

  // The edit panel owns its Firestore writes; the page just refreshes local state.
  const handleSaveGroup = (updatedGroup) => {
    setGroup((prev) => (prev ? { ...prev, ...updatedGroup } : prev));
  };

  const filteredRequests = useMemo(() => {
    const q = requestSearch.trim().toLowerCase();
    return [...requests]
      .filter((r) => {
        if (requestStatus === "open" && normalizeRequestStatus(r.status) === "Done") return false;
        if (requestStatus === "done" && normalizeRequestStatus(r.status) !== "Done") return false;
        if (!q) return true;
        return [r.responsibleTeamMember, r.requestType, r.description, r.resourceToolNeeded]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        if (comparePriority(a.priorityLevel, b.priorityLevel) !== 0) {
          return comparePriority(a.priorityLevel, b.priorityLevel);
        }
        const aDone = normalizeRequestStatus(a.status) === "Done";
        const bDone = normalizeRequestStatus(b.status) === "Done";
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        return (toDateSafe(a.dateEntry)?.getTime() || 0) - (toDateSafe(b.dateEntry)?.getTime() || 0);
      });
  }, [requests, requestSearch, requestStatus]);

  const filteredWorkplan = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return workplan
      .filter((t) => {
        if (taskStatus !== "all" && normalizeTaskStatus(t.status) !== taskStatus) return false;
        if (!q) return true;
        return [t.taskName, t.assignedTo].filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .slice()
      .sort((a, b) => {
        const aDone = normalizeTaskStatus(a.status) === "Completed";
        const bDone = normalizeTaskStatus(b.status) === "Completed";
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        if (comparePriority(a.priorityLevel, b.priorityLevel) !== 0) {
          return comparePriority(a.priorityLevel, b.priorityLevel);
        }
        return (toDateSafe(a.startDate)?.getTime() || 0) - (toDateSafe(b.startDate)?.getTime() || 0);
      });
  }, [workplan, taskSearch, taskStatus]);

  if (!group && !groupError) {
    return (
      <AppShell role={viewerRole} userName={viewerName}>
        <PageSkeleton rows={6} />
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell role={viewerRole} userName={viewerName}>
        <ErrorState message={groupError} onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  // Management opens this page read-only (VIEW, not MANAGE):
  // every manage prop resolves through the viewer role, never the route.
  const staffView = isStaffAppRole(viewerRole);
  const openRequests = requests.filter((r) => normalizeRequestStatus(r.status) !== "Done").length;
  const activeTasks = workplan.filter((t) => normalizeTaskStatus(t.status) !== "Completed").length;
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "requests", label: "Requests", count: requests.length },
    { key: "workplan", label: "Workplan", count: workplan.length },
    { key: "milestones", label: "Milestones" },
    { key: "mentorship", label: "Mentorship" },
    { key: "reports", label: "Reports" },
    { key: "documents", label: "Documents" },
    { key: "assessments", label: "Assessments" },
  ];

  return (
    <AppShell role={viewerRole} userName={viewerName}>
      <PageHeader
        backTo="/admin-groups"
        backLabel="Startups"
        title={group.name}
        description={group.description}
        actions={
          <>
            <StatusBadge status={group.incubateeStatus || "Active"} />
            {staffView && (
              <button
                onClick={() => setIsEditOpen(true)}
                className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition inline-flex items-center gap-2"
              >
                <MdEdit aria-hidden="true" />
                Edit startup
              </button>
            )}
          </>
        }
      />

      {group.imageUrl && <img src={group.imageUrl} alt="" className="w-full h-32 object-cover rounded border border-line mb-5" />}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {/* Overview: metrics, team, lifecycle status */}
        {tab === "overview" && (
          <div className="flex flex-col gap-5">
            <StartupMetrics
              metrics={{
                openRequests,
                activeTasks,
                taskTotal: workplan.length,
                milestonesDone: milestoneCounts?.done,
                milestonesTotal: milestoneCounts?.total,
                documents: documentCount,
                reports: reportCount,
              }}
              onSelect={setTab}
            />
            <TeamSection
              members={group.members}
              portfolioManager={portfolioManager || group.portfolioManager || null}
              onManage={staffView ? () => setIsEditOpen(true) : null}
            />
            <section aria-label="Lifecycle status">
              <IncubationStatusPanel
                group={group}
                groupId={groupId}
                actorId={auth.currentUser?.uid}
                canManage={staffView && canManageIncubationStatus({ appRole: viewerRole })}
                accentColor="bg-primary-color"
              />
            </section>
          </div>
        )}

        {/* Requests Table */}
        {tab === "requests" && (
          <div>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="flex-1 min-w-[150px] sm:flex-none">
                <label htmlFor="requestSearch" className="tbi-label">Search</label>
                <input
                  id="requestSearch"
                  type="search"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  placeholder="Member, type, or keyword"
                  className="tbi-input sm:max-w-64"
                />
              </div>
              <div>
                <label htmlFor="requestStatus" className="tbi-label">Status</label>
                <select
                  id="requestStatus"
                  value={requestStatus}
                  onChange={(e) => setRequestStatus(e.target.value)}
                  className="tbi-input sm:max-w-44"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>
            <div className="bg-white border border-line rounded overflow-x-auto">
              <table className="tbi-table min-w-[900px]">
                <thead>
                  <tr>
                    <th scope="col">Team member</th>
                    <th scope="col">Request type</th>
                    <th scope="col">Description</th>
                    <th scope="col">Date entry</th>
                    <th scope="col">Date needed</th>
                    <th scope="col">Specific needs</th>
                    <th scope="col">Resource person</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Remarks</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.responsibleTeamMember}</td>
                      <td>{request.requestType}</td>
                      <td className="max-w-[220px]">{request.description}</td>
                      <td>{formatDateSafe(request.dateEntry)}</td>
                      <td>{request.dateNeeded ? formatDateSafe(request.dateNeeded) : "N/A"}</td>
                      <td>{request.resourceToolNeeded}</td>
                      <td>{request.prospectResourcePerson || "—"}</td>
                      <td>
                        <StatusBadge status={normalizePriority(request.priorityLevel)} />
                      </td>
                      <td>{request.remarks || "N/A"}</td>
                      <td>
                        <StatusBadge status={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRequests.length === 0 && (
                <SectionEmptyState
                  title={requests.length === 0 ? "No requests yet" : "No requests match"}
                  message={
                    requests.length === 0
                      ? "When the team submits needs, they appear here for staff follow-up."
                      : "Try a different search term or status filter."
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Workplan Table */}
        {tab === "workplan" && (
          <div>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="flex-1 min-w-[150px] sm:flex-none">
                <label htmlFor="taskSearch" className="tbi-label">Search</label>
                <input
                  id="taskSearch"
                  type="search"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Task or assignee"
                  className="tbi-input sm:max-w-64"
                />
              </div>
              <div>
                <label htmlFor="taskStatus" className="tbi-label">Status</label>
                <select
                  id="taskStatus"
                  value={taskStatus}
                  onChange={(e) => setTaskStatus(e.target.value)}
                  className="tbi-input sm:max-w-44"
                >
                  <option value="all">All</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>
            <div className="bg-white border border-line rounded overflow-x-auto">
              <table className="tbi-table min-w-[720px]">
                <thead>
                  <tr>
                    <th scope="col">Task</th>
                    <th scope="col">Assigned to</th>
                    <th scope="col">Start</th>
                    <th scope="col">Due</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkplan.map((task) => (
                    <tr key={task.id}>
                      <td className="font-medium text-slate-900">{task.taskName}</td>
                      <td>{task.assignedTo}</td>
                      <td>{formatDateSafe(task.startDate)}</td>
                      <td>{formatDateSafe(task.endDate)}</td>
                      <td>
                        <StatusBadge status={normalizePriority(task.priorityLevel)} />
                      </td>
                      <td>
                        <StatusBadge status={task.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredWorkplan.length === 0 && (
                <SectionEmptyState
                  title={workplan.length === 0 ? "No tasks yet" : "No tasks match"}
                  message={
                    workplan.length === 0
                      ? "Tasks planned with the team appear here with owners and due dates."
                      : "Try a different search term or status filter."
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* Milestones */}
        {tab === "milestones" && (
          <MilestonesPanel
            groupId={groupId}
            groupObjectives={group.objectives}
            actorId={auth.currentUser?.uid}
            canManage={staffView}
            canDelete={staffView && canDeleteMilestone({ appRole: viewerRole })}
            accentColor="bg-primary-color"
            onCount={setMilestoneCounts}
          />
        )}

        {/* Mentorship */}
        {tab === "mentorship" && (
          <MentorshipPanel
            groupId={groupId}
            actorId={auth.currentUser?.uid}
            canAssign={staffView && canAssignMentors({ appRole: viewerRole })}
            accentColor="bg-primary-color"
          />
        )}

        {/* Reports */}
        {tab === "reports" && (
          <ReportsPanel
            groupId={groupId}
            actorId={auth.currentUser?.uid}
            canSubmit={false}
            canReview={staffView && canReviewReports({ appRole: viewerRole })}
            accentColor="bg-primary-color"
            onCount={setReportCount}
          />
        )}

        {/* Documents */}
        {tab === "documents" && (
          <DocumentsPanel
            scope="group"
            scopeId={groupId}
            owner={{ id: auth.currentUser?.uid, name: viewerName }}
            canUpload={false}
            canVerify={staffView}
            canDelete={viewerRole === "TBI Manager"}
            onCount={setDocumentCount}
          />
        )}

        {/* Assessments */}
        {tab === "assessments" && (
          <AssessmentsPanel
            groupId={groupId}
            actorId={auth.currentUser?.uid}
            canManage={staffView && canManageAssessments({ appRole: viewerRole })}
            canDelete={canDeleteAssessment({ appRole: viewerRole })}
            accentColor="bg-primary-color"
          />
        )}

      {/* Edit panel */}
      {isEditOpen && (
        <EditStartupPanel
          group={group}
          groups={groups}
          canDelete={viewerRole === "TBI Manager"}
          archiveTo="/admin-groups/archives"
          deleteTo="/admin-groups"
          onClose={() => setIsEditOpen(false)}
          onSave={handleSaveGroup}
        />
      )}
    </AppShell>
  );
}

export default AdViewGroups;
