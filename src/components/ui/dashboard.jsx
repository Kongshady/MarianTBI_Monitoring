import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.js";
import { EmptyState } from "./states.jsx";

/* ══════════════════════════════════════════════════════════════════════════
   Dashboard primitives

   These exist so the three role dashboards stop being six stacked white
   cards. Structure is created with whitespace, alignment and hairline
   rules; a bordered surface is reserved for genuinely bounded objects
   (a queue you act on, a table, a dialog).
   ══════════════════════════════════════════════════════════════════════════ */

// ── Metric row ─────────────────────────────────────────────────────────────
// A bounded horizontal band of key figures. Deliberately not a grid of
// floating cards: a single container, hairline separators, generous
// internal padding, and a tabular figure that is the loudest thing in
// the cell. `0` renders as a real zero; an em dash is reserved for
// "not recorded", so "none" and "unknown" stay distinguishable.
export function MetricRow({ items, className = "" }) {
  // The container paints hairline separators through `gap-px` + a line
  // background, so any unfilled grid cell shows up as an empty grey block.
  // Pick a column count that divides the item count exactly at each
  // breakpoint rather than hard-coding 4.
  const lgCols = items.length % 4 === 0 ? 4 : items.length % 3 === 0 ? 3 : items.length % 2 === 0 ? 2 : 1;
  const smCols = items.length % 2 === 0 ? 2 : 1;

  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-line bg-line",
        smCols === 1 ? "grid-cols-1" : "grid-cols-2",
        lgCols === 1 && "lg:grid-cols-1",
        lgCols === 2 && "lg:grid-cols-2",
        lgCols === 3 && "lg:grid-cols-3",
        lgCols === 4 && "lg:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-white px-4 py-3.5 sm:px-5">
          <dt className="text-[12px] leading-4 text-muted">{item.label}</dt>
          <dd className="mt-1.5 flex items-baseline gap-2">
            <span
              className={cn(
                "text-[26px] font-semibold leading-none tabular-nums tracking-tight",
                item.value === 0 || item.value === "—" ? "text-slate-400" : "text-slate-900"
              )}
            >
              {item.value}
            </span>
            {item.suffix && (
              <span className="text-[12px] text-muted tabular-nums">{item.suffix}</span>
            )}
          </dd>
          {item.note && <p className="mt-1 text-[12px] text-muted">{item.note}</p>}
        </div>
      ))}
    </dl>
  );
}

// ── Action queue ───────────────────────────────────────────────────────────
// The "what requires attention" zone. Laid out as a dense bounded grid so
// the row fills the available width with useful alignment instead of a
// dot, a digit and a label floating in 950px of empty space.
//
// Severity is communicated by a labelled text marker and a left accent
// rail, never by colour alone.
const TONE_MARK = {
  critical: { rail: "bg-red-500", mark: "text-red-700 bg-red-50 border-red-200" },
  warning: { rail: "bg-amber-500", mark: "text-amber-800 bg-amber-50 border-amber-200" },
  info: { rail: "bg-sky-600", mark: "text-sky-800 bg-sky-50 border-sky-200" },
  clear: { rail: "bg-line-strong", mark: "text-slate-600 bg-slate-50 border-slate-200" },
};

const TONE_WORD = {
  critical: "Urgent",
  warning: "Review",
  info: "Pending",
  clear: "Clear",
};

export function ActionQueue({ items, className = "" }) {
  const openCount = items.filter((i) => i.tone !== "clear" && i.count > 0).length;

  return (
    <div className={cn("overflow-hidden rounded-lg border border-line bg-white", className)}>
      <ul className="divide-y divide-line">
        {items.map((item) => {
          const tone = item.count > 0 ? item.tone : "clear";
          const { rail, mark } = TONE_MARK[tone];
          return (
            <li key={item.label} className="relative flex items-stretch">
              <span className={cn("w-1 shrink-0", rail)} aria-hidden="true" />
              <div className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 pl-3.5 sm:gap-4 sm:pl-4">
                <span className="w-9 shrink-0 text-right text-[22px] font-semibold leading-none tabular-nums text-slate-900 sm:w-11 sm:text-[26px]">
                  {item.count}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm leading-snug text-slate-700">{item.label}</span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium sm:inline-block",
                    mark
                  )}
                >
                  {TONE_WORD[tone]}
                </span>
                {item.to && item.count > 0 ? (
                  <Link
                    to={item.to}
                    className="shrink-0 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent-light"
                  >
                    Review
                    <span className="sr-only"> {item.label}</span>
                    <span aria-hidden="true">&nbsp;&rarr;</span>
                  </Link>
                ) : (
                  <span className="w-[68px] shrink-0 sm:w-[74px]" aria-hidden="true" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line bg-surface-sunken px-4 py-2 text-[12px] text-muted">
        {openCount > 0
          ? `${openCount} item${openCount === 1 ? "" : "s"} waiting on someone.`
          : "Nothing is waiting. The queue is clear."}
      </p>
    </div>
  );
}

// ── Stage bar ──────────────────────────────────────────────────────────────
// Proportional pipeline visualisation. Replaces a numbered list whose
// "01 02 03 04" carried no information. Each stage is a link that filters
// the queue, and the bar width is proportional to the count, so the
// shape of the pipeline is readable at a glance.
export function StageBar({ stages, emptyLabel = "No records at this stage." }) {
  const total = stages.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return <p className="py-6 text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div>
      <div
        className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-line"
        role="img"
        aria-label={stages
          .map((s) => `${s.label}: ${s.count}`)
          .join(", ")}
      >
        {stages.map((s) =>
          s.count > 0 ? (
            <span
              key={s.label}
              className="h-full bg-accent first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(s.count / total) * 100}%` }}
            />
          ) : null
        )}
      </div>

      <ul className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-4">
        {stages.map((s) => (
          <li key={s.label}>
            <Link
              to={s.to}
              className="group flex items-baseline gap-2 rounded transition-colors hover:bg-accent-light"
            >
              <span className="text-[20px] font-semibold leading-none tabular-nums text-slate-900">
                {s.count}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] text-slate-600 group-hover:text-accent">
                  {s.label}
                </span>
                <span className="block text-[11px] text-muted tabular-nums">
                  {total > 0 ? Math.round((s.count / total) * 100) : 0}%
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────
// Lightweight CSS-only trend. Deliberately not a charting library: eight
// bars of pure CSS cost nothing in bundle size and answer "is activity
// rising?" without a dependency.
export function Sparkline({ data, label, caption, emptyLabel = "No activity scheduled in this period." }) {
  const max = Math.max(0, ...data.map((d) => d.value));

  // A trend of all zeros must still read as a chart with a baseline, not as
  // a broken empty box. Bars keep a floor height and the caption says so.
  const floor = max === 0;

  return (
    <figure className="m-0">
      <div
        className={cn(
          "relative flex h-16 items-end gap-1 border-b",
          floor ? "border-line" : "border-transparent"
        )}
        role="img"
        aria-label={label}
      >
        {data.map((d) => {
          const heightPct = max > 0 ? (d.value / max) * 100 : 0;
          const isPeak = !floor && d.value === max;
          return (
            <div key={d.key} className="group relative flex-1">
              <div
                className={cn(
                  "w-full rounded-sm transition-[height] duration-500",
                  floor
                    ? "h-[3px] bg-line"
                    : isPeak
                    ? "bg-accent"
                    : "bg-accent/30 group-hover:bg-accent/50"
                )}
                style={floor ? undefined : { height: `${Math.max(heightPct, 6)}%` }}
              />
              {!floor && (
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-white px-1.5 py-0.5 text-[11px] text-slate-700 shadow-shell group-hover:block">
                  {d.value} {d.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted">
        <span className="tabular-nums">{data[0]?.label}</span>
        <span className="truncate text-center text-slate-600">
          {floor ? emptyLabel : caption}
        </span>
        <span className="tabular-nums">{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}

// ── Queue column ───────────────────────────────────────────────────────────
// One column of the "needs follow-up" band. Columns share hairline
// separators inside a single bordered band instead of each being its own
// floating card, which keeps a three-column row visually calm.
export function QueueColumn({
  title,
  caption,
  isEmpty,
  emptyTitle,
  emptyBody,
  children,
}) {
  return (
    <div className="flex flex-col bg-white">
      <div className="px-4 pt-3.5 pb-2">
        <h3 className="text-[13px] font-semibold text-slate-900">{title}</h3>
        {caption && <p className="text-[12px] text-muted">{caption}</p>}
      </div>
      <div className="flex-1">
        {isEmpty ? (
          <EmptyState title={emptyTitle} description={emptyBody} className="py-6" />
        ) : (
          <ul className="max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
            {children}
          </ul>
        )}
      </div>
    </div>
  );
}

export function QueueRow({ to, title, children }) {
  const inner = (
    <>
      <span className="block truncate text-sm font-medium text-slate-900">{title}</span>
      {children}
    </>
  );
  return (
    <li>
      {to ? (
        <Link
          to={to}
          className="block px-4 py-2.5 transition-colors hover:bg-surface-hover"
        >
          {inner}
        </Link>
      ) : (
        <div className="px-4 py-2.5">{inner}</div>
      )}
    </li>
  );
}

// ── Definition list row ────────────────────────────────────────────────────
// Compact label/value list used where a bordered card would be noise.
export function DataList({ items, className = "" }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2">
          <dt className="w-full text-[11px] font-semibold uppercase tracking-[0.06em] text-muted sm:w-44 sm:shrink-0">
            {item.label}
          </dt>
          <dd className="min-w-0 flex-1 text-sm text-slate-700">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
