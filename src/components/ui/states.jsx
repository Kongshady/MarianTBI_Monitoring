import { cn } from "../../lib/utils.js";

// Loading / empty / error states. Every major view uses these — never a
// blank page, never a bare "something went wrong".
//
// These are deliberately *unframed*. They previously rendered as their own
// bordered white card with py-12, which meant an empty state nested inside
// a section card produced a double border and a ~200px white void. Empty
// states now sit inline at their natural height and let the surrounding
// section's own boundary do the framing.
export function PageSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse" aria-label="Loading" role="status">
      <div className="mb-2 h-8 w-1/3 rounded bg-slate-200" />
      <div className="mb-6 h-4 w-1/2 rounded bg-slate-100" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="mb-2 h-12 rounded border border-line bg-white" />
      ))}
    </div>
  );
}

export function InlineLoading({ label = "Loading..." }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"
        aria-hidden="true"
      />
      {label}
    </p>
  );
}

export function EmptyState({ title, description, action, icon, className = "" }) {
  return (
    <div className={cn("px-1 py-8 text-center", className)}>
      {icon && (
        <div className="mb-2.5 text-2xl text-slate-300" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "We couldn't load this content.", onRetry }) {
  return (
    <div
      className="rounded-lg border border-red-200 bg-red-50/60 p-5 text-sm"
      role="alert"
    >
      <p className="font-medium text-red-800">Something needs attention</p>
      <p className="mt-1 text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-md border border-red-300 bg-white px-3.5 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-50"
        >
          Try again
        </button>
      )}
    </div>
  );
}

// Record-level denial inside a page the role may generally access.
// Distinct from ErrorState: nothing failed — access is simply not granted.
export function AccessRestricted({
  title = "Access restricted",
  message = "You don't have permission to view this record. If you need access, ask your TBI administrator.",
  backTo,
  backLabel = "Back",
}) {
  return (
    <div className="max-w-lg rounded-lg border border-line bg-white p-6" role="alert">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        403
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
      {backTo && (
        <a
          href={backTo}
          className="mt-4 inline-block rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-deep"
        >
          {backLabel}
        </a>
      )}
    </div>
  );
}
