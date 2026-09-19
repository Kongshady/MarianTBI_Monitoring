import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../../config/marian-config.js";import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import RequestsTable from "../modals/RequestsTable.jsx";
import WorkplanTable from "../modals/WorkplanTable.jsx";
import MilestonesPanel from "../milestones/MilestonesPanel.jsx";
import MentorshipPanel from "../mentorship/MentorshipPanel.jsx";
import ReportsPanel from "../reports/ReportsPanel.jsx";
import AssessmentsPanel from "../assessments/AssessmentsPanel.jsx";
import IncubationStatusPanel from "../incubation/IncubationStatusPanel.jsx";
import DocumentsPanel from "../documents/DocumentsPanel.jsx";
import AppShell from "../layout/AppShell.jsx";
import PageHeader from "../ui/PageHeader.jsx";
import StatusBadge from "../ui/StatusBadge.jsx";
import Tabs from "../ui/Tabs.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import StartupMetrics from "../groups/StartupMetrics.jsx";
import TeamSection from "../groups/TeamSection.jsx";
import { toast } from "../../lib/toast.js";
import { ErrorState, PageSkeleton, AccessRestricted } from "../ui/states.jsx";
import { resolveGroupAccess } from "../../lib/access.js";
import { normalizeRequestStatus, normalizeTaskStatus } from "../../lib/domain.js";
import { canDeleteMilestone, canSubmitAsTeamMember } from "../../lib/permissions.js";

function IncuViewGroup() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [groupError, setGroupError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tab, setTab] = useState("overview");
  const [requests, setRequests] = useState([]);
  const [workplan, setWorkplan] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [userRole, setUserRole] = useState(""); // Team function within this startup
  const [appRole, setAppRole] = useState("");
  const [userName, setUserName] = useState("");
  const [requestData, setRequestData] = useState({
    responsibleTeamMember: "",
    requestType: "",
    description: "",
    dateEntry: new Date().toISOString().split("T")[0],
    dateNeeded: "",
    resourceToolNeeded: "",
    prospectResourcePerson: "",
    priorityLevel: "",
    remarks: "",
    status: "Pending",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [modalError, setModalError] = useState("");
  const [confirm, setConfirm] = useState(null);
  const [myAssignments, setMyAssignments] = useState([]);
  const [myUid, setMyUid] = useState(null);
  const [milestoneCounts, setMilestoneCounts] = useState(null);
  const [documentCount, setDocumentCount] = useState(null);
  const [reportCount, setReportCount] = useState(null);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroup({ id: groupDoc.id, ...groupData });
          setGroupMembers(groupData.members || []);

          // Determine the logged-in user's groupRole + app role for the shell
          const user = auth.currentUser;
          if (user) {
            setMyUid(user.uid);
            const userInGroup = (groupData.members || []).find((member) => member.id === user.uid);
            if (userInGroup) {
              setUserRole(userInGroup.groupRole); // Set the user's groupRole
            }
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setAppRole(userData.role || "");
              setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());
            }
            // Active mentor assignments for record-level access.
            try {
              const assignSnap = await getDocs(
                query(collection(db, "mentorAssignments"), where("mentorId", "==", user.uid))
              );
              setMyAssignments(
                assignSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((a) => !a.endedAt)
              );
            } catch (assignError) {
              console.error("Error fetching assignments:", assignError);
            }
          }
        } else {
          setGroupError("Startup not found.");
        }
      } catch (error) {
        console.error("Error fetching group:", error);
        setGroupError("We couldn't load this startup. Please try again.");
      }
    };

    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    const q = query(collection(db, "requests"), where("groupId", "==", groupId));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        setRequests(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error("Error loading requests:", error)
    );
    return () => unsubscribe();
  }, [groupId]);

  useEffect(() => {
    const q = query(collection(db, "workplan"), where("groupId", "==", groupId));
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        setWorkplan(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (error) => console.error("Error loading workplan:", error)
    );
    return () => unsubscribe();
  }, [groupId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRequestData((prevData) => ({
        ...prevData,
        [name]: value,
        ...(name === "requestType" && { resourceToolNeeded: "" }), // Reset resourceToolNeeded when requestType changes
    }));
};

// Options for Resource/Tool Needed based on Request Type
const resourceToolOptions = {
    "Human Resource": ["Business Expert", "Legal Expert", "Technical Expert"],
    "Financial Resource": ["Save Money"],
    "Other Resource": ["Equipment", "Subscription", "Platform Tools", "Other Needs"],
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError("");
    try {
      if (isEditing) {
        // Update an existing request
        await updateDoc(doc(db, "requests", currentRequestId), requestData);
        toast("Request updated.");
      } else {
        // Add a new request
        if (!groupId) {
          throw new Error("Group ID is missing. Please try again.");
        }

        await addDoc(collection(db, "requests"), {
          ...requestData,
          dateEntry: serverTimestamp(),
          groupId,
        });

        toast("Request submitted.");
      }

      setIsModalOpen(false);
      setIsEditing(false);
      setCurrentRequestId(null);
    } catch (error) {
      console.error("Error submitting request:", error);
      setModalError(error.message || "Failed to submit the request. Please try again.");
    }
  };

  const handleEditRequest = (requestId) => {
    const requestToEdit = requests.find((request) => request.id === requestId);
    setRequestData(requestToEdit);
    setCurrentRequestId(requestId);
    setIsEditing(true);
    setModalError("");
    setIsModalOpen(true);
  };

  const handleDeleteRequest = async (requestId) => {
    setConfirm({
      title: "Delete this request?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        try {
          await deleteDoc(doc(db, "requests", requestId));
          toast("Request deleted.");
        } catch (error) {
          console.error("Error deleting request:", error);
          toast("Failed to delete the request.", "error");
        }
      },
    });
  };

  const handleAddTask = async (newTask) => {
    try {
      // Additive UID for future-proof assignment; legacy `assignedTo` name kept for old docs.
      const assignee = (groupMembers || []).find(
        (member) => `${member.name} ${member.lastname}` === newTask.assignedTo
      );
      await addDoc(collection(db, "workplan"), {
        ...newTask,
        assignedToUid: assignee?.id || null,
        groupId,
        status: "Pending",
      });
      toast("Task added.");
    } catch (error) {
      console.error("Error adding task:", error);
      toast("Failed to add the task.", "error");
    }
  };

  const handleEditTask = async (updatedTask) => {
    try {
      const taskDoc = doc(db, "workplan", updatedTask.id);
      await updateDoc(taskDoc, updatedTask);
      toast("Task updated.");
    } catch (error) {
      console.error("Error updating task:", error);
      toast("Failed to update the task.", "error");
    }
  };

  const handleDeleteTask = async (taskId) => {
    setConfirm({
      title: "Delete this task?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        try {
          const taskDoc = doc(db, "workplan", taskId);
          await deleteDoc(taskDoc);
          toast("Task deleted.");
        } catch (error) {
          console.error("Error deleting task:", error);
          toast("Failed to delete the task.", "error");
        }
      },
    });
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const taskDoc = doc(db, "workplan", taskId);
      await updateDoc(taskDoc, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const openRequests = requests.filter((r) => normalizeRequestStatus(r.status) !== "Done").length;
  const activeTasks = workplan.filter((t) => normalizeTaskStatus(t.status) !== "Completed").length;

  if (!group && !groupError) {
    return (
      <AppShell role={appRole} userName={userName}>
        <PageSkeleton rows={6} />
      </AppShell>
    );
  }

  if (!group) {
    return (
      <AppShell role={appRole} userName={userName}>
        <ErrorState message={groupError} onRetry={() => window.location.reload()} />
      </AppShell>
    );
  }

  // Record-level gate: member, actively assigned mentor, staff, or
  // oversight — never URL ID alone.
  const accessLevel = resolveGroupAccess({
    group,
    userId: myUid,
    appRole,
    assignments: myAssignments,
  });

  if (!accessLevel) {
    return (
      <AppShell role={appRole} userName={userName}>
        <PageHeader backTo="/incubatee-group" backLabel="My startups" title={group.name} />
        <AccessRestricted
          message="This startup is not assigned to you. If you need access, ask your TBI administrator."
          backTo="/incubatee-group"
          backLabel="Back to my startups"
        />
      </AppShell>
    );
  }

  // Mentors (and any non-member with access) get a read-only view:
  // team gates resolve through membership, never the URL alone.
  const manager = group.portfolioManager;
  const teamGroupRole = accessLevel === "member" ? userRole : "Developer";
  const canTeamWrite = accessLevel === "member" && canSubmitAsTeamMember(userRole);
  const canTeamDelete = accessLevel === "member" && canDeleteMilestone({ groupRole: userRole });
  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "workplan", label: "Workplan", count: workplan.length },
    { key: "requests", label: "Requests", count: requests.length },
    { key: "milestones", label: "Milestones" },
    { key: "mentorship", label: "Mentorship" },
    { key: "reports", label: "Reports" },
    { key: "documents", label: "Documents" },
    { key: "assessments", label: "Assessments" },
  ];

  const openRequestModal = () => {
    setRequestData({
      responsibleTeamMember: "",
      requestType: "",
      description: "",
      dateEntry: new Date().toISOString().split("T")[0],
      dateNeeded: "",
      resourceToolNeeded: "",
      prospectResourcePerson: "",
      priorityLevel: "",
      remarks: "",
      status: "Pending",
    });
    setIsModalOpen(true);
    setIsEditing(false);
    setModalError("");
  };

  return (
    <AppShell role={appRole} userName={userName}>
      <PageHeader
        backTo="/incubatee-group"
        backLabel="My startups"
        title={group.name}
        description={group.description}
        actions={<StatusBadge status={group.incubateeStatus || "Active"} />}
      />

      {group.imageUrl && (
        <img src={group.imageUrl} alt="" className="w-full h-32 object-cover rounded border border-line mb-5" />
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />
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
            <TeamSection members={groupMembers} portfolioManager={manager || null} />
            <section aria-label="Lifecycle status">
              <IncubationStatusPanel
                group={group}
                groupId={groupId}
                actorId={auth.currentUser?.uid}
                canManage={false}
                accentColor="bg-accent"
              />
            </section>
          </div>
        )}
        {tab === "requests" && (
          <RequestsTable
            requests={requests}
            handleEditRequest={handleEditRequest}
            handleDeleteRequest={handleDeleteRequest}
            openRequestModal={openRequestModal}
            groupRole={teamGroupRole} // Team-gated; mentors read (see teamGroupRole)
          />
        )}
        {tab === "workplan" && (
          <WorkplanTable
            workplan={workplan}
            groupMembers={groupMembers}
            handleAddTask={handleAddTask}
            handleEditTask={handleEditTask}
            handleDeleteTask={handleDeleteTask}
            handleUpdateStatus={handleUpdateStatus}
            groupRole={teamGroupRole} // Pass the user's groupRole
          />
        )}
        {tab === "milestones" && (
          <MilestonesPanel
            groupId={groupId}
            groupObjectives={group.objectives}
            actorId={auth.currentUser?.uid}
            canManage={canTeamWrite}
            canDelete={canTeamDelete}
            accentColor="bg-accent"
            onCount={setMilestoneCounts}
          />
        )}
        {tab === "mentorship" && (
          <MentorshipPanel
            groupId={groupId}
            actorId={auth.currentUser?.uid}
            canAssign={false}
            accentColor="bg-accent"
          />
        )}
        {tab === "reports" && (
          <ReportsPanel
            groupId={groupId}
            actorId={auth.currentUser?.uid}
            canSubmit={canTeamWrite}
            canReview={false}
            accentColor="bg-accent"
            onCount={setReportCount}
          />
        )}
        {tab === "documents" && (
          <DocumentsPanel
            scope="group"
            scopeId={groupId}
            owner={{ id: auth.currentUser?.uid, name: userName }}
            canUpload={canTeamWrite}
            canVerify={false}
            canDelete={false}
            onCount={setDocumentCount}
          />
        )}
        {tab === "assessments" && (
          <AssessmentsPanel
            groupId={groupId}
            actorId={auth.currentUser?.uid}
            canManage={false}
            canDelete={false}
            accentColor="bg-accent"
          />
        )}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={isEditing ? "Edit request" : "Request needs"}>
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-[550px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">
              {isEditing ? "Edit request" : "Request needs"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="tbi-label" htmlFor="req-member">
                  Responsible team member <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <select
                  id="req-member"
                  name="responsibleTeamMember"
                  value={requestData.responsibleTeamMember}
                  onChange={handleInputChange}
                  className="tbi-input"
                >
                  <option value="">Select Team Member</option>
                  {groupMembers.map((member) => (
                    <option
                      key={member.id}
                      value={`${member.name} ${member.lastname}`}
                    >
                      {member.name} {member.lastname}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="tbi-label" htmlFor="req-type">
                  Request type <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <select
                  id="req-type"
                  name="requestType"
                  value={requestData.requestType}
                  onChange={handleInputChange}
                  className="tbi-input"
                >
                  <option value="">Select Request Type</option>
                  <option value="Human Resource">Human Resource</option>
                  <option value="Financial Resource">Financial Request</option>
                  <option value="Other Resource">Other Request</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="tbi-label" htmlFor="req-need">
                  Specific needs <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <select
                    id="req-need"
                    name="resourceToolNeeded"
                    value={requestData.resourceToolNeeded}
                    onChange={handleInputChange}
                    className="tbi-input"
                    disabled={!requestData.requestType} // Disable if no requestType is selected
                >
                    <option value="">Select Resource/Tool Needed</option>
                    {requestData.requestType &&
                        resourceToolOptions[requestData.requestType]?.map((option, index) => (
                            <option key={index} value={option}>
                                {option}
                            </option>
                        ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="tbi-label" htmlFor="req-desc">Description</label>
                <textarea
                  id="req-desc"
                  name="description"
                  value={requestData.description}
                  onChange={handleInputChange}
                  className="tbi-input"
                  placeholder="Describe the request in detail"
                ></textarea>
              </div>

              <div>
                <label className="tbi-label" htmlFor="req-entry">Date entry</label>
                <input
                  id="req-entry"
                  type="date"
                  name="dateEntry"
                  value={requestData.dateEntry}
                  onChange={handleInputChange}
                  className="tbi-input text-slate-400"
                  readOnly
                />
              </div>
              <div>
                <label className="tbi-label" htmlFor="req-needed">
                  Date needed <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <input
                  id="req-needed"
                  type="date"
                  name="dateNeeded"
                  value={requestData.dateNeeded}
                  onChange={handleInputChange}
                  className="tbi-input"
                />
              </div>
              <div>
                <label className="tbi-label" htmlFor="req-person">
                  Prospect resource person
                </label>
                <input
                  id="req-person"
                  type="text"
                  name="prospectResourcePerson"
                  value={requestData.prospectResourcePerson}
                  onChange={handleInputChange}
                  className="tbi-input"
                  placeholder="Enter the name of resource person"
                />
              </div>
              <div>
                <label className="tbi-label" htmlFor="req-priority">
                  Priority level <span className="text-red-600" aria-hidden="true">*</span>
                </label>
                <select
                  id="req-priority"
                  name="priorityLevel"
                  value={requestData.priorityLevel}
                  onChange={handleInputChange}
                  className="tbi-input"
                >
                  <option value="">Select Priority Level</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              {modalError && (
                <p className="col-span-2 text-red-600 text-[13px]" role="alert">
                  {modalError}
                </p>
              )}
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-800 text-sm font-medium rounded hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    !requestData.responsibleTeamMember ||
                    !requestData.requestType ||
                    !requestData.resourceToolNeeded ||
                    !requestData.dateNeeded ||
                    !requestData.priorityLevel
                  }
                  className={`px-4 py-2 text-white text-sm font-medium rounded transition ${
                    !requestData.responsibleTeamMember ||
                    !requestData.requestType ||
                    !requestData.resourceToolNeeded ||
                    !requestData.dateNeeded ||
                    !requestData.priorityLevel
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-primary-color hover:bg-primary-deep"
                  }`}
                >
                  {isEditing ? "Update request" : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        danger={confirm?.danger || false}
        onConfirm={async () => {
          const run = confirm?.run;
          setConfirm(null);
          if (run) await run();
        }}
        onCancel={() => setConfirm(null)}
      />
    </AppShell>
  );
}

export default IncuViewGroup;