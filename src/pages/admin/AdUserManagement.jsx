import { useState, useEffect } from "react";
import { auth, db } from "../../config/marian-config.js"; // Firestore connection
import { collection, updateDoc, deleteDoc, doc, getDoc, onSnapshot } from "firebase/firestore";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Tabs from "../../components/ui/Tabs.jsx";
import { APP_ROLE_LIST } from "../../lib/domain.js";
import { writeAuditEntry } from "../../lib/audit.js";
import { toast } from "../../lib/toast.js";
import PendingUsersTable from "../../components/modals/PendingUsersTable.jsx";
import ApprovedUsersTable from "../../components/modals/ApprovedUsersTable.jsx";
import UserDetailsDrawer from "../../components/modals/UserDetailsDrawer.jsx";

function AdminAccountApproval() {
    const [pendingUsers, setPendingUsers] = useState([]);
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [disabledUsers, setDisabledUsers] = useState([]);
    const [viewerRole, setViewerRole] = useState("");
    const [viewerName, setViewerName] = useState("");
    const [activeTab, setActiveTab] = useState("pending");
    const [selectedRole, setSelectedRole] = useState("All");
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [userToRemove, setUserToRemove] = useState(null);
    const [userToReject, setUserToReject] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [removalReason, setRemovalReason] = useState("");
    const [rejectReason, setRejectReason] = useState("");
    const [otherReason, setOtherReason] = useState("");
    const [otherRejectReason, setOtherRejectReason] = useState("");

    useEffect(() => {
        document.title = "Admin | Account Approval"; // Set the page title
    }, []);

    useEffect(() => {
        const fetchViewer = async () => {
            try {
                const current = auth.currentUser;
                if (!current) return;
                const userDoc = await getDoc(doc(db, "users", current.uid));
                if (userDoc.exists()) {
                    setViewerRole(userDoc.data().role || "");
                    setViewerName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
                }
            } catch (error) {
                console.error("Error fetching viewer:", error);
            }
        };
        fetchViewer();
    }, []);

    useEffect(() => {
        // Listen for real-time updates to the users collection (tables format raw values)
        const unsubscribeUsers = onSnapshot(collection(db, "users"), (querySnapshot) => {
            const users = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            setPendingUsers(users.filter((user) => user.status === "pending"));
            setApprovedUsers(users.filter((user) => user.status === "approved"));
            setDisabledUsers(users.filter((user) => user.status === "disabled"));
        });

        return () => unsubscribeUsers();
    }, []);

    const handleApproval = async (userId, status) => {
        try {
            await updateDoc(doc(db, "users", userId), { status });
            await writeAuditEntry({
                actorId: auth.currentUser?.uid,
                action: status === "approved" ? "user.approved" : "user.status_changed",
                targetType: "user",
                targetId: userId,
                detail: status,
            });
            toast(status === "approved" ? "Account approved." : "Account status updated.");
        } catch (error) {
            console.error("Error approving user:", error);
            toast("Failed to update the account.", "error");
            throw error;
        }
    };

    const handleRemoveUser = async () => {
        if (!userToRemove) return;
        try {
            await deleteDoc(doc(db, "users", userToRemove.id));
            await writeAuditEntry({
                actorId: auth.currentUser?.uid,
                action: "user.removed",
                targetType: "user",
                targetId: userToRemove.id,
                detail: removalReason === "Other" ? otherReason : removalReason,
            });
            toast("Account removed.");
        } catch (error) {
            console.error("Error removing user:", error);
            toast("Failed to remove the account.", "error");
        } finally {
            setIsModalOpen(false);
            setUserToRemove(null);
            setSelectedUser(null);
            setRemovalReason(""); // Reset the removal reason
            setOtherReason(""); // Reset the other reason
        }
    };

    const handleRejectUser = async () => {
        if (!userToReject) return;
        try {
            await deleteDoc(doc(db, "users", userToReject.id));
            await writeAuditEntry({
                actorId: auth.currentUser?.uid,
                action: "user.rejected",
                targetType: "user",
                targetId: userToReject.id,
                detail: rejectReason === "Other" ? otherRejectReason : rejectReason,
            });
            toast("Registration rejected.");
        } catch (error) {
            console.error("Error rejecting user:", error);
            toast("Failed to reject the registration.", "error");
        } finally {
            setIsRejectModalOpen(false);
            setUserToReject(null);
            setSelectedUser(null);
            setRejectReason(""); // Reset the reject reason
            setOtherRejectReason(""); // Reset the other reject reason
        }
    };

    const handleRoleChange = (e) => {
        setSelectedRole(e.target.value);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const filterUsersByRoleAndSearch = (users) => {
        let filteredUsers = users;

        if (selectedRole !== "All") {
            filteredUsers = filteredUsers.filter((user) => user.role === selectedRole);
        }

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            filteredUsers = filteredUsers.filter(
                (user) =>
                    `${user.name || ""} ${user.lastname || ""}`.toLowerCase().includes(q) ||
                    (user.email || "").toLowerCase().includes(q)
            );
        }

        return filteredUsers;
    };

    return (
        <AppShell role={viewerRole} userName={viewerName}>
            <PageHeader
                title="User management"
                description="Approve accounts, assign roles, and remove access. All actions are audited."
            />

            <Tabs
                tabs={[
                    { key: "pending", label: "Pending", count: pendingUsers.length },
                    { key: "approved", label: "Approved", count: approvedUsers.length },
                    { key: "disabled", label: "Disabled", count: disabledUsers.length },
                ]}
                active={activeTab}
                onChange={setActiveTab}
            />

            {/* Role Filter and Search Bar */}
            <div className="flex flex-wrap items-end gap-2 mb-4">
                <div className="flex-1 min-w-[150px] sm:flex-none">
                    <label htmlFor="roleFilter" className="tbi-label">
                        Filter by role
                    </label>
                    <select
                        id="roleFilter"
                        value={selectedRole}
                        onChange={handleRoleChange}
                        className="tbi-input sm:max-w-52"
                    >
                        <option value="All">All</option>
                        {APP_ROLE_LIST.map((role) => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[150px] sm:flex-none">
                    <label htmlFor="userSearch" className="tbi-label">
                        Search
                    </label>
                    <input
                        id="userSearch"
                        type="search"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="Search by name or email"
                        className="tbi-input sm:max-w-64"
                    />
                </div>
            </div>

                {activeTab === "pending" && (
                    <PendingUsersTable
                        users={filterUsersByRoleAndSearch(pendingUsers)}
                        onView={setSelectedUser}
                        onApprove={handleApproval}
                        onReject={(user) => {
                            setUserToReject(user);
                            setIsRejectModalOpen(true);
                        }}
                    />
                )}

                {activeTab === "approved" && (
                    <ApprovedUsersTable
                        title="Approved Users"
                        users={filterUsersByRoleAndSearch(approvedUsers)}
                        onView={setSelectedUser}
                    />
                )}

                {activeTab === "disabled" && (
                    <ApprovedUsersTable
                        title="Disabled Users"
                        users={filterUsersByRoleAndSearch(disabledUsers)}
                        onView={setSelectedUser}
                    />
                )}

            {/* User details drawer */}
            {selectedUser && (
                <UserDetailsDrawer
                    userId={selectedUser.id}
                    viewerRole={viewerRole}
                    onClose={() => setSelectedUser(null)}
                    onRemoveRequest={(user) => {
                        setUserToRemove(user);
                        setIsModalOpen(true);
                    }}
                />
            )}

            {/* Modals */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm removal">
                    <div className="bg-white p-6 rounded shadow-lg w-full max-w-[400px]">
                        <h2 className="text-lg font-semibold text-slate-900 mb-2 text-center">Confirm removal</h2>
                        <p className="mb-4 text-center text-sm text-slate-700">
                            Are you sure you want to remove {userToRemove?.name} {userToRemove?.lastname}?
                        </p>
                        <div className="mb-4">
                            <span className="block mb-2 text-sm font-medium" id="removalReasonLabel">Reason for removal:</span>
                            <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="removalReasonLabel">
                                <label className="flex items-center text-sm">
                                    <input
                                        type="radio"
                                        name="removalReason"
                                        value="Inappropriate behavior"
                                        checked={removalReason === "Inappropriate behavior"}
                                        onChange={(e) => setRemovalReason(e.target.value)}
                                        className="mr-2 accent-red-600"
                                    />
                                    Inappropriate behavior
                                </label>
                                <label className="flex items-center text-sm">
                                    <input
                                        type="radio"
                                        name="removalReason"
                                        value="Violation of terms"
                                        checked={removalReason === "Violation of terms"}
                                        onChange={(e) => setRemovalReason(e.target.value)}
                                        className="mr-2 accent-red-600"
                                    />
                                    Violation of terms
                                </label>
                                <label className="flex items-center text-sm">
                                    <input
                                        type="radio"
                                        name="removalReason"
                                        value="Other"
                                        checked={removalReason === "Other"}
                                        onChange={(e) => setRemovalReason(e.target.value)}
                                        className="mr-2 accent-red-600"
                                    />
                                    Other
                                </label>
                                {removalReason === "Other" && (
                                    <input
                                        type="text"
                                        placeholder="Please specify"
                                        value={otherReason}
                                        onChange={(e) => setOtherReason(e.target.value)}
                                        className="tbi-input mt-2"
                                        aria-label="Specify other reason"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex justify-center gap-2">
                            <button
                                className="px-4 py-2 bg-slate-100 text-slate-800 text-sm font-medium rounded hover:bg-slate-200 transition"
                                onClick={() => setIsModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition disabled:opacity-60"
                                onClick={handleRemoveUser}
                                disabled={!removalReason || (removalReason === "Other" && !otherReason)}
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isRejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Confirm rejection">
                    <div className="bg-white p-6 rounded shadow-lg w-full max-w-[400px]">
                        <h2 className="text-lg font-semibold text-slate-900 mb-2 text-center">Confirm rejection</h2>
                        <p className="mb-4 text-center text-sm text-slate-700">
                            Are you sure you want to reject {userToReject?.name} {userToReject?.lastname}?
                        </p>
                        <div className="mb-4">
                            <span className="block mb-2 text-sm font-medium" id="rejectReasonLabel">Reason for rejection:</span>
                            <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="rejectReasonLabel">
                                <label className="flex items-center text-sm">
                                    <input
                                        type="radio"
                                        name="rejectReason"
                                        value="Incomplete information"
                                        checked={rejectReason === "Incomplete information"}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="mr-2 accent-red-600"
                                    />
                                    Incomplete information
                                </label>
                                <label className="flex items-center text-sm">
                                    <input
                                        type="radio"
                                        name="rejectReason"
                                        value="Not qualified"
                                        checked={rejectReason === "Not qualified"}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="mr-2 accent-red-600"
                                    />
                                    Not qualified
                                </label>
                                <label className="flex items-center text-sm">
                                    <input
                                        type="radio"
                                        name="rejectReason"
                                        value="Other"
                                        checked={rejectReason === "Other"}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                        className="mr-2 accent-red-600"
                                    />
                                    Other
                                </label>
                                {rejectReason === "Other" && (
                                    <input
                                        type="text"
                                        placeholder="Please specify"
                                        value={otherRejectReason}
                                        onChange={(e) => setOtherRejectReason(e.target.value)}
                                        className="tbi-input"
                                        aria-label="Specify other reason"
                                    />
                                )}
                            </div>
                        </div>
                        <div className="flex justify-center gap-2">
                            <button
                                className="px-4 py-2 bg-slate-100 text-slate-800 text-sm font-medium rounded hover:bg-slate-200 transition"
                                onClick={() => setIsRejectModalOpen(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition disabled:opacity-60"
                                onClick={handleRejectUser}
                                disabled={!rejectReason || (rejectReason === "Other" && !otherRejectReason)}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}

export default AdminAccountApproval;