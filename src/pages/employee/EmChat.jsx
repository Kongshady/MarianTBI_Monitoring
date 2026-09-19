import { useState, useEffect, useRef } from "react";
import { collection, doc, getDoc, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { db, auth } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import { EmptyState } from "../../components/ui/states.jsx";
import {
  subscribeToMyMessages,
  getConversation,
  getUnreadCounts,
  sendChatMessage,
  markConversationSeen,
} from "../../lib/chat.js";
import { canSendTo, getChatContacts, getPastContacts } from "../../lib/messaging.js";
import { writeAuditEntry } from "../../lib/audit.js";
import { toDateSafe } from "../../lib/domain.js";
import { FaEllipsisV } from "react-icons/fa";

function EmChat() {
    const [users, setUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [role, setRole] = useState("");
    const [userName, setUserName] = useState("");
    const [directory, setDirectory] = useState({ groups: [], applications: [], assignments: [] });
    const [selectedUser, setSelectedUser] = useState(null);
    const [allMessages, setAllMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [editingMessage, setEditingMessage] = useState(null);
    const [showOptions, setShowOptions] = useState(null);
    const dropdownRef = useRef(null);

    const myUid = auth.currentUser?.uid;
    const messages = selectedUser && myUid ? getConversation(allMessages, myUid, selectedUser.id) : [];
    const unreadCounts = myUid ? getUnreadCounts(allMessages, myUid) : {};

    useEffect(() => {
        document.title = "Messages";

        // Relationship directory: staff see applicants, teams, mentors and
        // staff in scope — portfolio viewers only their own startups.
        const loadDirectory = async () => {
            const user = auth.currentUser;
            if (!user) return;
            try {
                const meDoc = await getDoc(doc(db, "users", user.uid));
                if (!meDoc.exists()) return;
                const me = { id: meDoc.id, ...meDoc.data() };
                setRole(me.role || "");
                setUserName(`${me.name || ""} ${me.lastname || ""}`.trim());

                const [usersSnap, groupsSnap, appsSnap, assignSnap] = await Promise.all([
                    getDocs(collection(db, "users")),
                    getDocs(collection(db, "groups")),
                    getDocs(collection(db, "applications")),
                    getDocs(collection(db, "mentorAssignments")),
                ]);
                const usersList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const groupsList = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const appsList = appsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
                const assignList = assignSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

                setAllUsers(usersList);
                setDirectory({ groups: groupsList, applications: appsList, assignments: assignList });
                setUsers(getChatContacts({ me, users: usersList, groups: groupsList, applications: appsList, assignments: assignList }));
            } catch (error) {
                console.error("Error loading chat directory:", error);
            }
        };

        loadDirectory();
    }, []);

    // Past contacts: preserved history from ended relationships (read-only).
    useEffect(() => {
        if (!myUid || allUsers.length === 0) return;
        const me = { id: myUid, role };
        const live = getChatContacts({
            me,
            users: allUsers,
            groups: directory.groups,
            applications: directory.applications,
            assignments: directory.assignments,
        });
        const liveIds = live.map((c) => c.id);
        const past = getPastContacts({ me, allMessages, users: allUsers, currentIds: liveIds });
        if (past.length > 0 || users.length !== live.length) {
            setUsers([...live, ...past]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allMessages, allUsers, directory, myUid, role]);

    // Constrained to my own sent + received messages (no full-collection scan).
    useEffect(() => {
        if (!myUid) return;
        return subscribeToMyMessages(myUid, setAllMessages);
    }, [myUid]);

    useEffect(() => {
        if (!selectedUser || !myUid) return;
        const conv = getConversation(allMessages, myUid, selectedUser.id);
        if (conv.length > 0) {
            markConversationSeen(conv, myUid);
        }
    }, [selectedUser, myUid, allMessages]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowOptions(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const sendGate = canSendTo(selectedUser);

    const handleSendMessage = async () => {
        if (newMessage.trim() === "" || !selectedUser || !sendGate.allowed) return;

        if (editingMessage) {
            await updateDoc(doc(db, "messages", editingMessage.id), {
                message: newMessage,
                edited: true,
            });
            setEditingMessage(null);
        } else {
            const firstMessage = getConversation(allMessages, auth.currentUser.uid, selectedUser.id).length === 0;
            await sendChatMessage({
                senderId: auth.currentUser.uid,
                receiverId: selectedUser.id,
                message: newMessage,
            });
            // Audit the conversation start — never the content.
            if (firstMessage) {
                await writeAuditEntry({
                    actorId: auth.currentUser.uid,
                    action: "conversation.started",
                    targetType: "user",
                    targetId: selectedUser.id,
                    detail: selectedUser.relationLabel || selectedUser.role || "",
                });
            }
        }

        setNewMessage("");
    };

    const handleKeyPress = (e) => {
        if (e.key === "Enter") {
            handleSendMessage();
        }
    };

    const handleEditMessage = (message) => {
        setNewMessage(message.message);
        setEditingMessage(message);
        setShowOptions(null);
    };

    const handleDeleteMessage = async (messageId) => {
        await deleteDoc(doc(db, "messages", messageId));
        setShowOptions(null);
    };

    const formatTimestamp = (timestamp) => {
        const date = toDateSafe(timestamp) || new Date();
        return date.toLocaleString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
    };

    const isEditDisabled = (timestamp) => {
        const now = new Date();
        const messageTime = toDateSafe(timestamp);
        if (!messageTime) return true;
        const diff = (now - messageTime) / 1000 / 60; // Difference in minutes
        return diff > 5; // Disable if more than 5 minutes
    };

    // Sort users: last chatted user first, then by unread counts
    const lastChatTimeByUser = {};
    for (const m of allMessages) {
        const other = m.senderId === myUid ? m.receiverId : m.senderId;
        const t = toDateSafe(m.timestamp)?.getTime() || 0;
        if (!lastChatTimeByUser[other] || t > lastChatTimeByUser[other]) {
            lastChatTimeByUser[other] = t;
        }
    }
    const sortedUsers = [...users].sort((a, b) => {
        if (lastChatTimeByUser[a.id] && lastChatTimeByUser[b.id]) {
            return lastChatTimeByUser[b.id] - lastChatTimeByUser[a.id];
        }
        if (lastChatTimeByUser[a.id]) return -1;
        if (lastChatTimeByUser[b.id]) return 1;
        return (unreadCounts[b.id] || 0) - (unreadCounts[a.id] || 0);
    });

    return (
        <AppShell role={role} userName={userName}>
            <PageHeader
                title="Messages"
                description="Direct conversations with coordinators and project leads."
            />
            <div className="flex flex-col md:flex-row w-full min-h-[65vh] bg-white border border-line rounded overflow-hidden">
                    <div className="w-full md:w-1/4 border-b md:border-b-0 md:border-r border-line">
                        <h2 className="text-sm font-semibold text-slate-900 p-4 border-b border-line">Contacts</h2>
                        <ul className="overflow-y-auto max-h-72 md:max-h-[55vh]">
                            {sortedUsers.map((user) => (
                                <li
                                    key={user.id}
                                    className={`p-4 cursor-pointer hover:bg-slate-50 transition ${
                                        selectedUser?.id === user.id ? "bg-slate-100" : ""
                                    }`}
                                    onClick={() => setSelectedUser(user)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <Avatar name={`${user.name} ${user.lastname}`} />
                                        {/* User Details */}
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="font-medium text-sm text-slate-900 truncate">
                                                {user.name} {user.lastname}
                                            </span>
                                            <span className="text-xs text-muted">
                                                {user.relationLabel || user.role || user.groupRole} {/* Relationship context */}
                                            </span>
                                            {user.groupName && (
                                                <span className="text-xs text-slate-400">{user.groupName}</span>
                                            )}
                                        </div>

                                        {/* Unread Count */}
                                        {unreadCounts[user.id] > 0 && (
                                            <span className="text-[11px] font-semibold bg-red-500 text-white rounded-full min-w-5 h-5 px-1 inline-flex items-center justify-center">
                                                {unreadCounts[user.id]}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                        {sortedUsers.length === 0 && (
                            <p className="p-4 text-sm text-muted">
                              {role === "System Administrator"
                                ? "Messaging is unavailable for system administrators. Use user management for account issues."
                                : "No contacts yet. People you work with in the TBI program will appear here."}
                            </p>
                        )}
                    </div>
                    <div className="w-full md:w-3/4 flex flex-col border-t md:border-t-0 border-line min-h-[50vh]">
                        <div className="flex-1 overflow-y-auto">
                            {selectedUser ? (
                                <>
                                    <div className="flex items-center px-4 py-3 top-0 sticky bg-primary-color text-white z-10">
                                        <Avatar name={`${selectedUser.name} ${selectedUser.lastname}`} size="sm" />
                                        <div className="flex flex-col ml-3">
                                            <h2 className="text-sm font-semibold">
                                                {selectedUser.name} {selectedUser.lastname}
                                            </h2>
                                            <span className="text-xs text-slate-300">{selectedUser.relationLabel || selectedUser.role}</span>
                                            {selectedUser.groupName && (
                                                <span className="text-xs text-slate-400">{selectedUser.groupName}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col space-y-1 p-4">
                                        {messages.map((message, index) => {
                                            const currentMessageTime = toDateSafe(message.timestamp) || new Date(0);
                                            const previousMessageTime =
                                                index > 0 ? toDateSafe(messages[index - 1].timestamp) : null;

                                            // Check if the time difference between messages exceeds 1 hour or is on a different day
                                            const shouldDisplayTime =
                                                !previousMessageTime ||
                                                currentMessageTime.getDate() !== previousMessageTime.getDate() ||
                                                currentMessageTime.getHours() - previousMessageTime.getHours() >= 1;

                                            return (
                                                <div key={message.id} className="flex flex-col">
                                                    {/* Display the time or date interval */}
                                                    {shouldDisplayTime && (
                                                        <div className="text-center text-xs text-gray-500 my-2">
                                                            {currentMessageTime.toLocaleDateString("en-US", {
                                                                weekday: "short",
                                                                month: "short",
                                                                day: "numeric",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                                hour12: true,
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Display the message */}
                                                    <div
                                                        className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                                                            message.senderId === auth.currentUser.uid
                                                                ? "bg-primary-color text-white self-end"
                                                                : "bg-slate-100 text-slate-800 self-start"
                                                        }`}
                                                        title={formatTimestamp(message.timestamp)}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            {message.senderId === auth.currentUser.uid ? (
                                                                <>
                                                                    {/* Sender: (edited) on the left */}
                                                                    {message.edited && (
                                                                        <span className="text-xs text-red-500 mr-2">(edited)</span>
                                                                    )}
                                                                    <span>{message.message}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {/* Receiver: (edited) on the right */}
                                                                    <span>{message.message}</span>
                                                                    {message.edited && (
                                                                        <span className="text-xs text-red-500 ml-2">(edited)</span>
                                                                    )}
                                                                </>
                                                            )}
                                                            {message.senderId === auth.currentUser.uid && (
                                                                <div className="relative flex gap-2 ml-2">
                                                                    <FaEllipsisV
                                                                        className="cursor-pointer"
                                                                        onClick={() => setShowOptions(message.id)}
                                                                    />
                                                                    {showOptions === message.id && (
                                                                        <div
                                                                            ref={dropdownRef}
                                                                            className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-10"
                                                                        >
                                                                            <button
                                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                                onClick={() => handleEditMessage(message)}
                                                                                disabled={isEditDisabled(message.timestamp)}
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                                                                onClick={() => handleDeleteMessage(message.id)}
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Display "Seen" indicator for the last message */}
                                                    {message.senderId === auth.currentUser.uid &&
                                                        message.seen &&
                                                        index === messages.length - 1 && (
                                                            <span className="text-xs text-gray-500 self-end mt-1">
                                                                Seen
                                                            </span>
                                                        )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-8">
                                    <EmptyState title="No conversation selected" description="Choose a contact to start messaging." />
                                </div>
                            )}
                        </div>
                        {selectedUser &&
                          (sendGate.allowed ? (
                            <div className="p-4 border-t border-line flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="tbi-input"
                                    placeholder="Type your message..."
                                    aria-label="Type your message"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="px-4 py-2 bg-primary-color text-white text-sm font-medium rounded hover:bg-primary-deep transition shrink-0"
                                >
                                    {editingMessage ? "Update" : "Send"}
                                </button>
                            </div>
                          ) : (
                            <p role="note" className="p-4 border-t border-line text-[13px] text-amber-800 bg-amber-50">
                              {sendGate.reason}
                            </p>
                          ))}
                    </div>
            </div>
        </AppShell>
    );
}

export default EmChat;