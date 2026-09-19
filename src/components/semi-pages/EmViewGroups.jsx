import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { FaPencilAlt } from "react-icons/fa";
import AppShell from "../layout/AppShell.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import Tabs from "../ui/Tabs.jsx";
import { ErrorState, PageSkeleton } from "../ui/states.jsx";
import StartupMetrics from "../groups/StartupMetrics.jsx";
import TeamSection from "../groups/TeamSection.jsx";
import SectionEmptyState from "../groups/SectionEmptyState.jsx";
import {
  comparePriority,
  formatDateSafe,
  normalizePriority,
  normalizeRequestStatus,
  normalizeTaskStatus,
  toDateSafe,
} from "../../lib/domain.js";
import MilestonesPanel from "../milestones/MilestonesPanel.jsx";
import MentorshipPanel from "../mentorship/MentorshipPanel.jsx";
import ReportsPanel from "../reports/ReportsPanel.jsx";
import AssessmentsPanel from "../assessments/AssessmentsPanel.jsx";
import IncubationStatusPanel from "../incubation/IncubationStatusPanel.jsx";
import DocumentsPanel from "../documents/DocumentsPanel.jsx";
import {
  canAssignMentors,
  canDeleteAssessment,
  canDeleteMilestone,
  canManageAssessments,
  canManageIncubationStatus,
  canReviewReports,
} from "../../lib/permissions.js";

function EmViewGroup() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [groupError, setGroupError] = useState("");
  const [requests, setRequests] = useState([]);
  const [workplan, setWorkplan] = useState([]);
  const [activeTable, setActiveTable] = useState("overview");
  const [viewerRole, setViewerRole] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [isRemarksModalOpen, setIsRemarksModalOpen] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestStatus, setRequestStatus] = useState("all");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatus, setTaskStatus] = useState("all");
  const [milestoneCounts, setMilestoneCounts] = useState(null);
  const [documentCount, setDocumentCount] = useState(null);
  const [reportCount, setReportCount] = useState(null);

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

    const fetchGroup = async () => {
      try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();

          const membersWithDetails = await Promise.all(
            (groupData.members || []).map(async (member) => {
              const memberDoc = await getDoc(doc(db, "users", member.id));
              if (memberDoc.exists()) {
                return { ...member, ...memberDoc.data() };
              }
              return member;
            })
          );

          setGroup({ id: groupDoc.id, ...groupData });
          setGroupMembers(membersWithDetails);
        } else {
          setGroupError("Startup not found.");
        }
      } catch (error) {
        console.error("Error fetching group:", error);
        setGroupError("We couldn't load this startup. Please try again.");
      }
    };

    const fetchRequests = async () => {
      try {
        const q = query(collection(db, "requests"), where("groupId", "==", groupId));
        const querySnapshot = await getDocs(q);
        setRequests(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching requests:", error);
      }
    };

    const fetchWorkplan = async () => {
      try {
        const q = query(collection(db, "workplan"), where("groupId", "==", groupId));
        const querySnapshot = await getDocs(q);
        setWorkplan(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching workplan:", error);
      }
    };

    fetchGroup();
    fetchRequests();
    fetchWorkplan();
  }, [groupId]);

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      // Update the request status in Firestore
      await updateDoc(doc(db, "requests", requestId), { status: newStatus });

      // Update the local state
      setRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === requestId ? { ...request, status: newStatus } : request
        )
      );

      // Find the Project Manager of the group
      const projectManager = groupMembers.find(
        (member) => member.groupRole === "Project Manager"
      );

      // Find the request details
      const request = requests.find((req) => req.id === requestId);

      if (projectManager && request) {
        // Notify the Project Manager (plain text; rendered safely)
        await addDoc(collection(db, "notifications"), {
          userId: projectManager.id, // ID of the Project Manager
          message: `Request Update: The status of a request ${request.resourceToolNeeded || "N/A"} in your group ${group.name} has been updated to ${newStatus}.`,
          createdAt: serverTimestamp(), // Use Firestore's serverTimestamp
          read: false,
          type: "request-status-update",
          groupId: groupId,
        });
      }
    } catch (error) {
      console.error("Error updating status or sending notification:", error);
    }
  };

  const handleRemarksSave = async () => {
    try {
      await updateDoc(doc(db, "requests", currentRequest.id), { remarks });
      setRequests((prevRequests) =>
        prevRequests.map((request) =>
          request.id === currentRequest.id ? { ...request, remarks } : request
        )
      );
      setIsRemarksModalOpen(false);
      setCurrentRequest(null);
      setRemarks("");
    } catch (error) {
      console.error("Error saving remarks:", error);
    }
  };

  // Table filters run above the loading guard (they only read requests /
  // workplan state) so hook order stays stable across renders.
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
        if (comparePriority(a.priorityLevel, b.priorityLevel) !== 0) {
          return comparePriority(a.priorityLevel, b.priorityLevel);
        }
        return (toDateSafe(a.startDate)?.getTime() || 0) - (toDateSafe(b.startDate)?.getTime() || 0);
      });
  }, [workplan, taskSearch, taskStatus]);

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

  if (!group) {
    return (
      <AppShell role={viewerRole} userName={viewerName}>
        {groupError ? (
          <ErrorState message={groupError} onRetry={() => window.location.reload()} />
        ) : (
          <PageSkeleton rows={6} />
        )}
      </AppShell>
    );
  }

  const activeTasks = workplan.filter((task) => normalizeTaskStatus(task.status) !== "Completed").length;
  const openRequests = requests.filter((r) => normalizeRequestStatus(r.status) !== "Done").length;
  const manager = group.portfolioManager;

  return (
    <AppShell role={viewerRole} userName={viewerName}>
      <PageHeader
        backTo="/employee-groups"
        backLabel="Startups"
        title={group.name}
        description={group.description}
        actions={<StatusBadge status={group.incubateeStatus || "Active"} />}
      />

      {group.imageUrl && (
        <img src={group.imageUrl} alt="" className="w-full h-32 object-cover rounded border border-line mb-5" />
      )}

      <Tabs tabs={tabs} active={activeTable} onChange={setActiveTable} />
          {activeTable === "overview" && (
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
                onSelect={setActiveTable}
              />
              <TeamSection members={groupMembers} portfolioManager={manager || null} />
              <section aria-label="Lifecycle status">
                <IncubationStatusPanel
                  group={group}
                  groupId={groupId}
                  actorId={auth.currentUser?.uid}
                  canManage={canManageIncubationStatus({ appRole: viewerRole })}
                  accentColor="bg-primary-color"
                />
              </section>
            </div>
          )}
          {activeTable === "requests" && (
            <div>
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <div className="flex-1 min-w-[150px] sm:flex-none">
                  <label htmlFor="emRequestSearch" className="tbi-label">Search</label>
                  <input
                    id="emRequestSearch"
                    type="search"
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    placeholder="Member, type, or keyword"
                    className="tbi-input sm:max-w-64"
                  />
                </div>
                <div>
                  <label htmlFor="emRequestStatus" className="tbi-label">Status</label>
                  <select
                    id="emRequestStatus"
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
                          <td>{request.dateNeeded ? formatDateSafe(request.dateNeeded) : "—"}</td>
                          <td>{request.resourceToolNeeded}</td>
                          <td>{request.prospectResourcePerson || "—"}</td>
                          <td>
                            <StatusBadge status={normalizePriority(request.priorityLevel)} />
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => {
                                setCurrentRequest(request);
                                setRemarks(request.remarks || "");
                                setIsRemarksModalOpen(true);
                              }}
                              className="text-accent hover:underline"
                              aria-label={`Edit remarks for ${request.resourceToolNeeded || "request"}`}
                            >
                              <FaPencilAlt />
                            </button>
                          </td>
                          <td>
                            <select
                              value={request.status || "Pending"}
                              onChange={(e) => handleStatusChange(request.id, e.target.value)}
                              className="tbi-input !w-auto text-[13px]"
                              aria-label="Request status"
                            >
                              <option value="Pending">Pending</option>
                              <option value="Requested">Requested</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Done">Done</option>
                            </select>
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
                      ? "When the team submits needs, they appear here for follow-up."
                      : "Try a different search term or status filter."
                  }
                />
              )}
            </div>
            </div>
          )}

          {activeTable === "workplan" && (
            <div>
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <div className="flex-1 min-w-[150px] sm:flex-none">
                  <label htmlFor="emTaskSearch" className="tbi-label">Search</label>
                  <input
                    id="emTaskSearch"
                    type="search"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Task or assignee"
                    className="tbi-input sm:max-w-64"
                  />
                </div>
                <div>
                  <label htmlFor="emTaskStatus" className="tbi-label">Status</label>
                  <select
                    id="emTaskStatus"
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

          {activeTable === "milestones" && (
            <MilestonesPanel
              groupId={groupId}
              groupObjectives={group.objectives}
              actorId={auth.currentUser?.uid}
              canManage={true}
              canDelete={canDeleteMilestone({ appRole: viewerRole })}
              accentColor="bg-primary-color"
              onCount={setMilestoneCounts}
            />
          )}

          {activeTable === "mentorship" && (
            <MentorshipPanel
              groupId={groupId}
              actorId={auth.currentUser?.uid}
              canAssign={canAssignMentors({ appRole: viewerRole })}
              accentColor="bg-primary-color"
            />
          )}

          {activeTable === "reports" && (
            <ReportsPanel
              groupId={groupId}
              actorId={auth.currentUser?.uid}
              canSubmit={false}
              canReview={canReviewReports({ appRole: viewerRole })}
              accentColor="bg-primary-color"
              onCount={setReportCount}
            />
          )}

          {activeTable === "documents" && (
            <DocumentsPanel
              scope="group"
              scopeId={groupId}
              owner={{ id: auth.currentUser?.uid, name: viewerName }}
              canUpload={false}
              canVerify={canReviewReports({ appRole: viewerRole })}
              canDelete={viewerRole === "TBI Manager"}
              onCount={setDocumentCount}
            />
          )}

          {activeTable === "assessments" && (
            <AssessmentsPanel
              groupId={groupId}
              actorId={auth.currentUser?.uid}
              canManage={canManageAssessments({ appRole: viewerRole })}
              canDelete={canDeleteAssessment({ appRole: viewerRole })}
              accentColor="bg-primary-color"
            />
          )}

      {isRemarksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Edit remarks">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-[400px]">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">Edit remarks</h2>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="tbi-input"
              placeholder="Enter remarks here..."
            ></textarea>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setIsRemarksModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-800 text-sm font-medium rounded hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRemarksSave}
                className="px-4 py-2 bg-primary-color text-white text-sm font-medium rounded hover:bg-primary-deep transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default EmViewGroup;