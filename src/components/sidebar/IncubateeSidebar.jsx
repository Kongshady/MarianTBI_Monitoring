import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { collection, doc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { GiHamburgerMenu } from "react-icons/gi";
import { MdDashboard, MdGroups, MdEdit } from "react-icons/md";
import { IoMdNotifications } from "react-icons/io";
import { IoLogOutSharp, IoChatbox } from "react-icons/io5";

function IncubateeSidebar({ onUserFetched = () => {} }) {
  const [userName, setUserName] = useState("Loading...");
  const [userRole, setUserRole] = useState("Loading...");
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      const storedUser = sessionStorage.getItem("currentUser");
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        setUserName(`${userData.name} ${userData.lastname}`);
        setUserRole(userData.role);
        onUserFetched(userData);
        fetchUnreadMessagesCount(userData.id);
      } else {
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = { id: userDoc.id, ...userDoc.data() };
            sessionStorage.setItem("currentUser", JSON.stringify(userData));
            setUserName(`${userData.name} ${userData.lastname}`);
            setUserRole(userData.role);
            onUserFetched(userData);
            fetchUnreadMessagesCount(userData.id);
          }
        }
      }
    };

    const handleAuthStateChanged = async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = { id: userDoc.id, ...userDoc.data() };
          sessionStorage.setItem("currentUser", JSON.stringify(userData));
          setUserName(`${userData.name} ${userData.lastname}`);
          setUserRole(userData.role);
          onUserFetched(userData);
          fetchUnreadMessagesCount(userData.id);
        }
      } else {
        sessionStorage.removeItem("currentUser");
        setUserName("Loading...");
        setUserRole("Loading...");
        onUserFetched(null);
      }
    };

    const fetchUnreadMessagesCount = (userId) => {
      const q = query(
        collection(db, "messages"),
        where("receiverId", "==", userId),
        where("seen", "==", false)
      );
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        setUnreadMessagesCount(querySnapshot.size);
      });

      return unsubscribe;
    };

    fetchUserData();
    const unsubscribeAuth = auth.onAuthStateChanged(handleAuthStateChanged);

    return () => {
      unsubscribeAuth();
    };
  }, [onUserFetched]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem("currentUser");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="group w-[4rem] hover:w-1/4 h-screen bg-secondary-color overflow-hidden transition-all duration-300">
      <div className="flex gap-3 p-3 items-center">
        <GiHamburgerMenu className="text-5xl text-white" />
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold">{userName}</h1>
            <MdEdit
              className="text-xl cursor-pointer"
              onClick={() => navigate("/incubatee-editprofile")}
              title="Edit Profile"
            />
          </div>
          <p className="text-sm">{userRole}</p>
        </div>
      </div>
      <nav className="mt-6">
        <ul className="space-y-1">
          <MenuItem to={"/incubatee-dashboard"} icon={<MdDashboard />} text="Dashboard" />
          <MenuItem to={"/incubatee-group"} icon={<MdGroups />} text="MyGroup" />
          <MenuItem to={"/incubatee-notification"} icon={<IoMdNotifications />} text="Notifications" />
          <MenuItem to={"/incubatee-chat"} icon={<IoChatbox />} text="Chats" unreadCount={unreadMessagesCount} />
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 p-4 w-full text-left hover:bg-white hover:text-secondary-color cursor-pointer transition-all text-white"
            >
              <IoLogOutSharp className="text-2xl" />
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                LogOut
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}

function MenuItem({ to, icon, text, unreadCount }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-4 p-4 hover:bg-white hover:text-secondary-color cursor-pointer transition-all text-white">
        <span className="text-2xl">{icon}</span>
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center">
          {text}
          {unreadCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

export default IncubateeSidebar;