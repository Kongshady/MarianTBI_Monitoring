import React, { useState, useEffect } from "react";
import { db } from "../../config/marian-config.js";
import { doc, updateDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { MdDelete, MdArchive } from "react-icons/md";
import { useNavigate } from "react-router-dom"; // Import useNavigate

function EditGroupModal({ isOpen, onClose, group, onSave }) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [members, setMembers] = useState(group.members || []);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isConfirmChecked, setIsConfirmChecked] = useState(false);

  const navigate = useNavigate(); // Initialize navigate

  useEffect(() => {
    // Fetch users from Firestore and filter out those in a group or with specific roles
    const fetchAvailableUsers = async () => {
      try {
        const usersQuery = collection(db, "users");
        const querySnapshot = await getDocs(usersQuery);
        const users = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter(
            (user) =>
              (!user.groupId || user.groupId === null) && // Exclude users who are already in a group
              !["Portfolio Manager", "TBI Manager", "TBI Assistant"].includes(user.role) // Exclude specific roles
          );
        setAvailableUsers(users);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchAvailableUsers();
  }, []);

  const handleSave = async () => {
    // Update the group in Firestore
    const groupDocRef = doc(db, "groups", group.id);
    await updateDoc(groupDocRef, { name, description, members });
    onSave({ name, description, members });
    onClose();
  };

  const handleRemoveMember = async (memberId) => {
    // Remove the member from the group in Firestore
    const updatedMembers = members.filter((member) => member.id !== memberId);
    setMembers(updatedMembers);

    // Update the user's groupId to null in Firestore
    const userDocRef = doc(db, "users", memberId);
    await updateDoc(userDocRef, { groupId: null });
  };

  const handleAddMember = async () => {
    if (selectedUser) {
      const userToAdd = availableUsers.find((user) => user.id === selectedUser);
      const updatedMembers = [...members, userToAdd];
      setMembers(updatedMembers);

      // Update the user's groupId in Firestore
      const userDocRef = doc(db, "users", selectedUser);
      await updateDoc(userDocRef, { groupId: group.id });

      // Remove the added user from the dropdown
      setAvailableUsers(availableUsers.filter((user) => user.id !== selectedUser));
      setSelectedUser("");
    }
  };

  const handleDeleteGroup = async () => {
    try {
      // Delete the group from Firestore
      const groupDocRef = doc(db, "groups", group.id);
      await deleteDoc(groupDocRef);

      // Redirect the user to /view-group
      navigate("/admin-groups");
    } catch (error) {
      console.error("Error deleting group:", error);
    } finally {
      onClose(); // Close the modal after deletion
    }
  };

  const handleArchiveGroup = async () => {
    // Archive the group by setting isArchived to true in Firestore
    const groupDocRef = doc(db, "groups", group.id);
    await updateDoc(groupDocRef, { archived: true });
    onClose(); // Close the modal after archiving
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Main Edit Group Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
        <div className="bg-white p-6 rounded-sm shadow-lg w-2/6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">Edit Group</h2>
            <div className="flex gap-1">
              <button
                onClick={handleArchiveGroup}
                className="text-yellow-500 bg-gray-100 p-2 rounded-sm hover:bg-yellow-500 hover:text-white transition duration-300"
                title="Archive Group"
              >
                <MdArchive size={20} />
              </button>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-red-500 bg-gray-100 p-2 rounded-sm hover:bg-red-500 hover:text-white transition duration-300"
                title="Delete Group"
              >
                <MdDelete size={20} />
              </button>
            </div>
          </div>
          <div className="mb-1">
            <label className="text-sm">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-sm p-2"
            />
          </div>
          <div className="">
            <label className="text-sm mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-sm p-2"
              rows="4"
            ></textarea>
          </div>
          <div className="mb-2 p-2">
            <h3 className="text-sm font-medium mb-2 border-b text-center p-2">Members</h3>
            <div className="flex gap-2 mb-1">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="flex-1 border border-gray-300 rounded-sm p-2 text-sm"
              >
                <option value="">Add additional member</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} {user.lastname}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddMember}
                className="bg-primary-color text-white text-xs px-4 py-2 rounded-sm hover:bg-opacity-80"
              >
                Add
              </button>
            </div>
            <ul className="mb-2">
              {members.map((member) => (
                <li key={member.id} className="flex justify-between items-center p-1 hover:bg-gray-100 text-sm">
                  <span>{member.name} {member.lastname}</span>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-500 text-xs hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-sm hover:bg-gray-400 text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-primary-color text-white px-4 py-2 rounded-sm hover:bg-opacity-80 text-xs"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-sm shadow-lg w-1/4">
            <h2 className="text-lg font-bold mb-4 text-center text-red-500">Confirm Deletion</h2>
            <p className="text-sm mb-4">
              Are you sure you want to delete this group? This action cannot be undone.
            </p>
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="confirmDelete"
                checked={isConfirmChecked}
                onChange={(e) => setIsConfirmChecked(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="confirmDelete" className="text-sm">
                I understand the consequences of this action.
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-sm hover:bg-gray-400 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteGroup}
                disabled={!isConfirmChecked}
                className={`px-4 py-2 rounded-sm text-xs ${
                  isConfirmChecked
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default EditGroupModal;