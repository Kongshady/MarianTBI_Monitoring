import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GiHamburgerMenu, GiProgression } from "react-icons/gi";
import { MdDashboard, MdGroups, MdManageAccounts } from "react-icons/md";
import { IoMdNotifications } from "react-icons/io";
import { IoLogOutSharp, IoChatbox } from "react-icons/io5";
import { auth, db } from "../../config/marian-config.js";
import { collection, doc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import { signOut } from "firebase/auth";

function AdminSideBar() {
  const [userData, setUserData] = useState(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = () => {
      const user = auth.currentUser;
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            setUserData(data);
            fetchUnreadMessagesCount(data.id);
          }
        });

        return () => unsubscribe();
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
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  return (
    <div className="group w-[4rem] hover:w-1/4 h-screen bg-primary-color overflow-hidden transition-all duration-300">
      {/* Logo & Menu Button */}
      <div className="flex gap-3 p-3 items-center">
        <GiHamburgerMenu className="text-5xl text-white" />
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
          {userData && (
            <>
              <h1 className="text-base font-bold">{userData.name} {userData.lastname}</h1>
              <p className="text-sm">{userData.role}</p>
            </>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="mt-6">
        <ul className="space-y-1">
          <MenuItem to={"/admin-dashboard"} icon={<MdDashboard />} text="Dashboard" />
          <MenuItem to={"/admin-groups"} icon={<MdGroups />} text="Incubatees" />
          <MenuItem to={"/admin-progress"} icon={<GiProgression />}text="Progress" />
          <MenuItem to={"/admin-approval"} icon={<MdManageAccounts />} text="UserManagement" />
          <MenuItem to={"/admin-notification"} icon={<IoMdNotifications />} text="Notification" />
          <MenuItem to={"/admin-chat"} icon={<IoChatbox />} text="Chat" unreadCount={unreadMessagesCount} />
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center gap-4 p-4 w-full text-left hover:bg-white hover:text-primary-color cursor-pointer transition-all text-white"
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

/* Reusable Menu Item Component */
function MenuItem({ to, icon, text, unreadCount }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-4 p-4 hover:bg-white hover:text-primary-color cursor-pointer transition-all text-white">
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

export default AdminSideBar;