import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../config/marian-config.js"; // Firestore connection
import { addDoc, collection, serverTimestamp, query, where, getDocs, deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import Avatar from "../ui/Avatar.jsx";
import ConfirmDialog from "../ui/ConfirmDialog.jsx";
import { formatDateTimeSafe, toDateSafe } from "../../lib/domain.js";

// Pending approvals: Name, Email, Role, Registered, Actions
// (View, Approve with confirm, Reject with reason via parent modal).
// Props: users, onView(user), onApprove(userId), onReject(user).
function PendingUsersTable({ users, onView, onApprove, onReject }) {
    const previousPendingUsersRef = useRef([]); // To track the previous state of pending users
    const [approveTarget, setApproveTarget] = useState(null);
    const [approveSaving, setApproveSaving] = useState(false);

    const list = useMemo(() => users || [], [users]);

    // Sort users alphabetically by name
    const sortedUsers = [...list].sort((a, b) => {
        const nameA = `${a.name || ""} ${a.lastname || ""}`.toLowerCase();
        const nameB = `${b.name || ""} ${b.lastname || ""}`.toLowerCase();
        return nameA.localeCompare(nameB);
    });

    // Notification logic for new pending users
    useEffect(() => {
        const previousPendingUsers = previousPendingUsersRef.current;

        // Only proceed if there are new users
        if (list.length > previousPendingUsers.length) {
            // Find the new users
            const newUsers = list.filter(
                (user) => !previousPendingUsers.some((prevUser) => prevUser.id === user.id)
            );

            if (newUsers.length > 0) {
                // Notify TBI Manager and TBI Assistant
                const notifyAdmins = async () => {
                    try {
                        // Check the last notification timestamp
                        const notificationDocRef = doc(db, "notifications_meta", "last_pending_notification");
                        const notificationDoc = await getDoc(notificationDocRef);
                        const now = new Date();
                        const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);

                        if (!notificationDoc.exists() || notificationDoc.data().timestamp.toDate() < twentyMinutesAgo) {
                            // Update the last notification timestamp
                            await setDoc(notificationDocRef, { timestamp: serverTimestamp() });

                            const adminQuery = query(
                                collection(db, "users"),
                                where("role", "in", ["TBI Manager", "TBI Assistant", "System Administrator"]) // Approvers: managers and sysadmins
                            );
                            const adminSnapshot = await getDocs(adminQuery);

                            if (!adminSnapshot.empty) {
                                const adminUsers = adminSnapshot.docs.map((doc) => ({
                                    id: doc.id,
                                    ...doc.data(),
                                }));

                                // Create notifications for each admin (plain text; rendered safely)
                                const notificationMessage = `New Users: There are new pending users awaiting for their approval.`;
                                adminUsers.forEach(async (admin) => {
                                    try {
                                        await addDoc(collection(db, "notifications"), {
                                            userId: admin.id, // Send notification to the admin
                                            message: notificationMessage,
                                            timestamp: serverTimestamp(),
                                            read: false,
                                            type: "new_pending_user", // Notification type for filtering if needed
                                        });
                                    } catch (error) {
                                        console.error("Error creating notification:", error);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        console.error("Error fetching admin users or creating notifications:", error);
                    }
                };

                notifyAdmins();
            }
        }

        // Update the reference to the current pending users
        previousPendingUsersRef.current = list;
    }, [list]);

    // Remove notification when a user is accepted
    const handleUserApproval = async (userId) => {
        try {
            // Call the provided approval handler
            await onApprove(userId, "approved");

            // Remove the notification for the accepted user
            const notificationsQuery = query(
                collection(db, "notifications"),
                where("type", "==", "new_pending_user"),
                where("userId", "==", userId)
            );
            const notificationsSnapshot = await getDocs(notificationsQuery);

            notificationsSnapshot.forEach(async (docSnapshot) => {
                try {
                    await deleteDoc(doc(db, "notifications", docSnapshot.id));
                    console.log(`Notification for user ${userId} removed.`);
                } catch (error) {
                    console.error("Error removing notification:", error);
                }
            });
        } catch (error) {
            console.error("Error approving user:", error);
        }
    };

    if (sortedUsers.length === 0) {
        return <p className="text-sm text-muted">No pending accounts. New registrations will appear here.</p>;
    }

    return (
        <div>
            {/* Mobile: stacked cards */}
            <ul className="flex flex-col gap-3 md:hidden">
                {sortedUsers.map((user) => {
                    const fullName = `${user.name || ""} ${user.lastname || ""}`.trim() || "User";
                    return (
                        <li key={user.id} className="bg-white border border-line rounded p-4">
                            <div className="flex items-center gap-3">
                                {user.profileImageUrl ? (
                                    <img src={user.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                ) : (
                                    <Avatar name={fullName} size="md" />
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-slate-900 truncate">{fullName}</p>
                                    <p className="text-[13px] text-muted truncate">{user.email}</p>
                                </div>
                            </div>
                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
                                <div>
                                    <dt className="text-muted">Role</dt>
                                    <dd className="font-medium text-slate-900">{user.role}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted">Registered</dt>
                                    <dd className="font-medium text-slate-900">{formatDateTimeSafe(toDateSafe(user.timestamp))}</dd>
                                </div>
                            </dl>
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => onView(user)}
                                    className="px-3 py-2 bg-white border border-line text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition"
                                >
                                    View
                                </button>
                                <button
                                    onClick={() => setApproveTarget(user)}
                                    className="flex-1 px-3 py-2 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
                                >
                                    Approve
                                </button>
                                <button
                                    onClick={() => onReject(user)}
                                    className="flex-1 px-3 py-2 bg-white border border-red-300 text-red-700 rounded text-xs font-medium hover:bg-red-50 transition"
                                >
                                    Reject
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block bg-white border border-line rounded overflow-x-auto">
                <table className="tbi-table min-w-[760px]">
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Email</th>
                            <th scope="col">Role</th>
                            <th scope="col">Registered</th>
                            <th scope="col">
                                <span className="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedUsers.map((user) => {
                            const fullName = `${user.name || ""} ${user.lastname || ""}`.trim() || "User";
                            return (
                                <tr key={user.id}>
                                    <td>
                                        <span className="flex items-center gap-2.5">
                                            {user.profileImageUrl ? (
                                                <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                            ) : (
                                                <Avatar name={fullName} size="sm" />
                                            )}
                                            <span className="font-medium text-slate-900">{fullName}</span>
                                        </span>
                                    </td>
                                    <td className="max-w-[220px] truncate" title={user.email}>{user.email}</td>
                                    <td className="whitespace-nowrap">{user.role}</td>
                                    <td className="whitespace-nowrap">{formatDateTimeSafe(toDateSafe(user.timestamp))}</td>
                                    <td>
                                        <span className="flex justify-end gap-1.5">
                                            <button
                                                onClick={() => onView(user)}
                                                className="px-3 py-1.5 bg-white border border-line text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => setApproveTarget(user)}
                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition"
                                            >
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => onReject(user)}
                                                className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded text-xs font-medium hover:bg-red-50 transition"
                                            >
                                                Reject
                                            </button>
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <ConfirmDialog
                open={!!approveTarget}
                title={`Approve ${approveTarget?.name || "user"}${approveTarget?.lastname ? ` ${approveTarget.lastname}` : ""}?`}
                description={`They will join as ${approveTarget?.role || "their requested role"} and gain access immediately.`}
                confirmLabel="Approve"
                busy={approveSaving}
                onConfirm={async () => {
                    if (!approveTarget) return;
                    setApproveSaving(true);
                    try {
                        await handleUserApproval(approveTarget.id);
                    } finally {
                        setApproveSaving(false);
                        setApproveTarget(null);
                    }
                }}
                onCancel={() => !approveSaving && setApproveTarget(null)}
            />
        </div>
    );
}

export default PendingUsersTable;
