import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "../pages/LandingPage.jsx";
import Login from "../pages/Login.jsx";
import PasswordReset from "../pages/PasswordReset.jsx";
import CreateAccount from "../pages/CreateAccPage.jsx";
import WaitingForApproval from "../pages/WaitingForApproval.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";
import Forbidden from "../pages/Forbidden.jsx";
import Applications from "../pages/applications/Applications.jsx";
import ApplicationDetail from "../pages/applications/ApplicationDetail.jsx";
import Programs from "../pages/programs/Programs.jsx";
import ProgramDetail from "../pages/programs/ProgramDetail.jsx";
import Activities from "../pages/activities/Activities.jsx";
import ActivityDetail from "../pages/activities/ActivityDetail.jsx";
import Announcements from "../pages/announcements/Announcements.jsx";

const LIFECYCLE_ROLES = [
  "Applicant",
  "Incubatee",
  "Mentor",
  "TBI Manager",
  "TBI Assistant",
  "Portfolio Manager",
  "Management",
  "System Administrator",
  "Project Manager",
  "System Analyst",
  "Developer",
];

// Oversight routes: staff plus read-oriented Management.
const OVERSIGHT_ROLES = ["TBI Manager", "TBI Assistant", "Management"];

// Incubatee Pages
import IncubateeCreateAccount from "../pages/incubatee/IncubateeCreateAccount.jsx";
import IncuDashboard from "../pages/incubatee/IncuDashboard.jsx";
import IncuGroups from "../pages/incubatee/IncuGroups.jsx";
import IncuNotifications from "../pages/incubatee/IncuNotifications.jsx";
import IncuChat from "../pages/incubatee/IncuChat.jsx";
import IncuViewGroup from "../components/semi-pages/IncuViewGroups.jsx";
import IncuEditProfile from "../components/edit-profile/IncuEditProfile.jsx";

// Employee Pages
import EmployeeCreateAccount from "../pages/employee/EmployeeCreateAccount.jsx";
import EmDashboard from "../pages/employee/EmDashboard.jsx";
import EmGroups from "../pages/employee/EmGroups.jsx";
import EmNotification from "../pages/employee/EmNotification.jsx";
import EmChat from "../pages/employee/EmChat.jsx";
import EmViewGroup from "../components/semi-pages/EmViewGroups.jsx";
// Staff profiles share the working edit-profile form (role-agnostic).
import StaffEditProfile from "../components/edit-profile/IncuEditProfile.jsx";


// Admin Pages (admins sign in via employee login; there is no separate admin account type)
import AdDashboard from "../pages/admin/AdDashboard.jsx";
import AdChat from "../pages/admin/AdChat.jsx";
import AdNotification from "../pages/admin/AdNotification.jsx";
import AdGroups from "../pages/admin/AdGroups.jsx";
import AdUserManagement from "../pages/admin/AdUserManagement.jsx";
import AdViewGroups from "../components/semi-pages/AdViewGroups.jsx";
import AdArchives from "../pages/admin/AdArchives.jsx";
import AuditLog from "../pages/admin/system/AuditLog.jsx";
import Roles from "../pages/admin/system/Roles.jsx";
import System from "../pages/admin/system/System.jsx";


function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/password-reset" element={<PasswordReset />} />
      <Route path="/create-account" element={<CreateAccount />} />
      <Route path="/waiting-for-approval" element={<WaitingForApproval />} />
      <Route path="/forbidden" element={<Forbidden />} />

      {/* Lifecycle: applications (alongside existing groups) */}
      <Route
        path="/applications"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <Applications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applications/:id"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <ApplicationDetail />
          </ProtectedRoute>
        }
      />

      {/* Lifecycle: programs */}
      <Route
        path="/programs"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <Programs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/programs/:id"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <ProgramDetail />
          </ProtectedRoute>
        }
      />

      {/* Lifecycle: activities */}
      <Route
        path="/activities"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <Activities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/activities/:id"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <ActivityDetail />
          </ProtectedRoute>
        }
      />

      {/* Lifecycle: announcements */}
      <Route
        path="/announcements"
        element={
          <ProtectedRoute allowedRoles={LIFECYCLE_ROLES}>
            <Announcements />
          </ProtectedRoute>
        }
      />

      {/* Incubatee Routes */}
      {/* Role-split logins consolidated into /login (bookmarks keep working). */}
      <Route path="/incubatee-login" element={<Navigate to="/login" replace />} />
      <Route path="/incubatee-create-account" element={<IncubateeCreateAccount />} />
      <Route
        path="/incubatee-dashboard"
        element={
          <ProtectedRoute allowedRoles={["Applicant", "Incubatee", "Mentor", "Project Manager", "System Analyst", "Developer"]}>
            <IncuDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incubatee-group"
        element={
          <ProtectedRoute allowedRoles={["Applicant", "Incubatee", "Mentor", "Project Manager", "System Analyst", "Developer"]}>
            <IncuGroups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incubatee-notification"
        element={
          <ProtectedRoute allowedRoles={["Applicant", "Incubatee", "Mentor", "Project Manager", "System Analyst", "Developer"]}>
            <IncuNotifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incubatee-chat"
        element={
          <ProtectedRoute allowedRoles={["Applicant", "Incubatee", "Mentor", "Project Manager", "System Analyst", "Developer"]}>
            <IncuChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incubatee/view-group/:groupId"
        element={
          <ProtectedRoute allowedRoles={["Applicant", "Incubatee", "Mentor", "Project Manager", "System Analyst", "Developer"]}>
            <IncuViewGroup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incubatee-editprofile"
        element={
          <ProtectedRoute allowedRoles={["Applicant", "Incubatee", "Mentor", "Project Manager", "System Analyst", "Developer"]}>
            <IncuEditProfile />
          </ProtectedRoute>
        }
      />


      {/* Employee Routes */}
      <Route path="/employee-login" element={<Navigate to="/login" replace />} />
      <Route path="/employee-create-account" element={<EmployeeCreateAccount />} />
      <Route
        path="/employee-dashboard"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "Portfolio Manager", "TBI Assistant"]}>
            <EmDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee-groups"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "Portfolio Manager", "TBI Assistant"]}>
            <EmGroups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee-notification"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "Portfolio Manager", "TBI Assistant"]}>
            <EmNotification />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee-chat"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "Portfolio Manager", "TBI Assistant"]}>
            <EmChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee/view-group/:groupId"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "Portfolio Manager", "TBI Assistant"]}>
            <EmViewGroup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/employee-editprofile"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "Portfolio Manager", "TBI Assistant"]}>
            <StaffEditProfile />
          </ProtectedRoute>
        }
      />


      {/* Admin Routes */}
      {/* Legacy /admin-login URL kept working */}
      <Route path="/admin-login" element={<Navigate to="/login" replace />} />
      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "TBI Assistant", "Management", "System Administrator"]}>
            <AdDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-groups"
        element={
          <ProtectedRoute allowedRoles={OVERSIGHT_ROLES}>
            <AdGroups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-user-management"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "System Administrator"]}>
            <AdUserManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-notification"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "TBI Assistant", "Management", "System Administrator"]}>
            <AdNotification />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-chat"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "TBI Assistant", "Management", "System Administrator"]}>
            <AdChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/view-group/:groupId"
        element={
          <ProtectedRoute allowedRoles={OVERSIGHT_ROLES}>
            <AdViewGroups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-editprofile"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "TBI Assistant", "Management", "System Administrator"]}>
            <StaffEditProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-groups/archives"
        element={
          <ProtectedRoute allowedRoles={OVERSIGHT_ROLES}>
            <AdArchives />
          </ProtectedRoute>
        }
      />

      {/* System administration (System Administrator only — Managers
          assign predefined roles but never configure the system) */}
      <Route
        path="/admin/audit"
        element={
          <ProtectedRoute allowedRoles={["System Administrator"]}>
            <AuditLog />
          </ProtectedRoute>
        }
      />
      {/* Roles & permissions: Managers get a read-only reference so role
          assignment stays deliberate; only System Administrators configure. */}
      <Route
        path="/admin/roles"
        element={
          <ProtectedRoute allowedRoles={["TBI Manager", "System Administrator"]}>
            <Roles />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/system"
        element={
          <ProtectedRoute allowedRoles={["System Administrator"]}>
            <System />
          </ProtectedRoute>
        }
      />

      {/* Unknown paths fall back to landing instead of rendering blank */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;