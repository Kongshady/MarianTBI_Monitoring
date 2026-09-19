// Loading / empty / error states. Every major view uses these — never a
// blank page, never a bare "something went wrong".
export function PageSkeleton({ rows = 5 }) {
  return (
    <div className="animate-pulse" aria-label="Loading">
      <div className="h-8 w-1/3 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-1/2 bg-slate-100 rounded mb-6" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-white border border-line rounded mb-2" />
      ))}
    </div>
  );
}

export function InlineLoading({ label = "Loading..." }) {
  return (
    <p className="text-sm text-muted flex items-center gap-2" role="status">
      <span className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      {label}
    </p>
  );
}

export function EmptyState({ title, description, action, icon }) {
  return (
    <div className="bg-white border border-line rounded py-12 px-6 text-center">
      {icon && <div className="text-3xl text-slate-300 mb-3" aria-hidden="true">{icon}</div>}
      <p className="font-medium text-slate-900">{title}</p>
      {description && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = "We couldn't load this content.", onRetry }) {
  return (
    <div className="bg-white border border-line rounded p-6 text-sm" role="alert">
      <p className="font-medium text-slate-900">Something needs attention</p>
      <p className="text-muted mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 px-4 py-2 bg-slate-100 text-slate-800 rounded text-sm font-medium hover:bg-slate-200 transition"
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
    <div className="bg-white border border-line rounded p-8 max-w-lg" role="alert">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">403</p>
      <h2 className="text-xl font-semibold text-slate-900 mt-1">{title}</h2>
      <p className="text-sm text-muted mt-2">{message}</p>
      {backTo && (
        <a
          href={backTo}
          className="inline-block mt-4 px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
        >
          {backLabel}
        </a>
      )}
    </div>
  );
}
