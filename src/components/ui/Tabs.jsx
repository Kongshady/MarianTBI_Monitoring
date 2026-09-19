// Underline tabs for detail views. One tab pattern everywhere — not a
// row of toggle buttons. Keyboard accessible via native buttons.
function Tabs({ tabs, active, onChange }) {
  return (
    <div className="border-b border-line mb-5 overflow-x-auto" role="tablist" aria-label="Startup sections">
      <div className="flex gap-1 min-w-max">
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px whitespace-nowrap ${
                selected
                  ? "border-accent text-slate-900 font-medium"
                  : "border-transparent text-muted hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span className="ml-1.5 text-xs text-muted">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;
