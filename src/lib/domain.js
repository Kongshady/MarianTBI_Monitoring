// Canonical domain definitions for Marian TBI PMIS.
// Option 1: evolve the current Firebase model — additive and backward-compatible.
// These constants describe what the app SHOULD use going forward. Existing
// Firestore documents with legacy casings/field names keep working via the
// normalize helpers below; no migration or data deletion is required.

export const APP_ROLES = Object.freeze({
  TBI_MANAGER: "TBI Manager",
  TBI_ASSISTANT: "TBI Assistant",
  PORTFOLIO_MANAGER: "Portfolio Manager",
  INCUBATEE: "Incubatee",
  APPLICANT: "Applicant",
  MENTOR: "Mentor",
  MANAGEMENT: "Management",
  SYS_ADMIN: "System Administrator",
});

export const APP_ROLE_LIST = Object.freeze(Object.values(APP_ROLES));

export const GROUP_ROLES = Object.freeze({
  PROJECT_MANAGER: "Project Manager",
  SYSTEM_ANALYST: "System Analyst",
  DEVELOPER: "Developer",
});

export const GROUP_ROLE_LIST = Object.freeze(Object.values(GROUP_ROLES));

export const USER_STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
});

// Lifecycle stage of a person moving through the TBI funnel. Stored on
// users.lifecycleStage; the account (and role history) is preserved —
// promotion mutates this field, never a second account.
export const LIFECYCLE_STAGE = Object.freeze({
  APPLICANT: "applicant",
  INCUBATEE: "incubatee",
});

// Canonical request lifecycle. Legacy documents also contain
// "To be requested" / "On-going" / "Completed" variants — see normalize below.
export const REQUEST_STATUS = Object.freeze({
  PENDING: "Pending",
  REQUESTED: "Requested",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
});

export const REQUEST_STATUS_LIST = Object.freeze(Object.values(REQUEST_STATUS));

const REQUEST_STATUS_ALIASES = Object.freeze({
  pending: REQUEST_STATUS.PENDING,
  requested: REQUEST_STATUS.REQUESTED,
  "to be requested": REQUEST_STATUS.REQUESTED,
  "in progress": REQUEST_STATUS.IN_PROGRESS,
  "on-going": REQUEST_STATUS.IN_PROGRESS,
  ongoing: REQUEST_STATUS.IN_PROGRESS,
  done: REQUEST_STATUS.DONE,
  completed: REQUEST_STATUS.DONE,
});

export function normalizeRequestStatus(value) {
  if (value == null) return REQUEST_STATUS.PENDING;
  const hit = REQUEST_STATUS_ALIASES[String(value).trim().toLowerCase()];
  return hit || REQUEST_STATUS.PENDING;
}

// Canonical task lifecycle.
export const TASK_STATUS = Object.freeze({
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
});

export const TASK_STATUS_LIST = Object.freeze(Object.values(TASK_STATUS));

const TASK_STATUS_ALIASES = Object.freeze({
  pending: TASK_STATUS.PENDING,
  "in progress": TASK_STATUS.IN_PROGRESS,
  completed: TASK_STATUS.COMPLETED,
  done: TASK_STATUS.COMPLETED,
});

export function normalizeTaskStatus(value) {
  if (value == null) return TASK_STATUS.PENDING;
  const hit = TASK_STATUS_ALIASES[String(value).trim().toLowerCase()];
  return hit || TASK_STATUS.PENDING;
}

// Canonical priority. Legacy documents mix High/Medium/Low with
// HIGH/MEDIUM/LOW and lowercase variants.
export const PRIORITY = Object.freeze({
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
});

export const PRIORITY_LIST = Object.freeze(Object.values(PRIORITY));

const PRIORITY_ALIASES = Object.freeze({
  high: PRIORITY.HIGH,
  medium: PRIORITY.MEDIUM,
  low: PRIORITY.LOW,
});

export function normalizePriority(value, fallback = PRIORITY.LOW) {
  if (value == null) return fallback;
  const hit = PRIORITY_ALIASES[String(value).trim().toLowerCase()];
  return hit || fallback;
}

export const PRIORITY_ORDER = Object.freeze({
  [PRIORITY.HIGH]: 1,
  [PRIORITY.MEDIUM]: 2,
  [PRIORITY.LOW]: 3,
});

export function comparePriority(a, b) {
  return (
    (PRIORITY_ORDER[normalizePriority(a)] || 99) -
    (PRIORITY_ORDER[normalizePriority(b)] || 99)
  );
}

// Firestore timestamps are inconsistent today: some docs use `timestamp`,
// others use `createdAt`, and values may be a Firestore Timestamp, a JS
// Date, millis, or an ISO string. This reads both fields without crashing.
export function getNotificationTime(notification) {
  if (!notification) return null;
  return notification.createdAt || notification.timestamp || null;
}

export function toDateSafe(value) {
  if (value == null) return null;
  try {
    if (typeof value.toDate === "function") return value.toDate();
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "number") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value.seconds === "number") {
      const d = new Date(value.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } catch {
    return null;
  }
  return null;
}

export function formatDateSafe(value, fallback = "N/A") {
  const d = toDateSafe(value);
  if (!d) return fallback;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateTimeSafe(value, fallback = "Unknown") {
  const d = toDateSafe(value);
  if (!d) return fallback;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// Groups store `portfolioManager` as a full object today, but some readers
// treat it as a UID string. Support both shapes during the transition.
export function getManagerId(group) {
  if (!group?.portfolioManager) return null;
  if (typeof group.portfolioManager === "string") return group.portfolioManager;
  return group.portfolioManager.id || null;
}

export function getManagerName(group, fallback = "Unassigned") {
  const pm = group?.portfolioManager;
  if (!pm) return fallback;
  if (typeof pm === "string") return pm;
  const full = `${pm.name || ""} ${pm.lastname || ""}`.trim();
  return full || fallback;
}

export function isStaffRole(role) {
  return (
    role === APP_ROLES.TBI_MANAGER ||
    role === APP_ROLES.TBI_ASSISTANT ||
    role === APP_ROLES.PORTFOLIO_MANAGER
  );
}

export function isPrivilegedRole(role) {
  return role === APP_ROLES.TBI_MANAGER || role === APP_ROLES.TBI_ASSISTANT;
}

// Fields an incubatee is allowed to edit on their own profile.
// `role`, `status`, `email` and group assignment stay server/admin-controlled
// (email changes go through the verified Security-area flow instead).
export const SELF_EDITABLE_PROFILE_FIELDS = Object.freeze([
  "name",
  "lastname",
  "mobile",
  "bio",
  "jobTitle",
  "organization",
  "profileImageUrl",
  "profileImagePath",
  "facebook",
  "github",
  "linkedin",
]);

export function pickSelfEditableProfile(input) {
  const out = {};
  for (const key of SELF_EDITABLE_PROFILE_FIELDS) {
    if (input[key] !== undefined) out[key] = input[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// TBI lifecycle model (additive; no legacy behavior changed).
// Assumptions (unanswered spec questions, safest defaults):
// - Team functions (Project Manager / System Analyst / Developer) are kept as
//   legacy groupRole values inside startups; they are NOT app-level roles.
// - Programs are optional per incubatee (continuous intake supported).
// - Evaluations/assessments are free-text + recommendation (no invented scoring).
// - Mentor role exists in the model; login/UI comes later (staff-recorded first).
// ---------------------------------------------------------------------------

export const APPLICATION_STATUS = Object.freeze({
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  SCREENING: "Screening",
  FOR_EVALUATION: "For Evaluation",
  RETURNED: "Returned for Revision",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
});

export const APPLICATION_STATUS_LIST = Object.freeze(Object.values(APPLICATION_STATUS));

export const APPLICATION_TRANSITIONS = Object.freeze({
  [APPLICATION_STATUS.DRAFT]: [APPLICATION_STATUS.SUBMITTED],
  [APPLICATION_STATUS.SUBMITTED]: [APPLICATION_STATUS.SCREENING, APPLICATION_STATUS.RETURNED],
  [APPLICATION_STATUS.SCREENING]: [
    APPLICATION_STATUS.FOR_EVALUATION,
    APPLICATION_STATUS.RETURNED,
    APPLICATION_STATUS.REJECTED,
  ],
  [APPLICATION_STATUS.FOR_EVALUATION]: [
    APPLICATION_STATUS.ACCEPTED,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.RETURNED,
  ],
  [APPLICATION_STATUS.RETURNED]: [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.SUBMITTED],
  [APPLICATION_STATUS.ACCEPTED]: [],
  [APPLICATION_STATUS.REJECTED]: [],
});

export const SCREENING_RESULT = Object.freeze({
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
  WAIVED: "Waived",
});

export const EVALUATION_RECOMMENDATION = Object.freeze({
  PENDING: "Pending",
  RECOMMENDED: "Recommended",
  NOT_RECOMMENDED: "Not Recommended",
  NEEDS_DISCUSSION: "Needs Discussion",
});

export const INCUBATEE_STATUS = Object.freeze({
  ONBOARDING: "Onboarding",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  FINAL_REVIEW: "Final Review",
  GRADUATED: "Graduated",
  EXITED: "Exited",
  WITHDRAWN: "Withdrawn",
  CONTINUING: "Continuing",
});

export const INCUBATEE_STATUS_LIST = Object.freeze(Object.values(INCUBATEE_STATUS));

export const INCUBATEE_TRANSITIONS = Object.freeze({
  [INCUBATEE_STATUS.ONBOARDING]: [INCUBATEE_STATUS.ACTIVE, INCUBATEE_STATUS.WITHDRAWN],
  [INCUBATEE_STATUS.ACTIVE]: [
    INCUBATEE_STATUS.ON_HOLD,
    INCUBATEE_STATUS.FINAL_REVIEW,
    INCUBATEE_STATUS.EXITED,
    INCUBATEE_STATUS.WITHDRAWN,
  ],
  [INCUBATEE_STATUS.ON_HOLD]: [INCUBATEE_STATUS.ACTIVE, INCUBATEE_STATUS.EXITED, INCUBATEE_STATUS.WITHDRAWN],
  [INCUBATEE_STATUS.FINAL_REVIEW]: [
    INCUBATEE_STATUS.GRADUATED,
    INCUBATEE_STATUS.EXITED,
    INCUBATEE_STATUS.CONTINUING,
  ],
  [INCUBATEE_STATUS.GRADUATED]: [],
  [INCUBATEE_STATUS.EXITED]: [],
  [INCUBATEE_STATUS.WITHDRAWN]: [],
  [INCUBATEE_STATUS.CONTINUING]: [INCUBATEE_STATUS.ACTIVE, INCUBATEE_STATUS.FINAL_REVIEW],
});

export const MILESTONE_STATUS = Object.freeze({
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  DEFERRED: "Deferred",
});

export const MILESTONE_STATUS_LIST = Object.freeze(Object.values(MILESTONE_STATUS));

export const MILESTONE_TRANSITIONS = Object.freeze({
  [MILESTONE_STATUS.NOT_STARTED]: [MILESTONE_STATUS.IN_PROGRESS, MILESTONE_STATUS.DEFERRED],
  [MILESTONE_STATUS.IN_PROGRESS]: [MILESTONE_STATUS.COMPLETED, MILESTONE_STATUS.DEFERRED],
  [MILESTONE_STATUS.DEFERRED]: [MILESTONE_STATUS.NOT_STARTED, MILESTONE_STATUS.IN_PROGRESS],
  [MILESTONE_STATUS.COMPLETED]: [],
});

// Overdue is derived from dueDate + open status, never a stored primary state.
export function isMilestoneOverdue(milestone, now = new Date()) {
  if (!milestone) return false;
  if (milestone.status === MILESTONE_STATUS.COMPLETED) return false;
  const due = toDateSafe(milestone.dueDate);
  if (!due) return false;
  return due.getTime() < now.getTime();
}

export const PROGRAM_STATUS = Object.freeze({
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
});

export const ACTIVITY_TYPE = Object.freeze({
  TRAINING: "Training",
  WORKSHOP: "Workshop",
  SEMINAR: "Seminar",
  CONSULTATION: "Consultation",
  NETWORKING: "Networking",
  PITCHING: "Pitching",
  DEMO_DAY: "Demo Day",
  MENTORING: "Mentoring Session",
  OTHER: "Other",
});

export const ATTENDANCE_STATUS = Object.freeze({
  REGISTERED: "Registered",
  ATTENDED: "Attended",
  ABSENT: "Absent",
  EXCUSED: "Excused",
});

export const REPORT_STATUS = Object.freeze({
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  NEEDS_REVISION: "Needs Revision",
});

export const REPORT_TRANSITIONS = Object.freeze({
  [REPORT_STATUS.DRAFT]: [REPORT_STATUS.SUBMITTED],
  [REPORT_STATUS.SUBMITTED]: [REPORT_STATUS.UNDER_REVIEW, REPORT_STATUS.NEEDS_REVISION],
  [REPORT_STATUS.UNDER_REVIEW]: [REPORT_STATUS.APPROVED, REPORT_STATUS.NEEDS_REVISION],
  [REPORT_STATUS.NEEDS_REVISION]: [REPORT_STATUS.DRAFT, REPORT_STATUS.SUBMITTED],
  [REPORT_STATUS.APPROVED]: [],
});

export const DOCUMENT_STATUS = Object.freeze({
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
});

export const OUTCOME_TYPE = Object.freeze({
  GRADUATED: "Graduated",
  EXITED: "Exited",
  WITHDRAWN: "Withdrawn",
  CONTINUING: "Continuing",
});

export function canTransition(transitionMap, from, to) {
  if (!from || !to) return false;
  const allowed = transitionMap[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
