import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db, storage, auth } from "../../config/marian-config.js";
import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import { EmptyState, PageSkeleton } from "../../components/ui/states.jsx";
import { getManagerId, getManagerName } from "../../lib/domain.js";
import { writeAuditEntry } from "../../lib/audit.js";
import { IoAddOutline, IoArchiveOutline } from "react-icons/io5";
import { FaMinus, FaPlus } from "react-icons/fa";

function AdGroups() {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [portfolioManager, setPortfolioManager] = useState("");
  const [availableManagers, setAvailableManagers] = useState([]);
  const [availableAdditionalMembers, setAvailableAdditionalMembers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState(""); // State for validation error
  const [searchTerm, setSearchTerm] = useState(""); // State for the search term
  const [incubateeDropdowns, setIncubateeDropdowns] = useState([{ id: Date.now(), value: "", role: "" }]); // State for dynamic dropdowns
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Admin | Groups"; // Set the page title
  }, []);

  useEffect(() => {
    const fetchUsersAndGroups = async () => {
      try {
        const current = auth.currentUser;
        if (current) {
          const meDoc = await getDoc(doc(db, "users", current.uid));
          if (meDoc.exists()) {
            setRole(meDoc.data().role || "");
            setUserName(`${meDoc.data().name || ""} ${meDoc.data().lastname || ""}`.trim());
          }
        }

        const usersSnapshot = await getDocs(collection(db, "users"));
        const groupsSnapshot = await getDocs(collection(db, "groups"));

        const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const groups = groupsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // Collect IDs of users who are already Project Managers in any group
        const projectManagerIds = new Set();
        groups.forEach((group) => {
          (group.members || []).forEach((member) => {
            if (member.groupRole === "Project Manager" || member.role === "Project Manager") {
              projectManagerIds.add(member.id);
            }
          });
        });

        // Filter users for the dropdown
        const availableUsers = users.filter((user) => user.status === "approved");
        setAvailableManagers(availableUsers.filter((user) => user.role === "Portfolio Manager"));
        setAvailableAdditionalMembers(
          availableUsers.filter((user) => {
            // Allow all incubatees but prevent users who are already Project Managers in another startup
            return (
              user.role === "Incubatee" &&
              (!projectManagerIds.has(user.id) || user.role !== "Project Manager")
            );
          })
        );

        // Set groups (filter out archived ones and sort alphabetically by name)
        setGroups(
          groups
            .filter((group) => !group.archived)
            .map((group) => ({
              ...group,
              portfolioManagerDetails: users.find((user) => user.id === getManagerId(group)),
            }))
            .sort((a, b) => (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())) // Sort alphabetically
        );
      } catch (error) {
        console.error("Error fetching users and groups:", error);
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchUsersAndGroups();
  }, []);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB.");
      return;
    }
    setError("");
    setImage(file);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (!portfolioManager) {
        setError("Please assign a Portfolio Manager.");
        return;
    }

    const hasProjectManager = incubateeDropdowns.some(
        (dropdown) => dropdown.role === "Project Manager"
    );

    if (!hasProjectManager) {
        setValidationError("You need a Project Manager to create a startup.");
        return;
    }

    setError("");
    setValidationError("");

    let uploadedImageUrl = "";

    try {
        if (image) {
            const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const imageRef = ref(storage, `groupImages/${Date.now()}_${safeName}`);
            await uploadBytes(imageRef, image);
            uploadedImageUrl = await getDownloadURL(imageRef);
        }

        // Fetch portfolio manager details
        const portfolioManagerDoc = await getDoc(doc(db, "users", portfolioManager));
        const portfolioManagerDetails = { id: portfolioManager, ...portfolioManagerDoc.data() };

        // Fetch full details of each incubatee
        const members = await Promise.all(
            incubateeDropdowns
                .filter((dropdown) => dropdown.value && dropdown.role) // Only include valid selections
                .map(async (dropdown) => {
                    const memberDoc = await getDoc(doc(db, "users", dropdown.value));
                    const memberData = memberDoc.data();
                    return {
                        id: dropdown.value, // User ID
                        name: memberData.name, // Member's name
                        lastname: memberData.lastname, // Member's lastname
                        groupRole: dropdown.role, // Role specific to this group
                    };
                })
        );

        const groupDocRef = await addDoc(collection(db, "groups"), {
            name: groupName,
            description,
            imageUrl: uploadedImageUrl,
            portfolioManager: portfolioManagerDetails,
            portfolioManagerId: portfolioManager,
            members, // Add members with full details
            memberIds: members.map((m) => m.id),
            createdAt: serverTimestamp(),
        });

        // Create a notification for the portfolio manager (plain text; rendered safely)
        await addDoc(collection(db, "notifications"), {
            userId: portfolioManager,
            message: `You've been assigned as the Portfolio Manager for the group "${groupName}". Get ready to lead and make an impact!`,
            createdAt: serverTimestamp(),
            read: false,
            groupId: groupDocRef.id,
            type: "manager",
        });

        await writeAuditEntry({
            actorId: auth.currentUser?.uid,
            action: "group.created",
            targetType: "group",
            targetId: groupDocRef.id,
            detail: groupName,
        });

        setGroupName("");
        setDescription("");
        setImage(null);
        setPortfolioManager("");
        setIncubateeDropdowns([{ id: Date.now(), value: "", role: "" }]);
        setIsPopupOpen(false);

        // Fetch the updated list of groups
        const querySnapshot = await getDocs(collection(db, "groups"));
        const groupsData = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setGroups(groupsData.filter((group) => !group.archived));

        navigate(`/admin/view-group/${groupDocRef.id}`);
    } catch (error) {
        console.error("Error creating group:", error);
        setError("An error occurred while creating the group. Please try again.");
    }
};

  const handleNavigateToArchives = () => {
    navigate("/admin-groups/archives");
  };

  const filteredGroups = groups.filter((group) => {
    const searchLower = (searchTerm || "").toLowerCase();

    // Check if the search term matches the group name or description
    const matchesNameOrDescription =
      (group.name || "").toLowerCase().includes(searchLower) ||
      (group.description || "").toLowerCase().includes(searchLower);

    // Check if the search term matches the portfolio manager's name
    const matchesPortfolioManager =
      group.portfolioManagerDetails &&
      `${group.portfolioManagerDetails.name} ${group.portfolioManagerDetails.lastname}`
        .toLowerCase()
        .includes(searchLower);

    // Check if the search term matches any member's name
    const matchesMembers =
      group.members &&
      group.members.some((member) =>
        `${member.name} ${member.lastname}`.toLowerCase().includes(searchLower)
      );

    // Return true if any of the above conditions are met
    return matchesNameOrDescription || matchesPortfolioManager || matchesMembers;
  });

  const handleAddDropdown = () => {
    setIncubateeDropdowns([...incubateeDropdowns, { id: Date.now(), value: "", role: "" }]);
  };

  const handleRemoveDropdown = (id) => {
    setIncubateeDropdowns(incubateeDropdowns.filter((dropdown) => dropdown.id !== id));
  };

  const handleDropdownChange = (id, value) => {
    // Check if the selected user is already a Project Manager in another startup
    const isAlreadyProjectManager = groups.some((group) =>
        group.members.some(
            (member) => member.id === value && member.groupRole === "Project Manager"
        )
    );

    // Update the dropdown value and store the "isAlreadyProjectManager" flag
    setIncubateeDropdowns(
        incubateeDropdowns.map((dropdown) =>
            dropdown.id === id
                ? { ...dropdown, value, isAlreadyProjectManager }
                : dropdown
        )
    );

    setValidationError(""); // Clear any previous validation errors
};

  const handleRoleChange = (id, role) => {
    // Update the role in the local state
    setIncubateeDropdowns(
      incubateeDropdowns.map((dropdown) =>
        dropdown.id === id ? { ...dropdown, role } : dropdown
      )
    );
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Incubatees"
        description="Startups under incubation. Open one to see its plan, mentorship, reports, and history."
        actions={
          <>
            <button
              onClick={() => setIsPopupOpen(true)}
              className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition inline-flex items-center gap-1.5"
            >
              <IoAddOutline className="text-lg" aria-hidden="true" />
              New startup
            </button>
            <button
              onClick={handleNavigateToArchives}
              className="px-3 py-2 bg-white border border-line text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition inline-flex items-center gap-1.5"
              title="View archives"
            >
              <IoArchiveOutline className="text-lg" aria-hidden="true" />
              Archives
            </button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search startups, managers, members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search startups"
          className="tbi-input max-w-64"
        />
      </div>

      {loadingGroups ? (
        <PageSkeleton rows={6} />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          title="No startups found"
          description="Create the first startup, or adjust your search."
          action={
            <button
              onClick={() => setIsPopupOpen(true)}
              className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
            >
              New startup
            </button>
          }
        />
      ) : (
        <ul className="bg-white border border-line rounded divide-y divide-line">
          {filteredGroups.map((group) => (
            <li key={group.id}>
              <Link
                to={`/admin/view-group/${group.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
              >
                <Avatar name={group.name} size="lg" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-slate-900 truncate">{group.name}</span>
                  <span className="block text-[13px] text-muted truncate">
                    {(group.members || []).length} members
                    {getManagerName(group, "") ? ` · ${getManagerName(group)}` : ""}
                  </span>
                </span>
                <StatusBadge status={group.incubateeStatus || "Active"} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {isPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Create startup">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-[500px] max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 text-center">Create a startup</h2>
            <label className="block mb-3 cursor-pointer text-center text-sm border border-line p-3 rounded hover:bg-slate-50 transition">
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              {image ? "Image selected" : "Click to upload image"}
            </label>

            <label className="tbi-label" htmlFor="new-group-name">Startup name</label>
            <input
              id="new-group-name"
              type="text"
              placeholder="Startup name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="tbi-input mb-3"
            />
            <label className="tbi-label" htmlFor="new-group-desc">Short description</label>
            <textarea
              id="new-group-desc"
              placeholder="Short description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="tbi-input mb-4"
            ></textarea>

            <label className="tbi-label" htmlFor="new-group-pm">Assign portfolio manager</label>
            <select
              id="new-group-pm"
              value={portfolioManager}
              onChange={(e) => setPortfolioManager(e.target.value)}
              className="tbi-input mb-4"
            >
              <option value="">Add manager</option>
              {availableManagers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} {user.lastname}
                </option>
              ))}
            </select>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-slate-700">Choose incubatees</h3>
              {incubateeDropdowns.map((dropdown) => (
                <div key={dropdown.id} className="flex items-center gap-2">
                  {/* Dropdown to select incubatee */}
                  <select
                    value={dropdown.value}
                    onChange={(e) => handleDropdownChange(dropdown.id, e.target.value)}
                    className="tbi-input"
                    aria-label="Select incubatee"
                  >
                    <option value="">Select Incubatee</option>
                    {availableAdditionalMembers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} {user.lastname}
                      </option>
                    ))}
                  </select>

                  {/* Dropdown to set role */}
                  <select
                    value={dropdown.role || ""}
                    onChange={(e) => handleRoleChange(dropdown.id, e.target.value)}
                    className="tbi-input"
                    aria-label="Select team role"
                  >
                    <option value="">Select role</option>
                    <option value="Project Manager" disabled={dropdown.isAlreadyProjectManager}>
                        Project Manager
                    </option>
                    <option value="System Analyst">System Analyst</option>
                    <option value="Developer">Developer</option>
                  </select>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveDropdown(dropdown.id)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Remove"
                    aria-label="Remove member row"
                  >
                    <FaMinus />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAddDropdown}
                className="text-accent hover:underline text-sm flex items-center gap-1"
                title="Add Incubatee"
              >
                <FaPlus aria-hidden="true" />
                Add incubatee
              </button>
            </div>

            {error && <p className="text-red-600 text-sm text-center mb-4 mt-2" role="alert">{error}</p>}
            {validationError && <p className="text-red-600 text-sm text-center mb-4 mt-2" role="alert">{validationError}</p>}

            <div className="flex justify-between mt-4">
              <button
                onClick={() => setIsPopupOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-800 rounded text-sm font-medium hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
              >
                Create startup
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default AdGroups;