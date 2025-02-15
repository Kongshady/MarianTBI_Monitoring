import { GiHamburgerMenu, GiProgression } from "react-icons/gi";
import { MdDashboard, MdGroups, MdManageAccounts } from "react-icons/md";
import { IoMdNotifications, IoMdSettings } from "react-icons/io";
import { IoLogOutSharp, IoChatbox  } from "react-icons/io5";

function StSideBar() {
  return (
    <div className="group w-[4rem] hover:w-1/4 h-screen bg-primary-color p-3 overflow-hidden transition-all duration-300">
      {/* Logo & Menu Button */}
      <div className="flex gap-3 items-center">
        <GiHamburgerMenu className="text-5xl text-white" />
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white">
          <h1 className="text-base font-bold">Temporary Name Head</h1>
          <p className="text-sm">Role</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="mt-6">
        <ul className="space">
          <MenuItem icon={<MdDashboard />} text="Dashboard" />
          <MenuItem icon={<MdGroups />} text="My Group" />
          <MenuItem icon={<IoMdNotifications />} text="Notifications" />
          <MenuItem icon={<IoChatbox />} text="Chats" />
          <MenuItem icon={<IoMdSettings />} text="Settings" />
          <MenuItem icon={<IoLogOutSharp />} text="Log Out" />
        </ul>
      </nav>
    </div>
  );
}

/* Reusable Menu Item Component */
function MenuItem({ icon, text }) {
  return (
    <li className="flex items-center gap-4 p-2 hover:bg-white hover:text-primary-color cursor-pointer transition-all text-white">
      <span className="text-2xl">{icon}</span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {text}
      </span>
    </li>
  );
}

export default StSideBar;
