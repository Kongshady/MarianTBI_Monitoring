import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../../config/marian-config.js";
import { doc, getDoc, addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc, updateDoc, onSnapshot } from "firebase/firestore";
import IncubateeSidebar from "../sidebar/IncubateeSidebar.jsx";
import { FaEdit, FaTrash } from "react-icons/fa";

function IncuViewGroup() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestsTableOpen, setIsRequestsTableOpen] = useState(false); // State to manage requests table visibility
  const [requests, setRequests] = useState([]); // State to store user's requests
  const [groupMembers, setGroupMembers] = useState([]); // State to store group members
  const [requestData, setRequestData] = useState({
    responsibleTeamMember: "",
    requestType: "Technical Request", // Default request type
    description: "",
    dateEntry: new Date().toISOString().split("T")[0],
    dateNeeded: "",
    resourceToolNeeded: "",
    prospectResourcePerson: "",
    priorityLevel: "low",
    remarks: "",
    status: "Pending" // Default status
  });
  const [isEditing, setIsEditing] = useState(false); // State to manage edit mode
  const [currentRequestId, setCurrentRequestId] = useState(null); // State to store the current request ID being edited
  const [userRole, setUserRole] = useState(""); // State to store the user's role

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          setGroup({ id: groupDoc.id, ...groupData });
          setGroupMembers(groupData.members); // Set group members
          const user = auth.currentUser;
          if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              setUserRole(userData.role); // Set the user's role
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
        setRequests(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });

      return () => unsubscribe();
    }
  }, [groupId, isRequestsTableOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRequestData((prevData) => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        // Update the existing request
        await updateDoc(doc(db, "requests", currentRequestId), requestData);
        alert("Request updated successfully!");
      } else {
        // Add a new request
        await addDoc(collection(db, "requests"), {
          ...requestData,
          dateEntry: serverTimestamp(),
          groupId
        });

        // Fetch the group details to get the portfolio manager
        const groupDoc = await getDoc(doc(db, "groups", groupId));
        if (groupDoc.exists()) {
          const groupData = groupDoc.data();
          const portfolioManagerId = groupData.portfolioManager.id;

          // Create a notification for the portfolio manager
          await addDoc(collection(db, "notifications"), {
            userId: portfolioManagerId,
            message: `Group Request: A new request has been submitted from the group "${groupData.name}".`,
            timestamp: serverTimestamp(),
            read: false
          });
        }

        alert("Request submitted successfully!");
      }

      setIsModalOpen(false);
      setIsEditing(false);
      setCurrentRequestId(null);
    } catch (error) {
      console.error("Error submitting request:", error);
      alert("Error submitting request. Please try again.");
    }
  };

  const handleEditRequest = (requestId) => {
    const requestToEdit = requests.find(request => request.id === requestId);
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

  if (!group) {
    return <div className="flex items-center justify-center h-svh">
      Loading... Please Wait.
    </div>;
  }

  return (
    <div className="flex">
      <IncubateeSidebar />
      <div className="flex flex-col items-start h-screen w-full p-10">
        <h1 className="text-4xl font-bold mb-5">{group.name}</h1>
        <p className="text-sm">{group.description}</p>
        {group.imageUrl && <img src={group.imageUrl} alt={group.name} className="mt-2 w-full h-40 object-cover rounded-lg" />}
        <div className="mt-2">
          <h3 className="font-bold text-sm">Members:</h3>
          <ul className="text-sm">
            {group.members.map(member => (
              <li key={member.id}>{member.name} {member.lastname} - {member.role}</li>
            ))}
          </ul>
        </div>
        {userRole === "Project Manager" && (
          <div className="flex flex-row gap-2">
            <button
              onClick={() => {
                setRequestData({
                  responsibleTeamMember: "",
                  requestType: "Technical Request", // Default request type
                  description: "",
                  dateEntry: new Date().toISOString().split("T")[0],
                  dateNeeded: "",
                  resourceToolNeeded: "",
                  prospectResourcePerson: "",
                  priorityLevel: "low",
                  remarks: "",
                  status: "Pending"
                });
                setIsModalOpen(true);
                setIsEditing(false);
              }}
              className="mt-4 bg-secondary-color text-white px-4 p-2 text-xs rounded-sm hover:bg-opacity-80 transition"
            >
              Request Needs
            </button>
            <button
              onClick={() => setIsRequestsTableOpen(!isRequestsTableOpen)}
              className="mt-4 bg-secondary-color text-white px-4 p-2 text-xs rounded-sm hover:bg-opacity-80 transition"
            >
              {isRequestsTableOpen ? "Hide My Requests" : "Show My Requests"}
            </button>
          </div>
        )}
        {isRequestsTableOpen && (
          <div className="overflow-y-auto h-96 mt-2 w-full">
            <table className="min-w-full bg-white border border-gray-200 text-xs">
              <thead className="sticky top-0 bg-secondary-color text-white">
                <tr>
                  <th className="py-2 px-4 border-b">Team Member</th>
                  <th className="py-2 px-4 border-b">Request Type</th>
                  <th className="py-2 px-4 border-b">Date Entry</th>
                  <th className="py-2 px-4 border-b">Date Needed</th>
                  <th className="py-2 px-4 border-b">Resource/Tool Needed</th>
                  <th className="py-2 px-4 border-b">Prospect Resource Person</th>
                  <th className="py-2 px-4 border-b">Priority Level</th>
                  <th className="py-2 px-4 border-b">Status</th>
                  <th className="py-2 px-4 border-b">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.length > 0 ? (
                  requests.map(request => (
                    <tr key={request.id} className="text-center">
                      <td className="py-2 px-4 border-b">{request.responsibleTeamMember}</td>
                      <td className="py-2 px-4 border-b">{request.requestType}</td>
                      <td className="py-2 px-4 border-b">{request.dateEntry ? new Date(request.dateEntry.seconds * 1000).toLocaleDateString() : "N/A"}</td>
                      <td className="py-2 px-4 border-b">{request.dateNeeded}</td>
                      <td className="py-2 px-4 border-b">{request.resourceToolNeeded}</td>
                      <td className="py-2 px-4 border-b">{request.prospectResourcePerson}</td>
                      <td className="py-2 px-4 border-b">{request.priorityLevel}</td>
                      <td className="py-2 px-4 border-b font-bold text-secondary-color">{request.status}</td>
                      <td className="py-2 px-4 border-b">
                        <button
                          onClick={() => handleEditRequest(request.id)}
                          className="bg-secondary-color text-white px-2 py-1 rounded-sm hover:bg-opacity-80 transition"
                        >
                          <FaEdit />
                        </button>
                        <button
                          onClick={() => handleDeleteRequest(request.id)}
                          className="bg-red-500 text-white px-2 py-1 rounded-sm hover:bg-opacity-80 transition ml-2"
                        >
                          <FaTrash />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 px-4 border-b text-center" colSpan="9">No requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[550px]">
            <h2 className="text-xl font-bold mb-4 text-center">{isEditing ? "Edit Request" : "Request Needs"}</h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-sm">Responsible Team Member</label>
                <select
                  name="responsibleTeamMember"
                  value={requestData.responsibleTeamMember}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                >
                  <option value="">Select Team Member</option>
                  {groupMembers.map(member => (
                    <option key={member.id} value={`${member.name} ${member.lastname}`}>{member.name} {member.lastname}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-sm">Request Type</label>
                <select
                  name="requestType"
                  value={requestData.requestType}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                >
                  <option value="Technical Request">Technical Request</option>
                  <option value="Expert Request">Expert Request</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-sm">Description</label>
                <textarea
                  name="description"
                  value={requestData.description}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                ></textarea>
              </div>
              <div>
                <label className="block mb-1 text-sm">Resource/Tool Needed</label>
                <input
                  type="text"
                  name="resourceToolNeeded"
                  value={requestData.resourceToolNeeded}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                />
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
                <label className="block mb-1 text-sm">Date Needed</label>
                <input
                  type="date"
                  name="dateNeeded"
                  value={requestData.dateNeeded}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Prospect Resource Person</label>
                <input
                  type="text"
                  name="prospectResourcePerson"
                  value={requestData.prospectResourcePerson}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">Priority Level</label>
                <select
                  name="priorityLevel"
                  value={requestData.priorityLevel}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block mb-1 text-sm">Remarks</label>
                <textarea
                  name="remarks"
                  value={requestData.remarks}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                ></textarea>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white text-sm rounded-sm hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-secondary-color text-white text-sm rounded-sm hover:bg-opacity-80 transition"
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