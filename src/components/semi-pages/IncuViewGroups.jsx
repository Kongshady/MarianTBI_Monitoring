import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../../config/marian-config.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import IncubateeSidebar from "../sidebar/IncubateeSidebar.jsx";
import RequestsTable from "../modals/RequestsTable.jsx";
import WorkplanTable from "../modals/WorkplanTable.jsx";

function IncuViewGroup() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestsTableOpen, setIsRequestsTableOpen] = useState(false);
  const [isWorkplanTableOpen, setIsWorkplanTableOpen] = useState(true);
  const [requests, setRequests] = useState([]);
  const [workplan, setWorkplan] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [userRole, setUserRole] = useState(""); // Define userRole
  const [requestData, setRequestData] = useState({
    responsibleTeamMember: "",
    requestType: "Technical Request",
    description: "",
    dateEntry: new Date().toISOString().split("T")[0],
    dateNeeded: "",
    resourceToolNeeded: "",
    prospectResourcePerson: "",
    priorityLevel: "low",
    remarks: "",
    status: "Pending",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentRequestId, setCurrentRequestId] = useState(null);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroup({ id: groupDoc.id, ...groupData });
          setGroupMembers(groupData.members);

          // Determine the logged-in user's groupRole
          const user = auth.currentUser;
          if (user) {
            const userInGroup = groupData.members.find((member) => member.id === user.uid);
            if (userInGroup) {
              setUserRole(userInGroup.groupRole); // Set the user's groupRole
            }
          }
        }
      } catch (error) {
        console.error("Error fetching group:", error);
      }
    };

    fetchGroup();
  }, [groupId]);

  useEffect(() => {
    if (isRequestsTableOpen) {
      const q = query(collection(db, "requests"), where("groupId", "==", groupId));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        setRequests(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      return () => unsubscribe();
    }
  }, [groupId, isRequestsTableOpen]);

  useEffect(() => {
    if (isWorkplanTableOpen) {
      const q = query(collection(db, "workplan"), where("groupId", "==", groupId));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        setWorkplan(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      return () => unsubscribe();
    }
  }, [groupId, isWorkplanTableOpen]);

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
    try {
      if (isEditing) {
        // Update an existing request
        await updateDoc(doc(db, "requests", currentRequestId), requestData);
        alert("Request updated successfully!");
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

        alert("Request submitted successfully!");
      }

      setIsModalOpen(false);
      setIsEditing(false);
      setCurrentRequestId(null);
    } catch (error) {
      console.error("Error submitting request:", error);
      alert(`Error submitting request: ${error.message}`);
    }
  };

  const handleEditRequest = (requestId) => {
    const requestToEdit = requests.find((request) => request.id === requestId);
    setRequestData(requestToEdit);
    setCurrentRequestId(requestId);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteRequest = async (requestId) => {
    try {
      await deleteDoc(doc(db, "requests", requestId));
      alert("Request deleted successfully!");
    } catch (error) {
      console.error("Error deleting request:", error);
      alert("Error deleting request. Please try again.");
    }
  };

  const handleAddTask = async (newTask) => {
    try {
      await addDoc(collection(db, "workplan"), {
        ...newTask,
        groupId,
        status: "Pending",
      });
      alert("Task added successfully!");
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const handleEditTask = async (updatedTask) => {
    try {
      const taskDoc = doc(db, "workplan", updatedTask.id);
      await updateDoc(taskDoc, updatedTask);
      alert("Task updated successfully!");
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const taskDoc = doc(db, "workplan", taskId);
      await deleteDoc(taskDoc);
      alert("Task deleted successfully!");
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      const taskDoc = doc(db, "workplan", taskId);
      await updateDoc(taskDoc, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  if (!group) {
    return (
      <div className="flex items-center justify-center h-svh">
        Loading... Please Wait.
      </div>
    );
  }

  return (
    <div className="flex">
      <IncubateeSidebar />
      <div className="flex flex-col items-start h-screen w-full p-10 overflow-y-auto">
        <h1 className="text-4xl font-bold mb-2">{group.name}</h1>
        <p className="text-sm italic">{group.description}</p>
        {group.imageUrl && (
          <img
            src={group.imageUrl}
            alt={group.name}
            className="mt-2 w-full h-40 object-cover rounded-lg"
          />
        )}
        <div className="mt-2 flex flex-col items-start justify-between gap-4 w-full">
          <div>
            <h3 className="font-bold text-md">Members:</h3>
            <ul className="text-sm">
              {group.members.map((member) => (
                <li key={member.id}>
                  {member.name} {member.lastname} - {member.groupRole}
                </li>
              ))}
            </ul>
          </div>

          {/* Cards for workplan statistics */}
          <div className="flex justify-end gap-2">
            <div className="bg-blue-500 text-white text-center p-2 rounded-sm shadow-md ">
              <h3 className="text-xs">No. of Tasks</h3>
              <p className="text-md font-semibold mt-1">{workplan.length}</p>
            </div>
            <div className="bg-yellow-500 text-white text-center p-2 rounded-sm shadow-md ">
              <h3 className="text-xs">Pending Tasks</h3>
              <p className="text-md font-semibold mt-1">
                {workplan.filter((task) => task.status === "Pending").length}
              </p>
            </div>
            <div className="bg-green-500 text-white text-center p-2 rounded-sm shadow-md ">
              <h3 className="text-xs">Completed Tasks</h3>
              <p className="text-md font-semibold mt-1">
                {workplan.filter((task) => task.status === "Completed").length}
              </p>
            </div>
            <div
              className={`text-white text-center p-2 rounded-sm shadow-md  ${
                workplan.length > 0
                  ? Math.round(
                      (workplan.filter((task) => task.status === "Completed").length /
                        workplan.length) *
                        100
                    ) >= 75
                    ? "bg-green-500"
                    : Math.round(
                        (workplan.filter((task) => task.status === "Completed").length /
                          workplan.length) *
                          100
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
                      (workplan.filter((task) => task.status === "Completed").length /
                        workplan.length) *
                        100
                    )}%`
                  : "0%"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-row-reverse mt-4">
          <button
            onClick={() => {
              setIsRequestsTableOpen(true);
              setIsWorkplanTableOpen(false);
            }}
            className={`${
              isRequestsTableOpen
                ? "bg-secondary-color text-white"
                : "bg-white border border-secondary-color"
            } text-secondary-color px-4 py-2 text-xs hover:bg-opacity-80 transition`}
          >
            Group Requests
          </button>
          <button
            onClick={() => {
              setIsWorkplanTableOpen(true);
              setIsRequestsTableOpen(false);
            }}
            className={`${
              isWorkplanTableOpen
                ? "bg-secondary-color text-white"
                : "bg-white border border-secondary-color"
            } text-secondary-color px-4 py-2 text-xs hover:bg-opacity-80 transition`}
          >
            Workplan
          </button>
        </div>
        {isRequestsTableOpen && (
          <RequestsTable
            requests={requests}
            handleEditRequest={handleEditRequest}
            handleDeleteRequest={handleDeleteRequest}
            openRequestModal={() => {
              setRequestData({
                responsibleTeamMember: "",
                requestType: "Technical Request",
                description: "",
                dateEntry: new Date().toISOString().split("T")[0],
                dateNeeded: "",
                resourceToolNeeded: "",
                prospectResourcePerson: "",
                priorityLevel: "low",
                remarks: "",
                status: "Pending",
              });
              setIsModalOpen(true);
              setIsEditing(false);
            }}
            groupRole={userRole} // Pass the user's groupRole
          />
        )}
        {isWorkplanTableOpen && (
          <WorkplanTable
            workplan={workplan}
            groupMembers={groupMembers}
            handleAddTask={handleAddTask}
            handleEditTask={handleEditTask}
            handleDeleteTask={handleDeleteTask}
            handleUpdateStatus={handleUpdateStatus}
            groupRole={userRole} // Pass the user's groupRole
          />
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[550px]">
            <h2 className="text-xl font-bold mb-4 text-center">
              {isEditing ? "Edit Request" : "Request Needs"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-sm">
                  Responsible Team Member <span className="text-red-500">*</span>
                </label>
                <select
                  name="responsibleTeamMember"
                  value={requestData.responsibleTeamMember}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
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
                <label className="block mb-1 text-sm">
                  Request Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="requestType"
                  value={requestData.requestType}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                >
                  <option value="">Select Request Type</option>
                  <option value="Human Resource">Human Resource</option>
                  <option value="Financial Resource">Financial Request</option>
                  <option value="Other Resource">Other Request</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-sm">
                  Specific Needs <span className="text-red-500">*</span>
                </label>
                <select
                    name="resourceToolNeeded"
                    value={requestData.resourceToolNeeded}
                    onChange={handleInputChange}
                    className="w-full p-2 border text-sm"
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
                <label className="block mb-1 text-sm">Description</label>
                <textarea
                  name="description"
                  value={requestData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  placeholder="Describe the request in detail"
                ></textarea>
              </div>

              <div>
                <label className="block mb-1 text-sm">Date Entry</label>
                <input
                  type="date"
                  name="dateEntry"
                  value={requestData.dateEntry}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm text-gray-400"
                  readOnly
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">
                  Date Needed <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dateNeeded"
                  value={requestData.dateNeeded}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">
                  Prospect Resource Person
                </label>
                <input
                  type="text"
                  name="prospectResourcePerson"
                  value={requestData.prospectResourcePerson}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  placeholder="Enter the name of resource person"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">
                  Priority Level <span className="text-red-500">*</span>
                </label>
                <select
                  name="priorityLevel"
                  value={requestData.priorityLevel}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                >
                  <option value="">Select Priority Level</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white text-sm rounded-sm hover:bg-gray-600 transition"
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
                  className={`px-4 py-2 text-white text-sm rounded-sm transition ${
                    !requestData.responsibleTeamMember ||
                    !requestData.requestType ||
                    !requestData.resourceToolNeeded ||
                    !requestData.dateNeeded ||
                    !requestData.priorityLevel
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-secondary-color hover:bg-opacity-80"
                  }`}
                >
                  {isEditing ? "Update Request" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default IncuViewGroup;