import { APP_ROLES } from "./domain.js";

// Role model for MarianTrack RBAC.
//
// Roles determine DEFAULT permissions: what each role can do unless a
// sensitive action says otherwise. Sensitive actions (approving users,
// changing roles, deleting institutional records, recording outcomes)
// additionally require Manager or System Administrator authority, checked
// in Firestore rules — never by hiding UI alone.
//
// Design notes:
// - System Administrator is system-scoped (users, roles, audit, config).
//   Business collections deny SysAdmin writes by rule, and it holds no
//   operational role by default.
// - Management is read-oriented oversight; writes stay closed by rule.
// - Applicant → Incubatee is a lifecycle promotion on one account, not a
//   separate role grant.

export const ACCOUNT_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  DISABLED: "disabled",
});

// Default permission keys per role. Keys are descriptive (see
// docs/permissions-matrix.md); enforcement lives in firestore.rules and
// src/lib/permissions.js helpers.
export const ROLE_PERMISSIONS = Object.freeze({
  [APP_ROLES.APPLICANT]: Object.freeze([
    "profile.edit.own",
    "applications.create.own",
    "applications.read.own",
    "documents.upload.own",
    "activities.read",
    "announcements.read",
    "messages.authorized",
  ]),
  [APP_ROLES.INCUBATEE]: Object.freeze([
    "profile.edit.own",
    "applications.read.own",
    "startup.read.own",
    "startup.update.own.team",
    "milestones.manage.own",
    "reports.submit.own",
    "documents.upload.own",
    "activities.read.register",
    "mentorship.read.own",
    "assessments.read.own",
    "announcements.read",
    "messages.authorized",
  ]),
  [APP_ROLES.MENTOR]: Object.freeze([
    "profile.edit.own",
    "incubatees.read.assigned",
    "mentorship.record.assigned",
    "assessments.input.assigned",
    "activities.read",
    "announcements.read",
    "messages.authorized",
  ]),
  [APP_ROLES.PORTFOLIO_MANAGER]: Object.freeze([
    "profile.edit.own",
    "startups.read.assigned",
    "requests.triage.assigned",
    "milestones.read.assigned",
    "reports.read.assigned",
    "mentorship.read.assigned",
    "activities.read.register",
    "announcements.read",
    "messages.authorized",
  ]),
  [APP_ROLES.TBI_ASSISTANT]: Object.freeze([
    "profile.edit.own",
    "applications.review",
    "startups.manage",
    "programs.manage",
    "activities.manage",
    "mentorship.assign",
    "reports.review",
    "assessments.manage",
    "documents.verify",
    "incubation.move.nonterminal",
    "announcements.manage",
    "messages.authorized",
  ]),
  [APP_ROLES.TBI_MANAGER]: Object.freeze([
    "profile.edit.own",
    "applications.review.decide",
    "startups.manage",
    "programs.manage.delete",
    "activities.manage.delete",
    "mentorship.assign",
    "reports.review.delete",
    "assessments.manage.delete",
    "documents.verify.delete",
    "incubation.manage.outcomes",
    "announcements.manage.delete",
    "users.approve",
    "users.disable",
    "users.remove",
    "roles.assign",
    "messages.authorized",
  ]),
  [APP_ROLES.MANAGEMENT]: Object.freeze([
    "profile.edit.own",
    "oversight.read.organization",
    "announcements.read",
    "messages.authorized.chain",
  ]),
  [APP_ROLES.SYS_ADMIN]: Object.freeze([
    "profile.edit.own",
    "users.approve",
    "users.disable",
    "users.remove",
    "roles.assign",
    "roles.configure",
    "system.configure",
    "audit.read.full",
    "announcements.read",
  ]),
});

export function defaultPermissionsFor(role) {
  return ROLE_PERMISSIONS[role] || Object.freeze([]);
}

// Sensitive actions always require explicit authority, regardless of
// defaults. Returns true when the actor role may perform the action.
// - Business decisions/outcomes/deletes: TBI Manager only.
// - User administration and role assignment: Manager or System Administrator.
// - System surface (roles config, settings, full audit): SysAdmin only.
//   Managers assign predefined roles; they can never grant, configure, or
//   escalate permissions beyond that.
export function mayPerformSensitive(action, actorRole) {
  const managerOnly = new Set([
    "applications.decide",
    "incubation.record.outcome",
    "records.delete.institutional",
  ]);
  const adminOnly = new Set([
    "users.approve",
    "users.disable",
    "users.remove",
    "roles.assign",
  ]);
  const sysadminOnly = new Set([
    "roles.configure",
    "system.configure",
    "audit.read.full",
  ]);
  if (managerOnly.has(action)) return actorRole === APP_ROLES.TBI_MANAGER;
  if (adminOnly.has(action)) {
    return actorRole === APP_ROLES.TBI_MANAGER || actorRole === APP_ROLES.SYS_ADMIN;
  }
  if (sysadminOnly.has(action)) return actorRole === APP_ROLES.SYS_ADMIN;
  return false;
}
