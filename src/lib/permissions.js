import { APP_ROLES, GROUP_ROLES } from "./domain.js";

// Central authorization helpers for Marian TBI PMIS.
//
// WHO → CAN DO WHAT, ON WHICH RECORD, AT WHICH WORKFLOW STATE.
// Screens must derive every role check from this module — never compare
// role strings inline — so the matrix in docs/permissions-matrix.md stays
// true. These helpers drive UX only; Firestore rules remain the enforced
// security boundary.
//
// Current posture (matches existing behavior; revisit with Management):
// - Accept/Reject + Graduate/Exit decisions: TBI Manager authority.
// - Portfolio Managers: operational on assigned startups, read-only on
//   lifecycle status changes.
// - Team functions (Project Manager / System Analyst / Developer) scope
//   what a startup member may touch inside their own group.

export const STAFF_APP_ROLES = Object.freeze([APP_ROLES.TBI_MANAGER, APP_ROLES.TBI_ASSISTANT]);
export const MANAGER_APP_ROLES = Object.freeze([APP_ROLES.TBI_MANAGER]);

export function isStaffAppRole(role) {
  return STAFF_APP_ROLES.includes(role);
}

export function isManagerAppRole(role) {
  return MANAGER_APP_ROLES.includes(role);
}

export function isPortfolioManagerRole(role) {
  return role === APP_ROLES.PORTFOLIO_MANAGER;
}

export function isMentorRole(role) {
  return role === APP_ROLES.MENTOR;
}

// Roles with a professional profile shape (title, organization, bio)
// instead of the plain applicant layout.
export function hasProfessionalProfile(role) {
  return (
    isStaffAppRole(role) ||
    isPortfolioManagerRole(role) ||
    isMentorRole(role) ||
    isManagementRole(role) ||
    isSysAdminRole(role)
  );
}

export function isManagementRole(role) {
  return role === APP_ROLES.MANAGEMENT;
}

export function isSysAdminRole(role) {
  return role === APP_ROLES.SYS_ADMIN;
}

// System surface (roles config, audit, settings): System Administrator
// only. TBI Managers assign predefined roles but never configure the
// system itself — enforced by route gates + Firestore rules.
export function canViewSystemConfig(role) {
  return isSysAdminRole(role);
}

export function canManageSystem(role) {
  return isSysAdminRole(role);
}

// Management: organization-wide oversight, read-oriented. Writes stay
// closed (rules deny non-staff business writes), so adding Management to a
// read route can never grant edit power.
export function canViewOversight(role) {
  return isStaffAppRole(role) || isManagementRole(role) || isPortfolioManagerRole(role);
}

// Shell selection for the shared lifecycle pages.
export function usesAdminShell(role) {
  return isStaffAppRole(role) || isManagementRole(role) || isSysAdminRole(role);
}

// ---- applications ----
export function canReviewApplications(appRole) {
  return isStaffAppRole(appRole);
}

export function canDecideApplications(appRole) {
  return isManagerAppRole(appRole);
}

export function canOnboardApplication(appRole) {
  return isStaffAppRole(appRole);
}

// ---- programs / activities ----
export function canManagePrograms(appRole) {
  return isStaffAppRole(appRole);
}

export function canDeleteProgram(appRole) {
  return isManagerAppRole(appRole);
}

export function canManageActivities(appRole) {
  return isStaffAppRole(appRole);
}

export function canDeleteActivity(appRole) {
  return isManagerAppRole(appRole);
}

// ---- startup-scoped management (staff side) ----
export function canAssignMentors({ appRole } = {}) {
  return isStaffAppRole(appRole);
}

export function canReviewReports({ appRole } = {}) {
  return isStaffAppRole(appRole);
}

export function canManageAssessments({ appRole } = {}) {
  return isStaffAppRole(appRole);
}

export function canDeleteAssessment({ appRole } = {}) {
  return isManagerAppRole(appRole);
}

export function canManageIncubationStatus({ appRole } = {}) {
  return isStaffAppRole(appRole);
}

export function canDeleteMilestone({ appRole, groupRole } = {}) {
  return isStaffAppRole(appRole) || groupRole === GROUP_ROLES.PROJECT_MANAGER;
}

// ---- startup team functions (member side) ----
export function canSubmitAsTeamMember(groupRole) {
  return groupRole !== GROUP_ROLES.SYSTEM_ANALYST && groupRole !== GROUP_ROLES.DEVELOPER;
}

export function isProjectManager(groupRole) {
  return groupRole === GROUP_ROLES.PROJECT_MANAGER;
}

// ---- users / system ----
// User administration is shared: Managers run TBI membership, SysAdmins run
// the system. Either may approve/disable/remove/assign predefined roles.
export function canManageUsers(appRole) {
  return isManagerAppRole(appRole) || isSysAdminRole(appRole);
}

export function canManageRoles(appRole) {
  return isManagerAppRole(appRole) || isSysAdminRole(appRole);
}

export function canViewAuditLog(appRole) {
  return isSysAdminRole(appRole);
}

// ── Role family for visual accent distinction ──
// "tbi" → magenta (#B8216A) for internal TBI staff
// "incubatee" → teal (#03888F) for startup-facing users
export function getRoleFamily(role) {
  if (isStaffAppRole(role) || isManagementRole(role) || isSysAdminRole(role) || isPortfolioManagerRole(role)) {
    return "tbi";
  }
  return "incubatee";
}
