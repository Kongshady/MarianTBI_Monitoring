import { useRef } from "react";
import { cn } from "../../lib/utils.js";

// Underline tabs for detail views. One tab pattern everywhere — not a
// row of toggle buttons.
//
// Fixes over the previous version:
//  - The horizontal scrollbar no longer renders its native arrow chrome
//    (which appeared as a stray scrollbar widget beside the strip). The
//    strip scrolls with the scrollbar hidden and an edge fade instead.
//  - Left/Right arrow keys move between tabs, per the WAI-ARIA tabs
//    pattern, instead of forcing Tab through every tab stop.
function Tabs({ tabs, active, onChange, label = "Sections" }) {
  const listRef = useRef(null);

  const onKeyDown = (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    e.preventDefault();
    const current = tabs.findIndex((t) => t.key === active);
    let next;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else if (e.key === "ArrowRight") next = (current + 1) % tabs.length;
    else next = (current - 1 + tabs.length) % tabs.length;

    const target = tabs[next];
    if (!target) return;
    onChange(target.key);
    // Move focus with selection so the roving-tabindex pattern holds.
    const buttons = listRef.current?.querySelectorAll('[role="tab"]');
    buttons?.[next]?.focus();
  };

  return (
    <div className="mb-5 border-b border-line">
      <div
        ref={listRef}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="scrollbar-none mask-fade-r -mb-px flex gap-1 overflow-x-auto"
      >
        {tabs.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.key)}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition-colors",
                selected
                  ? "border-accent font-medium text-slate-900"
                  : "border-transparent text-muted hover:border-line-strong hover:text-slate-900"
              )}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span className="ml-1.5 text-xs tabular-nums text-muted">({tab.count})</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;
