// Notification event catalog: every workflow event that may notify,
// its bucket, and who it is scoped to. Buckets drive the page filters:
// "action" = Action required, "update" = Updates, "reminder" = Reminders.
//
// Scoping rule (enforced at the call site, never assumed here): recipients
// are always the people responsible for the record — owner, assigned
// mentor/PM, operational staff, oversight, or system administrators.

export const NOTIFICATION_BUCKETS = Object.freeze({
  ACTION: "action",
  UPDATE: "update",
  REMINDER: "reminder",
});

export const BUCKET_LABELS = Object.freeze({
  [NOTIFICATION_BUCKETS.ACTION]: "Action required",
  [NOTIFICATION_BUCKETS.UPDATE]: "Updates",
  [NOTIFICATION_BUCKETS.REMINDER]: "Reminders",
});

export const NOTIFICATION_TYPES = Object.freeze({
  // Accounts (owner + system scope)
  "account.approved": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Account approved", scope: "The account owner; admins see the pending queue instead." },
  "account.rejected": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Registration decided", scope: "The applicant." },
  "account.disabled": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Account disabled", scope: "The account owner." },
  "account.enabled": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Account enabled", scope: "The account owner." },
  "account.role_changed": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Role changed", scope: "The account owner." },
  "pending.accounts": { bucket: NOTIFICATION_BUCKETS.REMINDER, label: "Pending accounts", scope: "TBI Manager and System Administrator (single updating digest)." },
  // Applications (owner + staff + oversight)
  "application.submitted": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Application submitted", scope: "TBI Manager and TBI Assistant." },
  "application.moved": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Application moved", scope: "The applicant (own application)." },
  "application.decided": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Application decided", scope: "The applicant; Management sees decisions for oversight." },
  // Documents & reports (owner + staff)
  "document.submitted": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Document submitted", scope: "TBI staff reviewers." },
  "document.verified": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Document reviewed", scope: "The document owner." },
  "report.submitted": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Report submitted", scope: "TBI staff reviewers." },
  "report.reviewed": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Report reviewed", scope: "The report owner." },
  // Startups, mentorship, assessments (team + assigned + staff)
  "group.assigned_pm": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Startup assigned", scope: "The assigned Portfolio Manager." },
  "group.member_added": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Added to startup", scope: "The added team member." },
  "mentor.assigned": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Mentor assigned", scope: "The assigned mentor." },
  "mentor.unassigned": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Assignment ended", scope: "The mentor." },
  "session.recorded": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Session recorded", scope: "The startup's Portfolio Manager." },
  "assessment.created": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Assessment recorded", scope: "The startup's Portfolio Manager." },
  "incubation.moved": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Stage changed", scope: "The startup team and Portfolio Manager." },
  "incubation.outcome": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Outcome recorded", scope: "The startup team, Portfolio Manager, and Management oversight." },
  // Requests, tasks, milestones (team + PM + staff)
  "request.created": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Request submitted", scope: "The startup's Portfolio Manager." },
  "request.status": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Request updated", scope: "The startup's Portfolio Manager and team." },
  "task.assigned": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "Task assigned", scope: "The assignee." },
  "task.completed": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Task completed", scope: "The assignee and Portfolio Manager." },
  "milestone.completed": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Milestone completed", scope: "TBI staff." },
  // Broadcasts & messages
  "announcement.published": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Announcement", scope: "The announcement audience." },
  "message.received": { bucket: NOTIFICATION_BUCKETS.ACTION, label: "New message", scope: "The recipient only. The conversation stays under Messages." },
  // System configuration (system administrators)
  "role.configured": { bucket: NOTIFICATION_BUCKETS.UPDATE, label: "Role permissions changed", scope: "System Administrators (except the actor)." },
});

// Legacy docs predate the catalog — map their types so old notifications
// keep working in filters, icons, and links.
export const LEGACY_TYPE_MAP = Object.freeze({
  new_pending_user: "pending.accounts",
  "task-status": "task.completed",
  "request-status-update": "request.status",
  manager: "group.assigned_pm",
  welcome: "account.approved",
  group_request: "request.created",
  group_completion: "task.completed",
});

export function normalizeNotificationType(type) {
  if (NOTIFICATION_TYPES[type]) return type;
  return LEGACY_TYPE_MAP[type] || "update.generic";
}

export function bucketForType(type) {
  const entry = NOTIFICATION_TYPES[normalizeNotificationType(type)];
  return entry?.bucket || NOTIFICATION_BUCKETS.UPDATE;
}
