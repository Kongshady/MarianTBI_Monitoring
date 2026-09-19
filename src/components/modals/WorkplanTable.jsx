import { useMemo, useState } from "react";
import { FaEdit, FaTrash } from "react-icons/fa";
import { db } from "../../config/marian-config"; // Import Firestore configuration
import { addDoc, collection, serverTimestamp } from "firebase/firestore"; // Import Firestore methods
import StatusBadge from "../ui/StatusBadge.jsx";
import SectionEmptyState from "../groups/SectionEmptyState.jsx";
import {
  comparePriority,
  formatDateSafe,
  normalizePriority,
  normalizeTaskStatus,
  toDateSafe,
  TASK_STATUS,
} from "../../lib/domain.js";
import { canSubmitAsTeamMember, isProjectManager } from "../../lib/permissions.js";

const WorkplanTable = ({ workplan, groupMembers, handleAddTask, handleEditTask, handleDeleteTask, handleUpdateStatus, groupRole }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskData, setTaskData] = useState({
    taskName: "",
    assignedTo: "",
    startDate: "",
    endDate: "",
    priorityLevel: "Low", // Default priority level
  });
  const [isEditing, setIsEditing] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setTaskData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditing) {
      handleEditTask(taskData);
      setIsModalOpen(false); // Close the modal after editing
      setIsEditing(false);
    } else {
      handleAddTask(taskData);
      // Clear the inputs after adding a task
      setTaskData({
        taskName: "",
        assignedTo: "",
        startDate: "",
        endDate: "",
        priorityLevel: "Low", // Reset priority level
      });
    }
  };

  const openEditModal = (task) => {
    setTaskData(task);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const notifyAssignedMember = async (task) => {
    try {
      // Find the assigned member
      const assignedMember = groupMembers.find(
        (member) => `${member.name} ${member.lastname}` === task.assignedTo
      );

      if (assignedMember) {
        // Create a notification for the assigned member (plain text; rendered safely)
        await addDoc(collection(db, "notifications"), {
          userId: assignedMember.id, // ID of the assigned member
          message: `Task Update: Your task ${task.taskName} has been marked as Completed by your Project Manager.`,
          createdAt: serverTimestamp(), // Use Firestore's serverTimestamp
          read: false,
          type: "task-status",
          groupId: task.groupId,
        });
      }
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      // Update the task status
      await handleUpdateStatus(taskId, newStatus);

      // Check if the new status is "Completed"
      if (newStatus === "Completed") {
        const task = workplan.find((task) => task.id === taskId);
        if (task) {
          await notifyAssignedMember(task); // Notify the assigned member
        }
      }
    } catch (error) {
      console.error("Error updating task status or sending notification:", error);
    }
  };

  const canWrite = canSubmitAsTeamMember(groupRole);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Sort tasks by priority level (High > Medium > Low) and then by status (Completed at the bottom)
    return [...(workplan || [])]
      .filter((task) => {
        if (statusFilter !== "all" && normalizeTaskStatus(task.status) !== statusFilter) return false;
        if (!q) return true;
        return [task.taskName, task.assignedTo].filter(Boolean).join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aDone = normalizeTaskStatus(a.status) === TASK_STATUS.COMPLETED;
        const bDone = normalizeTaskStatus(b.status) === TASK_STATUS.COMPLETED;
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        if (comparePriority(a.priorityLevel, b.priorityLevel) !== 0) {
          return comparePriority(a.priorityLevel, b.priorityLevel);
        }
        return (toDateSafe(a.startDate)?.getTime() || 0) - (toDateSafe(b.startDate)?.getTime() || 0);
      });
  }, [workplan, search, statusFilter]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <h2 className="text-base font-semibold mr-auto">Workplan</h2>
        {canWrite && (
          <button
            onClick={() => {
              setTaskData({
                taskName: "",
                assignedTo: "",
                startDate: "",
                endDate: "",
                priorityLevel: "Low", // Default priority level
              });
              setIsEditing(false);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-accent text-white text-xs font-medium rounded hover:bg-opacity-80 transition"
          >
            + Add task
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[150px] sm:flex-none">
          <label htmlFor="workplanSearch" className="tbi-label">Search</label>
          <input
            id="workplanSearch"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Task or assignee"
            className="tbi-input sm:max-w-64"
          />
        </div>
        <div>
          <label htmlFor="workplanStatus" className="tbi-label">Status</label>
          <select
            id="workplanStatus"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
      <table className="tbi-table min-w-[760px]">
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Assigned to</th>
            <th scope="col">Start</th>
            <th scope="col">Due</th>
            <th scope="col">Priority</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((task) => (
              <tr key={task.id}>
                  <td className="font-medium text-slate-900">{task.taskName}</td>
                  <td>{task.assignedTo}</td>
                  <td>
                    {formatDateSafe(task.startDate)}
                  </td>
                  <td>
                    {formatDateSafe(task.endDate)}
                  </td>
                  <td>
                    <StatusBadge status={normalizePriority(task.priorityLevel)} />
                  </td>
                  <td>
                    {/* Allow only Project Manager or Assigned Member to edit the status */}
                    {isProjectManager(groupRole) || groupMembers.some((member) => `${member.name} ${member.lastname}` === task.assignedTo) ? (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task.id, e.target.value)}
                        className="tbi-input !w-auto text-[13px]"
                        aria-label={`Status for ${task.taskName}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
                    ) : (
                      <StatusBadge status={task.status} />
                    )}
                  </td>
                  <td>
                    {/* Restrict actions for System Analyst and Developer */}
                    {canWrite && (
                      <span className="flex justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(task)}
                          className="px-2.5 py-1.5 bg-accent text-white rounded text-xs hover:bg-opacity-80 transition disabled:opacity-60"
                          disabled={task.status === "Completed"} // Disable edit for completed tasks
                          aria-label={`Edit ${task.taskName}`}
                        >
                          <FaEdit aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="px-2.5 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition"
                          aria-label={`Delete ${task.taskName}`}
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <SectionEmptyState
          title={(workplan || []).length === 0 ? "No tasks yet" : "No tasks match"}
          message={
            (workplan || []).length === 0
              ? canWrite
                ? "Break the work into tasks with owners and due dates to get the startup moving."
                : "No tasks have been planned for this startup yet."
              : "Try a different search term or status filter."
          }
          action={
            (workplan || []).length === 0 && canWrite ? (
              <button
                onClick={() => {
                  setTaskData({ taskName: "", assignedTo: "", startDate: "", endDate: "", priorityLevel: "Low" });
                  setIsEditing(false);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-accent text-white text-xs font-medium rounded hover:bg-opacity-80 transition"
              >
                + Add task
              </button>
            ) : null
          }
        />
      )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-lg w-[550px]">
            <h2 className="text-xl font-bold mb-4 text-center">
              {isEditing ? "Edit Task" : "Add Task"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-sm">Task Name</label>
                <input
                  type="text"
                  name="taskName"
                  value={taskData.taskName}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm">Assigned Member</label>
                <select
                  name="assignedTo"
                  value={taskData.assignedTo}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  required
                >
                  <option value="">Select Member</option>
                  {groupMembers.map((member) => (
                    <option key={member.id} value={`${member.name} ${member.lastname}`}>
                      {member.name} {member.lastname}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm">Start Date</label>
                <input
                  type="date"
                  name="startDate"
                  value={taskData.startDate}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm">End Date</label>
                <input
                  type="date"
                  name="endDate"
                  value={taskData.endDate}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm">Priority Level</label>
                <select
                  name="priorityLevel"
                  value={taskData.priorityLevel}
                  onChange={handleInputChange}
                  className="w-full p-2 border text-sm"
                  required
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-500 text-white text-sm rounded-sm hover:bg-gray-600 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent text-white text-sm rounded-sm hover:bg-opacity-80 transition"
                >
                  {isEditing ? "Update Task" : "Add Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkplanTable;