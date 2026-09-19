// Contextual empty state for startup workspace sections: a useful message
// plus the action the current role is actually allowed to take (or nothing).
function SectionEmptyState({ title, message, action }) {
  return (
    <div className="py-10 px-6 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {message && <p className="text-[13px] text-muted mt-1 max-w-md mx-auto">{message}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export default SectionEmptyState;
