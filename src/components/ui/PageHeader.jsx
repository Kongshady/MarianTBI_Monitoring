import { Link } from "react-router-dom";

// ── Page header ────────────────────────────────────────────────────────────
// Title, supporting description, optional back link and right-side actions.
// One hierarchy for every page. The title scales down on small screens so a
// long greeting does not consume the whole 390px viewport.
function PageHeader({ title, description, backTo, backLabel = "Back", actions }) {
  return (
    <header className="mb-6 sm:mb-7">
      {backTo && (
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
        >
          <span aria-hidden="true">&larr;</span> {backLabel}
        </Link>
      )}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[26px] lg:text-[30px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ── Section header ─────────────────────────────────────────────────────────
// The single section-level heading used across the whole PMIS. Replaces the
// previous mix of `SectionTitle` (18px, outside cards) and ad-hoc `text-sm
// font-semibold` card titles (14px, inside cards), which produced three
// competing heading levels.
//
// A section is delimited by whitespace and a hairline rule rather than a
// card. `rule` draws that divider; omit it when sections are adjacent.
function SectionHeader({ children, hint, count, action, rule = true, className = "" }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink">
            {children}
            {typeof count === "number" && (
              <span className="text-[13px] font-medium normal-case tracking-normal tabular-nums text-muted">
                {count}
              </span>
            )}
          </h2>
          {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {rule && <div className="mt-2.5 h-px w-full bg-line" aria-hidden="true" />}
    </div>
  );
}

// Backwards-compatible alias. Non-dashboard pages (Announcements, System,
// Roles) still call SectionTitle; delegating here upgrades them to the new
// section treatment without touching each call site.
const SectionTitle = (props) => <SectionHeader {...props} />;

export default PageHeader;
export { SectionHeader, SectionTitle };
