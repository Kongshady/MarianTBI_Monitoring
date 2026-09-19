import { Link } from "react-router-dom";

// Page header: title, supporting description, optional back link and
// right-side actions. One hierarchy for every page.
function PageHeader({ title, description, backTo, backLabel = "Back", actions }) {
  return (
    <div className="mb-6">
      {backTo && (
        <Link to={backTo} className="text-[13px] text-accent hover:underline">
          ← {backLabel}
        </Link>
      )}
      <div className="flex flex-wrap justify-between items-start gap-3 mt-1">
        <div className="min-w-0">
          <h1 className="text-[30px] leading-tight font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="text-sm text-muted mt-1 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({ children, hint }) {
  return (
    <div className="mb-3">
      <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
      {hint && <p className="text-[13px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}

export default PageHeader;
