import { MdDashboard, MdGroups, MdManageAccounts, MdAssignment, MdSchool, MdEvent, MdCampaign, MdHistory, MdVpnKey, MdSettings } from "react-icons/md";
import { IoMdNotifications } from "react-icons/io";
import { IoChatbox } from "react-icons/io5";
import { canManageUsers, canViewSystemConfig, isStaffAppRole, isPortfolioManagerRole } from "../../lib/permissions.js";

// Single source of truth for role-based navigation. Only routes that exist
// are listed — no placeholder entries (see docs/permissions-matrix.md).
export function homePath(role) {
  if (isStaffAppRole(role) || role === "Management") return "/admin-dashboard";
  if (isPortfolioManagerRole(role)) return "/employee-dashboard";
  if (role === "System Administrator") return "/admin-user-management";
  return "/incubatee-dashboard";
}

export function groupsPath(role) {
  if (isStaffAppRole(role) || role === "Management") return "/admin-groups";
  if (isPortfolioManagerRole(role)) return "/employee-groups";
  return "/incubatee-group";
}

export function notificationsPath(role) {
  if (isStaffAppRole(role) || role === "Management" || role === "System Administrator") {
    return "/admin-notification";
  }
  if (isPortfolioManagerRole(role)) return "/employee-notification";
  return "/incubatee-notification";
}

export function chatPath(role) {
  if (isStaffAppRole(role) || role === "Management" || role === "System Administrator") {
    return "/admin-chat";
  }
  if (isPortfolioManagerRole(role)) return "/employee-chat";
  return "/incubatee-chat";
}

export function groupDetailPath(role, groupId) {
  if (isStaffAppRole(role) || role === "Management") return `/admin/view-group/${groupId}`;
  if (isPortfolioManagerRole(role)) return `/employee/view-group/${groupId}`;
  return `/incubatee/view-group/${groupId}`;
}

export function profilePath(role) {
  if (isStaffAppRole(role) || role === "Management" || role === "System Administrator") {
    return "/admin-editprofile";
  }
  if (isPortfolioManagerRole(role)) return "/employee-editprofile";
  return "/incubatee-editprofile";
}

export function navSections(role) {
  const sysAdmin = role === "System Administrator";
  const sections = [
    {
      label: "Overview",
      items: [{ to: homePath(role), label: "Dashboard", icon: MdDashboard, key: "dashboard" }],
    },
  ];

  if (!sysAdmin) {
    sections.push({
      label: "Workflow",
      items: [
        { to: "/applications", label: "Applications", icon: MdAssignment, key: "applications" },
        { to: groupsPath(role), label: "Incubatees", icon: MdGroups, key: "incubatees" },
        { to: "/programs", label: "Programs", icon: MdSchool, key: "programs" },
        { to: "/activities", label: "Activities", icon: MdEvent, key: "activities" },
      ],
    });
  }

  sections.push({
    label: "Communication",
    items: [
      { to: "/announcements", label: "Announcements", icon: MdCampaign, key: "announcements" },
      { to: notificationsPath(role), label: "Notifications", icon: IoMdNotifications, key: "notifications", badge: "notifications" },
      { to: chatPath(role), label: "Messages", icon: IoChatbox, key: "messages", badge: "messages" },
    ],
  });

  if (canManageUsers(role)) {
    const items = [
      { to: "/admin-user-management", label: "Users", icon: MdManageAccounts, key: "users" },
      // Roles reference is readable by Managers (read-only); audit and
      // system configuration stay System Administrator only. Managers
      // assign predefined roles; they never configure the system.
      { to: "/admin/roles", label: "Roles", icon: MdVpnKey, key: "roles" },
    ];
    if (canViewSystemConfig(role)) {
      items.push(
        { to: "/admin/audit", label: "Audit Logs", icon: MdHistory, key: "audit" },
        { to: "/admin/system", label: "System", icon: MdSettings, key: "system" },
      );
    }
    sections.push({ label: "Administration", items });
  }

  return sections;
}
