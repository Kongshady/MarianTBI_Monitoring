import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../config/marian-config.js";
import { doc, query, where, onSnapshot, collection, updateDoc, getDoc, getDocs } from "firebase/firestore";
import AdminSidebar from "../sidebar/AdminSidebar.jsx";
import { MdEdit } from "react-icons/md";
import EditGroupModal from "../modals/EditGroupModal.jsx";

function AdViewGroups() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [requests, setRequests] = useState([]);
  const [workplan, setWorkplan] = useState([]);
  const [isRequestsTableOpen, setIsRequestsTableOpen] = useState(true);
  const [isWorkplanTableOpen, setIsWorkplanTableOpen] = useState(false);
  const [portfolioManager, setPortfolioManager] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [groups, setGroups] = useState([]); // State for all groups

  useEffect(() => {
    const fetchGroup = () => {
      const groupDocRef = doc(db, "groups", groupId);
      const unsubscribeGroup = onSnapshot(groupDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const groupData = docSnapshot.data();

          // Fetch member details
          const membersWithDetails = await Promise.all(
            groupData.members.map(async (member) => {
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
          if (groupData.portfolioManager) {
            const portfolioManagerDocRef = doc(db, "users", groupData.portfolioManager.id);
            const portfolioManagerDoc = await getDoc(portfolioManagerDocRef);
            if (portfolioManagerDoc.exists()) {
              setPortfolioManager(portfolioManagerDoc.data());
            }
          }
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

  const handleSaveGroup = async (updatedGroup) => {
    const groupDocRef = doc(db, "groups", groupId);
    await updateDoc(groupDocRef, updatedGroup);
  };

  if (!group) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex">
      <AdminSidebar />
      <div className="flex flex-col items-start h-screen w-full p-10 overflow-y-auto">
        <div className="flex justify-between w-full">
          <h1 className="text-4xl font-bold mb-2">{group.name}</h1>
          <div>
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="bg-primary-color text-white p-2 rounded-sm text-sm hover:bg-opacity-80 transition mr-2 flex flex-row items-center gap-2"
            >
              <MdEdit className="text-sm" />
              Edit Group
            </button>
          </div>
        </div>
        <p className="text-sm italic">{group.description}</p>
        {group.imageUrl && <img src={group.imageUrl} alt={group.name} className="mt-2 w-full h-40 object-cover rounded-lg" />}
        <div className="mt-2 flex flex-col justify-between items-start w-full gap-4">
          {/* Members List */}
          <div>
            <h3 className="font-bold text-sm">Members:</h3>
            <ul className="text-sm">
              {group.members.map((member) => (
                <li key={member.id}>
                  {member.name} {member.lastname} - {member.groupRole}
                </li>
              ))}
            </ul>
            {portfolioManager && (
              <div className="mt-2">
                <h3 className="font-bold text-sm">Portfolio Manager:</h3>
                <p className="text-sm">{portfolioManager.name} {portfolioManager.lastname}</p>
              </div>
            )}
          </div>

          {/* Cards for workplan statistics */}
          <div className="flex gap-2">
            {/* Card for total number of tasks */}
            <div className="bg-blue-500 text-white text-center p-2 rounded-sm shadow-md">
              <h3 className="text-xs">No. of Tasks</h3>
              <p className="text-md font-semibold mt-1">{workplan.length}</p>
            </div>
            {/* Card for pending tasks */}
            <div className="bg-yellow-500 text-white text-center p-2 rounded-sm shadow-md">
              <h3 className="text-xs">Pending Tasks</h3>
              <p className="text-md font-semibold mt-1">
                {workplan.filter((task) => task.status === "Pending").length}
              </p>
            </div>
            {/* Card for completed tasks */}
            <div className="bg-green-500 text-white text-center p-2 rounded-sm shadow-md">
              <h3 className="text-xs">Completed Tasks</h3>
              <p className="text-md font-semibold mt-1">
                {workplan.filter((task) => task.status === "Completed").length}
              </p>
            </div>
            {/* Card for overall workplan completion */}
            <div
              className={`text-white text-center p-2 rounded-sm shadow-md ${workplan.length > 0
                ? Math.round(
                  (workplan.filter((task) => task.status === "Completed").length / workplan.length) * 100
                ) >= 75
                  ? "bg-green-500"
                  : Math.round(
                    (workplan.filter((task) => task.status === "Completed").length / workplan.length) * 100
                  ) >= 50
                    ? "bg-yellow-500"
                    : "bg-red-500"
                : "bg-gray-500"
                }`}
            >
              <h3 className="text-xs">Total Progress Completion</h3>
              <p className="text-md font-semibold mt-1">
                {workplan.length > 0
                  ? `${Math.round(
                    (workplan.filter((task) => task.status === "Completed").length / workplan.length) * 100
                  )}%`
                  : "0%"}
              </p>
            </div>
          </div>
        </div>

        {/* Toggle Buttons for Requests and Workplan */}
        <div className="flex mt-4">
          <button
            onClick={() => {
              setIsRequestsTableOpen(true);
              setIsWorkplanTableOpen(false);
            }}
            className={`${isRequestsTableOpen
              ? "bg-primary-color text-white"
              : "bg-white border border-primary-color"
              } text-primary-color px-4 py-2 text-xs hover:bg-opacity-80 transition`}
          >
            Group Requests
          </button>
          <button
            onClick={() => {
              setIsWorkplanTableOpen(true);
              setIsRequestsTableOpen(false);
            }}
            className={`${isWorkplanTableOpen
              ? "bg-primary-color text-white"
              : "bg-white border border-primary-color"
              } text-primary-color px-4 py-2 text-xs hover:bg-opacity-80 transition`}
          >
            Workplan
          </button>
        </div>

        {/* Requests Table */}
        {isRequestsTableOpen && (
          <div className="mt-3 w-full">
            <p className="font-bold mb-2">Requested Needs</p>
            <table className="w-full bg-white border-gray-200 text-xs text-left">
              <thead className="sticky top-0 bg-primary-color text-white">
                <tr>
                  <th className="py-2 px-4">Responsible Team Member</th>
                  <th className="py-2 px-4">Request Type</th>
                  <th className="py-2 px-4">Description</th>
                  <th className="py-2 px-4">Date Entry</th>
                  <th className="py-2 px-4">Date Needed</th>
                  <th className="py-2 px-4">Specific Needs</th>
                  <th className="py-2 px-4">Prospect Resource Person</th>
                  <th className="py-2 px-4">Priority Level</th>
                  <th className="py-2 px-4">Remarks</th>
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? (
                  [...requests]
                    .sort((a, b) => {
                      const priorityOrder = { HIGH: 1, MEDIUM: 2, LOW: 3 };
                      if (a.status === "Done" && b.status !== "Done") return 1;
                      if (a.status !== "Done" && b.status === "Done") return -1;
                      if (priorityOrder[a.priorityLevel] !== priorityOrder[b.priorityLevel]) {
                        return priorityOrder[a.priorityLevel] - priorityOrder[b.priorityLevel];
                      }
                      return new Date(a.dateEntry) - new Date(b.dateEntry); // Sort by date entry if priority and status are the same
                    })
                    .map((request, index) => (
                      <tr
                        key={request.id}
                        className={`${
                          request.status === "Done" ? "bg-gray-200 opacity-70" : index % 2 === 0 ? "bg-white" : "bg-gray-100"
                        }`}
                      >
                        <td className="py-2 px-4">{request.responsibleTeamMember}</td>
                        <td className="py-2 px-4">{request.requestType}</td>
                        <td className="py-2 px-4">{request.description}</td>
                        <td className="py-2 px-4">
                          {request.dateEntry
                            ? new Date(request.dateEntry.seconds * 1000).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                            : "N/A"}
                        </td>
                        <td className="py-2 px-4">
                          {request.dateNeeded
                            ? new Date(request.dateNeeded).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                            : "N/A"}
                        </td>
                        <td className="py-2 px-4">{request.resourceToolNeeded}</td>
                        <td className="py-2 px-4">{request.prospectResourcePerson}</td>
                        <td
                          className={`py-2 px-4 font-bold ${
                            request.priorityLevel === "HIGH"
                              ? "text-red-500"
                              : request.priorityLevel === "MEDIUM"
                              ? "text-yellow-500"
                              : "text-green-500"
                          }`}
                        >
                          {request.priorityLevel}
                        </td>
                        <td className="py-2 px-4">{request.remarks || "N/A"}</td>
                        <td
                          className={`py-2 px-4 font-semibold ${
                            request.status === "Pending"
                              ? "text-red-500"
                              : request.status === "In Progress"
                              ? "text-yellow-500"
                              : request.status === "Done"
                              ? "text-green-500"
                              : "text-gray-500"
                          }`}
                        >
                          {request.status}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="py-2 px-4 text-center" colSpan="10">
                      No requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Workplan Table */}
        {isWorkplanTableOpen && (
          <div className="mt-3 w-full">
              <p className="font-bold mb-2">Project Workplan</p>

            <table className="w-full bg-white border-gray-200 text-xs text-left">
              <thead className="sticky top-0 bg-primary-color text-white">
                <tr>
                  <th className="py-2 px-4 text-left">Task Name</th>
                  <th className="py-2 px-4">Assigned To</th>
                  <th className="py-2 px-4">Start Date</th>
                  <th className="py-2 px-4">End Date</th>
                  <th className="py-2 px-4">Priority Level</th> {/* New Priority Level Column */}
                  <th className="py-2 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {workplan.length > 0 ? (
                  workplan
                    .slice() // Create a shallow copy to avoid mutating the original array
                    .sort((a, b) => {
                      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
                      if (a.status === "Completed" && b.status !== "Completed") return 1;
                      if (a.status !== "Completed" && b.status === "Completed") return -1;
                      if (priorityOrder[a.priorityLevel] !== priorityOrder[b.priorityLevel]) {
                        return priorityOrder[a.priorityLevel] - priorityOrder[b.priorityLevel];
                      }
                      return new Date(a.startDate) - new Date(b.startDate); // Sort by start date if priority and status are the same
                    })
                    .map((task, index) => (
                      <tr
                        key={task.id}
                        className={`${
                          task.status === "Completed" ? "bg-gray-200 opacity-70" : index % 2 === 0 ? "bg-white" : "bg-gray-100"
                        }`}
                      >
                        <td className="p-2 text-left">{task.taskName}</td>
                        <td className="p-2">{task.assignedTo}</td>
                        <td className="p-2">
                          {task.startDate
                            ? new Date(task.startDate).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                            : "N/A"}
                        </td>
                        <td className="p-2">
                          {task.endDate
                            ? new Date(task.endDate).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                            : "N/A"}
                        </td>
                        <td
                          className={`p-2 font-bold ${
                            task.priorityLevel === "High"
                              ? "text-red-500"
                              : task.priorityLevel === "Medium"
                              ? "text-yellow-500"
                              : "text-green-500"
                          }`}
                        >
                          {task.priorityLevel}
                        </td>
                        <td
                          className={`p-2 font-semibold ${
                            task.status === "Pending"
                              ? "text-red-500"
                              : task.status === "In Progress"
                              ? "text-yellow-500"
                              : task.status === "Completed"
                              ? "text-green-500"
                              : "text-gray-500"
                          }`}
                        >
                          {task.status}
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="py-2 px-4 text-center" colSpan="6">
                      No tasks found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <EditGroupModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        group={group}
        onSave={handleSaveGroup}
        groups={groups} // Pass groups as a prop
      />
    </div>
  );
}

export default AdViewGroups;