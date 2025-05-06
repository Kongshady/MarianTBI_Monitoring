import { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, where, getDoc, getDocs } from "firebase/firestore";
import { db, auth } from "../../config/marian-config.js";
import EmployeeSidebar from "../../components/sidebar/EmployeeSidebar.jsx";
import { FaEllipsisV } from "react-icons/fa";

function EmChat() {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [editingMessage, setEditingMessage] = useState(null);
    const [showOptions, setShowOptions] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [lastChatTimestamps, setLastChatTimestamps] = useState({});
    const dropdownRef = useRef(null);

    useEffect(() => {
        document.title = "Employee | Chats";

        const fetchUsersAndGroups = async () => {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.data();

                // Fetch TBI Assistant and TBI Manager
                const tbiQuery = query(collection(db, "users"), where("role", "in", ["TBI Manager", "TBI Assistant"]));
                const tbiSnapshot = await getDocs(tbiQuery);
                const tbiUsers = tbiSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

                // Fetch groups and filter Project Managers
                const groupsQuery = query(collection(db, "groups"));
                const groupsSnapshot = await getDocs(groupsQuery);
                const projectManagers = [];
                groupsSnapshot.docs.forEach((groupDoc) => {
                    const groupData = groupDoc.data();
                    const projectManager = groupData.members.find((member) => member.groupRole === "Project Manager");
                    if (projectManager) {
                        projectManagers.push({
                            ...projectManager,
                            groupName: groupData.name, // Include group name for context
                        });
                    }
                });

                // Combine TBI users and Project Managers
                setUsers([...tbiUsers, ...projectManagers]);
            }
        };

        fetchUsersAndGroups();
    }, []);

    useEffect(() => {
        if (selectedUser) {
            const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const messagesList = querySnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));
                const filteredMessages = messagesList.filter(
                    (message) =>
                        (message.senderId === auth.currentUser.uid && message.receiverId === selectedUser.id) ||
                        (message.senderId === selectedUser.id && message.receiverId === auth.currentUser.uid)
                );
                setMessages(filteredMessages);

                // Mark messages as seen
                filteredMessages.forEach(async (message) => {
                    if (message.receiverId === auth.currentUser.uid && !message.seen) {
                        await updateDoc(doc(db, "messages", message.id), {
                            seen: true,
                        });
                    }
                });

                // Update last chat timestamp
                if (filteredMessages.length > 0) {
                    const lastMessage = filteredMessages[filteredMessages.length - 1];
                    setLastChatTimestamps((prev) => ({
                        ...prev,
                        [selectedUser.id]: lastMessage.timestamp,
                    }));
                }
            });

            return () => unsubscribe();
        }
    }, [selectedUser]);

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

    useEffect(() => {
        const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const messagesList = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            const unreadCounts = {};
            messagesList.forEach((message) => {
                if (message.receiverId === auth.currentUser.uid && !message.seen) {
                    if (!unreadCounts[message.senderId]) {
                        unreadCounts[message.senderId] = 0;
                    }
                    unreadCounts[message.senderId]++;
                }
            });
            setUnreadCounts(unreadCounts);
        });

        return () => unsubscribe();
    }, []);

    const handleSendMessage = async () => {
        if (newMessage.trim() === "") return;

        if (editingMessage) {
            await updateDoc(doc(db, "messages", editingMessage.id), {
                message: newMessage,
                edited: true,
            });
            setEditingMessage(null);
        } else {
            await addDoc(collection(db, "messages"), {
                senderId: auth.currentUser.uid,
                receiverId: selectedUser.id,
                message: newMessage,
                timestamp: new Date(),
                seen: false,
            });
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
        const date = new Date(timestamp.seconds * 1000);
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
        const messageTime = new Date(timestamp.seconds * 1000);
        const diff = (now - messageTime) / 1000 / 60; // Difference in minutes
        return diff > 5; // Disable if more than 5 minutes
    };

    // Sort users: last chatted user first, then by unread counts
    const sortedUsers = [...users].sort((a, b) => {
        if (lastChatTimestamps[a.id] && lastChatTimestamps[b.id]) {
            return lastChatTimestamps[b.id].seconds - lastChatTimestamps[a.id].seconds;
        }
        if (lastChatTimestamps[a.id]) return -1;
        if (lastChatTimestamps[b.id]) return 1;
        return (unreadCounts[b.id] || 0) - (unreadCounts[a.id] || 0);
    });

    return (
        <div className="flex">
            <EmployeeSidebar />
            <div className="flex flex-col items-start justify-start h-screen w-full p-10 bg-gray-100">
                <div className="flex w-full h-svh bg-white rounded-lg shadow-lg overflow-hidden">
                    <div className="w-1/4 border-r">
                        <h2 className="text-md font-semibold p-4 border-b">Chat Users</h2>
                        <ul className="overflow-y-auto h-96">
                            {sortedUsers.map((user) => (
                                <li
                                    key={user.id}
                                    className={`p-4 cursor-pointer hover:bg-gray-200 ${
                                        selectedUser?.id === user.id ? "bg-gray-200" : ""
                                    }`}
                                    onClick={() => setSelectedUser(user)}
                                >
                                    <div className="flex items-center justify-between">
                                        {/* Placeholder Image */}
                                        <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden mr-3">
                                            {user.profileImageUrl ? (
                                                <img
                                                    src={user.profileImageUrl}
                                                    alt={`${user.name} ${user.lastname}`}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <span className="text-gray-500 text-xs text-center">No Image</span>
                                            )}
                                        </div>

                                        {/* User Details */}
                                        <div className="flex flex-col flex-1">
                                            <span className="font-bold text-sm">
                                                {user.name} {user.lastname}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {user.role || user.groupRole} {/* Display role or groupRole */}
                                            </span>
                                            {user.groupName && (
                                                <span className="text-xs text-gray-400">{user.groupName}</span>
                                            )}
                                        </div>

                                        {/* Unread Count */}
                                        {unreadCounts[user.id] > 0 && (
                                            <span className="text-xs bg-red-500 text-white rounded-full px-2 py-1">
                                                {unreadCounts[user.id]}
                                            </span>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="w-3/4 flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            {selectedUser ? (
                                <>
                                    <div className="flex items-center mb-4 p-4 top-0 sticky bg-primary-color text-white z-10">
                                        <div className="flex flex-col">
                                            <h2 className="text-md font-semibold">
                                                {selectedUser.name} {selectedUser.lastname}
                                            </h2>
                                            <span className="text-xs text-white">{selectedUser.role}</span>
                                            {selectedUser.groupName && (
                                                <span className="text-xs text-gray-400">{selectedUser.groupName}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col space-y-1 p-4">
                                        {messages.map((message, index) => {
                                            const currentMessageTime = new Date(message.timestamp.seconds * 1000);
                                            const previousMessageTime =
                                                index > 0 ? new Date(messages[index - 1].timestamp.seconds * 1000) : null;

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
                                                        className={`p-2 rounded-sm text-sm ${
                                                            message.senderId === auth.currentUser.uid
                                                                ? "bg-blue-500 text-white self-end"
                                                                : "bg-gray-200 self-start"
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
                                <p className="text-center text-gray-500">Select a user to start chatting</p>
                            )}
                        </div>
                        {selectedUser && (
                            <div className="p-4 border-t flex items-center">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    className="w-full p-2 border text-sm rounded-sm"
                                    placeholder="Type your message..."
                                />
                                <button
                                    onClick={handleSendMessage}
                                    className="ml-2 px-4 py-2 bg-primary-color text-white text-sm rounded-sm hover:bg-opacity-80 transition"
                                >
                                    {editingMessage ? "Update" : "Send"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EmChat;