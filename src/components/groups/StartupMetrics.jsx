// Compact overview strip for a startup: key counts that jump to their tab.
// Metrics arrive from the page (requests/workplan computed locally, the rest
// reported by panels via onCount) so nothing here fetches on its own.
function StartupMetrics({ metrics, onSelect }) {
  const items = [
    { key: "requests", label: "Open requests", value: metrics.openRequests },
    { key: "workplan", label: "Active tasks", value: metrics.activeTasks, hint: metrics.taskTotal != null ? `of ${metrics.taskTotal}` : null },
    { key: "milestones", label: "Milestones", value: metrics.milestonesTotal, hint: metrics.milestonesDone != null ? `${metrics.milestonesDone} done` : null },
    { key: "documents", label: "Documents", value: metrics.documents },
    { key: "reports", label: "Reports", value: metrics.reports },
  ];
  return (
    <section aria-label="Startup overview" className="bg-white border border-line rounded mb-5">
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-line">
        {items.map((item) => (
          <div key={item.key} className="px-4 py-3">
            <dt className="text-xs text-muted order-2">{item.label}</dt>
            <dd className="flex items-baseline gap-1.5">
              <button
                onClick={() => onSelect(item.key)}
                className="text-xl font-semibold text-slate-900 hover:text-accent transition"
                aria-label={`Go to ${item.label}`}
              >
                {item.value ?? "—"}
              </button>
              {item.hint && <span className="text-xs text-muted">{item.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default StartupMetrics;
