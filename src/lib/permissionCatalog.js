// Human-readable permission catalog for the Roles & Permissions interface.
//
// Structure: Role → Module → Action → Scope. Technical keys stay internal —
// they are the stable identifiers stored in role overrides and the audit
// log — but the UI leads with module, action, and scope.
//
// This catalog describes the code-defined defaults in src/lib/roles.js and
// the enforcement in firestore.rules. It adds no access by itself: with no
// override documents, effective permissions equal the defaults exactly.
// Every key in ROLE_PERMISSIONS appears here exactly once.

export const SCOPES = Object.freeze({
  ALL: "All",
  ORGANIZATION: "Organization",
  ASSIGNED: "Assigned",
  OWN: "Own",
});

export const SCOPE_DESCRIPTIONS = Object.freeze({
  [SCOPES.ALL]: "Every record in the module, program-wide.",
  [SCOPES.ORGANIZATION]: "Organization-wide visibility for oversight; read-oriented.",
  [SCOPES.ASSIGNED]: "Only records explicitly assigned to this person (startup, mentee, portfolio).",
  [SCOPES.OWN]: "Only records this person owns or created.",
});

export const MODULES = Object.freeze([
  { name: "Applications", description: "Intake pipeline from draft to decision." },
  { name: "Incubatees", description: "Startups, milestones, requests, and lifecycle moves." },
  { name: "Programs", description: "Cohorts and program records." },
  { name: "Activities", description: "Events, sessions, and attendance." },
  { name: "Mentorship", description: "Mentor assignments and recorded sessions." },
  { name: "Reports", description: "Progress reports from draft to review." },
  { name: "Documents", description: "Submitted files and verification." },
  { name: "Assessments", description: "Evaluations and recorded results." },
  { name: "Announcements", description: "Published broadcasts and their management." },
  { name: "Messages", description: "Direct messaging between authorized accounts." },
  { name: "Users", description: "Accounts, approval, status, and role assignment." },
  { name: "System", description: "Role configuration, settings, and the audit trail." },
  { name: "Account", description: "The signed-in person's own profile." },
]);

// Role summaries shown in the role list. Assignment happens per-account in
// user management; configuration happens here (System Administrator only).
export const ROLE_SUMMARIES = Object.freeze({
  "TBI Manager": "Owns operations, decisions, outcomes, and TBI membership.",
  "TBI Assistant": "Runs day-to-day operations; no decisions, outcomes, or deletes.",
  "Portfolio Manager": "Works an assigned portfolio of startups; read-oriented elsewhere.",
  "Incubatee": "Manages their own startup record, milestones, and reports.",
  "Applicant": "Applies and tracks their own application.",
  "Mentor": "Views assigned startups and records their own sessions.",
  "Management": "Organization-wide read oversight; writes stay closed.",
  "System Administrator": "Owns users, role configuration, settings, and audit. No business access.",
});

// key, module, action (human-readable), scope, description, sensitive.
// Sensitive entries need explicit authority and confirmation to change.
export const PERMISSION_CATALOG = Object.freeze([
  // ---- Account ----
  { key: "profile.edit.own", module: "Account", action: "Edit", scope: SCOPES.OWN, sensitive: false, description: "Edit their own profile fields. Role, status, and startup link are never self-editable." },
  // ---- Applications ----
  { key: "applications.create.own", module: "Applications", action: "Create", scope: SCOPES.OWN, sensitive: false, description: "Start and submit their own application." },
  { key: "applications.read.own", module: "Applications", action: "View", scope: SCOPES.OWN, sensitive: false, description: "Track the status and history of their own application." },
  { key: "applications.review", module: "Applications", action: "Review", scope: SCOPES.ALL, sensitive: false, description: "Screen applications and move them through evaluation. Final decisions stay with the TBI Manager." },
  { key: "applications.review.decide", module: "Applications", action: "Approve / Reject", scope: SCOPES.ALL, sensitive: true, description: "Accept or reject applications. TBI Manager authority, enforced server-side." },
  // ---- Incubatees ----
  { key: "startup.read.own", module: "Incubatees", action: "View", scope: SCOPES.OWN, sensitive: false, description: "View their own startup record." },
  { key: "startup.update.own.team", module: "Incubatees", action: "Edit", scope: SCOPES.OWN, sensitive: false, description: "Update their own startup record through team functions." },
  { key: "startups.read.assigned", module: "Incubatees", action: "View", scope: SCOPES.ASSIGNED, sensitive: false, description: "View startups in their assigned portfolio." },
  { key: "startups.manage", module: "Incubatees", action: "Manage", scope: SCOPES.ALL, sensitive: false, description: "Create and manage startup records program-wide." },
  { key: "incubatees.read.assigned", module: "Incubatees", action: "View", scope: SCOPES.ASSIGNED, sensitive: false, description: "View assigned startups for mentoring work." },
  { key: "milestones.manage.own", module: "Incubatees", action: "Manage", scope: SCOPES.OWN, sensitive: false, description: "Manage milestones for their own startup." },
  { key: "milestones.read.assigned", module: "Incubatees", action: "View", scope: SCOPES.ASSIGNED, sensitive: false, description: "Follow milestones for assigned startups." },
  { key: "requests.triage.assigned", module: "Incubatees", action: "Review", scope: SCOPES.ASSIGNED, sensitive: false, description: "Triage assistance requests from assigned startups." },
  { key: "incubation.move.nonterminal", module: "Incubatees", action: "Manage", scope: SCOPES.ALL, sensitive: false, description: "Move startups between working stages. Terminal outcomes (graduate / exit) stay with the TBI Manager." },
  { key: "incubation.manage.outcomes", module: "Incubatees", action: "Approve / Reject", scope: SCOPES.ALL, sensitive: true, description: "Record graduation and exit outcomes. TBI Manager authority; outcome records are append-only." },
  { key: "oversight.read.organization", module: "Incubatees", action: "View", scope: SCOPES.ORGANIZATION, sensitive: false, description: "Organization-wide read visibility for oversight. Writes stay closed." },
  // ---- Programs ----
  { key: "programs.manage", module: "Programs", action: "Manage", scope: SCOPES.ALL, sensitive: false, description: "Create and edit programs and cohorts." },
  { key: "programs.manage.delete", module: "Programs", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove programs. TBI Manager authority." },
  // ---- Activities ----
  { key: "activities.read", module: "Activities", action: "View", scope: SCOPES.ALL, sensitive: false, description: "Browse published activities." },
  { key: "activities.read.register", module: "Activities", action: "View", scope: SCOPES.ALL, sensitive: false, description: "Browse and register for activities." },
  { key: "activities.manage", module: "Activities", action: "Manage", scope: SCOPES.ALL, sensitive: false, description: "Create, edit, and run activities, including attendance." },
  { key: "activities.manage.delete", module: "Activities", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove activities. TBI Manager authority." },
  // ---- Mentorship ----
  { key: "mentorship.read.own", module: "Mentorship", action: "View", scope: SCOPES.OWN, sensitive: false, description: "View their own mentoring sessions." },
  { key: "mentorship.read.assigned", module: "Mentorship", action: "View", scope: SCOPES.ASSIGNED, sensitive: false, description: "Follow mentoring work for assigned startups." },
  { key: "mentorship.record.assigned", module: "Mentorship", action: "Create", scope: SCOPES.ASSIGNED, sensitive: false, description: "Record sessions for assigned startups." },
  { key: "mentorship.assign", module: "Mentorship", action: "Assign", scope: SCOPES.ALL, sensitive: false, description: "Pair mentors with startups program-wide." },
  // ---- Reports ----
  { key: "reports.submit.own", module: "Reports", action: "Create", scope: SCOPES.OWN, sensitive: false, description: "Draft and submit their own progress reports." },
  { key: "reports.read.assigned", module: "Reports", action: "View", scope: SCOPES.ASSIGNED, sensitive: false, description: "Read reports from assigned startups." },
  { key: "reports.review", module: "Reports", action: "Review", scope: SCOPES.ALL, sensitive: false, description: "Review submitted reports program-wide." },
  { key: "reports.review.delete", module: "Reports", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove reports. TBI Manager authority." },
  // ---- Documents ----
  { key: "documents.upload.own", module: "Documents", action: "Create", scope: SCOPES.OWN, sensitive: false, description: "Upload their own supporting documents." },
  { key: "documents.verify", module: "Documents", action: "Review", scope: SCOPES.ALL, sensitive: false, description: "Verify submitted documents program-wide." },
  { key: "documents.verify.delete", module: "Documents", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove documents. TBI Manager authority." },
  // ---- Assessments ----
  { key: "assessments.read.own", module: "Assessments", action: "View", scope: SCOPES.OWN, sensitive: false, description: "See their own assessment results." },
  { key: "assessments.input.assigned", module: "Assessments", action: "Create", scope: SCOPES.ASSIGNED, sensitive: false, description: "Provide assessment input for assigned startups." },
  { key: "assessments.manage", module: "Assessments", action: "Manage", scope: SCOPES.ALL, sensitive: false, description: "Run assessments program-wide." },
  { key: "assessments.manage.delete", module: "Assessments", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove assessments. TBI Manager authority." },
  // ---- Announcements ----
  { key: "announcements.read", module: "Announcements", action: "View", scope: SCOPES.ALL, sensitive: false, description: "Read announcements published to their role." },
  { key: "announcements.manage", module: "Announcements", action: "Manage", scope: SCOPES.ALL, sensitive: false, description: "Publish and edit announcements. Removing means unpublishing (archive)." },
  { key: "announcements.manage.delete", module: "Announcements", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove announcements. TBI Manager authority." },
  // ---- Messages ----
  { key: "messages.authorized", module: "Messages", action: "Create", scope: SCOPES.ASSIGNED, sensitive: false, description: "Message only established, authorized contacts — never the System Administrator." },
  { key: "messages.authorized.chain", module: "Messages", action: "View", scope: SCOPES.ORGANIZATION, sensitive: false, description: "Oversight-level messaging visibility through the reporting chain." },
  // ---- Users ----
  { key: "users.approve", module: "Users", action: "Approve / Reject", scope: SCOPES.ALL, sensitive: true, description: "Approve or reject pending registrations. Audited per account." },
  { key: "users.disable", module: "Users", action: "Disable", scope: SCOPES.ALL, sensitive: true, description: "Disable accounts to revoke access without deleting history." },
  { key: "users.remove", module: "Users", action: "Delete", scope: SCOPES.ALL, sensitive: true, description: "Permanently remove accounts. Prefer disabling unless removal is required." },
  { key: "roles.assign", module: "Users", action: "Assign", scope: SCOPES.ALL, sensitive: true, description: "Assign predefined roles per account. Never edits what a role contains." },
  // ---- System ----
  { key: "roles.configure", module: "System", action: "Manage", scope: SCOPES.ALL, sensitive: true, description: "Grant or revoke permissions on roles. System Administrator only; the System Administrator role itself is locked." },
  { key: "system.configure", module: "System", action: "Manage", scope: SCOPES.ALL, sensitive: true, description: "Change system settings such as registration. System Administrator only." },
  { key: "audit.read.full", module: "System", action: "View", scope: SCOPES.ALL, sensitive: true, description: "Read the full audit trail. System Administrator only; the log is append-only." },
]);

const byKey = new Map(PERMISSION_CATALOG.map((p) => [p.key, p]));

export function catalogEntryFor(key) {
  return byKey.get(key) || null;
}

// Every catalog key must exist in the defaults exactly as coded — guards
// against the catalog drifting from src/lib/roles.js.
export function catalogKeys() {
  return PERMISSION_CATALOG.map((p) => p.key);
}

export function permissionsForModule(moduleName) {
  return PERMISSION_CATALOG.filter((p) => p.module === moduleName);
}

export function sensitiveCatalogKeys() {
  return PERMISSION_CATALOG.filter((p) => p.sensitive).map((p) => p.key);
}
