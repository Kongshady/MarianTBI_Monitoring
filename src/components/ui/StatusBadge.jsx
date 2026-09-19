// Semantic status badge used everywhere. Dot + text (never color-only),
// small radius, thin border, tinted background. One map for the whole PMIS

// so the same lifecycle state never shows two different colors.
const TONES = {
  gray: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200",
  indigo: "bg-indigo-50 text-indigo-800 border-indigo-200",
  teal: "bg-teal-50 text-teal-800 border-teal-200",
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  orange: "bg-orange-50 text-orange-800 border-orange-200",
  red: "bg-red-50 text-red-700 border-red-200",
  purple: "bg-violet-50 text-violet-800 border-violet-200",
};

const DOTS = {
  gray: "bg-slate-400",
  blue: "bg-sky-600",
  indigo: "bg-indigo-600",
  teal: "bg-teal-600",
  green: "bg-emerald-600",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  purple: "bg-violet-600",
};

const STATUS_TONES = {
  // Applications
  Draft: "gray",
  Submitted: "blue",
  Screening: "indigo",
  "For Evaluation": "amber",
  "Returned for Revision": "orange",
  Accepted: "green",
  Rejected: "red",
  // Incubation
  Onboarding: "indigo",
  Active: "blue",
  "On Hold": "amber",
  "Final Review": "purple",
  Graduated: "green",
  Exited: "gray",
  Withdrawn: "gray",
  Continuing: "teal",
  // Milestones / tasks
  "Not Started": "gray",
  "In Progress": "blue",
  Completed: "green",
  Deferred: "amber",
  Done: "green",
  Pending: "gray",
  Requested: "blue",
  Overdue: "red",
  // Reports
  "Under Review": "amber",
  Approved: "green",
  "Needs Revision": "orange",
  // Attendance
  Registered: "gray",
  Attended: "green",
  Absent: "red",
  Excused: "amber",
  // Documents / verification
  Verified: "green",
  // Mentions / misc
  HIGH: "red",
  High: "red",
  MEDIUM: "amber",
  Medium: "amber",
  LOW: "green",
  Low: "green",
};

function StatusBadge({ status, tone, className = "" }) {
  const resolved = tone || STATUS_TONES[status] || "gray";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium whitespace-nowrap ${TONES[resolved]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[resolved]}`} aria-hidden="true" />
      {status}
    </span>
  );
}

export default StatusBadge;
