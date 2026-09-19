import { APP_ROLES } from "./domain.js";
import { isStaffAppRole } from "./permissions.js";

// Record-level access for startup (group) detail pages.
// Returns 'staff' | 'management' | 'member' | 'mentor' | null (denied).
// - Staff (Manager/Assistant/Portfolio): operational scope (route-gated).
// - Management: view-only oversight.
// - Members (members[].id match): own record.
// - Mentors: ACTIVE assignment on THIS group only (ended = history only,
//   which chat handles separately; page access closes).
// - System Administrator and everyone else: null.
export function resolveGroupAccess({ group, userId, appRole, assignments = [] }) {
  if (!group || !userId || !appRole) return null;
  if (appRole === APP_ROLES.SYS_ADMIN) return null;
  if (isStaffAppRole(appRole) || appRole === APP_ROLES.PORTFOLIO_MANAGER) return "staff";
  if (appRole === APP_ROLES.MANAGEMENT) return "management";
  if ((group.members || []).some((m) => m.id === userId)) return "member";
  const active = (assignments || []).some(
    (a) => a.mentorId === userId && a.groupId === group.id && !a.endedAt
  );
  if (active && appRole === APP_ROLES.MENTOR) return "mentor";
  return null;
}

// Application detail access: owner, staff, or read-only Management.
// System Administrators have no business access.
export function resolveApplicationAccess({ application, userId, appRole }) {
  if (!application || !userId || !appRole) return null;
  if (appRole === APP_ROLES.SYS_ADMIN) return null;
  if (isStaffAppRole(appRole)) return "staff";
  if (appRole === APP_ROLES.MANAGEMENT) return "management";
  if (application.applicantId === userId) return "owner";
  return null;
}
