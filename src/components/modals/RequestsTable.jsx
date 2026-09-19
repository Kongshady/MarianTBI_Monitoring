import { useMemo, useState } from "react";
import { FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import StatusBadge from "../ui/StatusBadge.jsx";
import SectionEmptyState from "../groups/SectionEmptyState.jsx";
import { canSubmitAsTeamMember } from "../../lib/permissions.js";
import {
  comparePriority,
  formatDateSafe,
  normalizePriority,
  normalizeRequestStatus,
  toDateSafe,
} from "../../lib/domain.js";

const RequestsTable = ({ requests, handleEditRequest, handleDeleteRequest, openRequestModal, groupRole }) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const canWrite = canSubmitAsTeamMember(groupRole);
  const canRequest = groupRole !== "System Analyst" && groupRole !== "Developer";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...(requests || [])]
      .filter((r) => {
        if (statusFilter === "open" && normalizeRequestStatus(r.status) === "Done") return false;
        if (statusFilter === "done" && normalizeRequestStatus(r.status) !== "Done") return false;
        if (!q) return true;
        return [r.responsibleTeamMember, r.requestType, r.description, r.resourceToolNeeded]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aDone = normalizeRequestStatus(a.status) === "Done";
        const bDone = normalizeRequestStatus(b.status) === "Done";
        if (aDone && !bDone) return 1;
        if (!aDone && bDone) return -1;
        if (comparePriority(a.priorityLevel, b.priorityLevel) !== 0) {
          return comparePriority(a.priorityLevel, b.priorityLevel);
        }
        return (toDateSafe(a.dateEntry)?.getTime() || 0) - (toDateSafe(b.dateEntry)?.getTime() || 0);
      });
  }, [requests, search, statusFilter]);

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <h2 className="text-base font-semibold mr-auto">Requests</h2>
        {canRequest && (
          <button
            onClick={openRequestModal} // Trigger the modal for creating a new request
            className="px-4 py-2 bg-accent text-white text-xs font-medium rounded hover:bg-opacity-80 transition flex items-center gap-2"
          >
            <FaPlus aria-hidden="true" /> Request needs
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <div className="flex-1 min-w-[150px] sm:flex-none">
          <label htmlFor="incuRequestSearch" className="tbi-label">Search</label>
          <input
            id="incuRequestSearch"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Member, type, or keyword"
            className="tbi-input sm:max-w-64"
          />
        </div>
        <div>
          <label htmlFor="incuRequestStatus" className="tbi-label">Status</label>
          <select
            id="incuRequestStatus"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
              <th scope="col">Date entry</th>
              <th scope="col">Date needed</th>
              <th scope="col">Specific needs</th>
              <th scope="col">Resource person</th>
              <th scope="col">Priority</th>
              <th scope="col">Status</th>
              <th scope="col">Remarks</th>
              {canWrite && (
                <th scope="col"><span className="sr-only">Actions</span></th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((request) => (
              <tr key={request.id}>
                <td>{request.responsibleTeamMember}</td>
                <td>{request.requestType}</td>
                <td>{formatDateSafe(request.dateEntry)}</td>
                <td>{request.dateNeeded ? formatDateSafe(request.dateNeeded) : "—"}</td>
                <td className="max-w-[220px]">{request.resourceToolNeeded}</td>
                <td>{request.prospectResourcePerson || "—"}</td>
                <td>
                  <StatusBadge status={normalizePriority(request.priorityLevel)} />
                </td>
                <td>
                  <StatusBadge status={request.status} />
                </td>
                <td className="max-w-[200px]">{request.remarks || "—"}</td>
                {canWrite && (
                  <td>
                    <span className="flex justify-end gap-1.5">
                      <button
                        onClick={() => handleEditRequest(request.id)}
                        className="px-2.5 py-1.5 bg-accent text-white rounded text-xs hover:bg-opacity-80 transition"
                        aria-label={`Edit request for ${request.resourceToolNeeded || "request"}`}
                      >
                        <FaEdit aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDeleteRequest(request.id)}
                        className="px-2.5 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600 transition"
                        aria-label={`Delete request for ${request.resourceToolNeeded || "request"}`}
                      >
                        <FaTrash aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <SectionEmptyState
            title={(requests || []).length === 0 ? "No requests yet" : "No requests match"}
            message={
              (requests || []).length === 0
                ? canRequest
                  ? "Describe what your startup needs — people, funding, or tools — and TBI staff will follow up."
                  : "Nothing has been requested for this startup yet."
                : "Try a different search term or status filter."
            }
            action={
              (requests || []).length === 0 && canRequest ? (
                <button
                  onClick={openRequestModal}
                  className="px-4 py-2 bg-accent text-white text-xs font-medium rounded hover:bg-opacity-80 transition flex items-center gap-2"
                >
                  <FaPlus aria-hidden="true" /> Request needs
                </button>
              ) : null
            }
          />
        )}
      </div>
    </div>
  );
};

export default RequestsTable;
