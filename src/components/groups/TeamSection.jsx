import Avatar from "../ui/Avatar.jsx";

// Dedicated team section: portfolio manager, then every assigned member
// with their startup role. Member management itself lives in the Edit
// startup panel (staff); this section stays a clear readable roster with
// an optional manage entry point.
function TeamSection({ members, portfolioManager, onManage }) {
  const roster = members || [];
  return (
    <section aria-label="Team" className="bg-white border border-line rounded p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-slate-900">Team</h2>
        {onManage && (
          <button
            onClick={onManage}
            className="px-3 py-1.5 bg-white border border-line text-slate-700 rounded text-xs font-medium hover:bg-slate-50 transition"
          >
            Manage team
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted uppercase mb-2">Portfolio manager</h3>
          {portfolioManager ? (
            <p className="text-sm text-slate-900">
              {[portfolioManager.name, portfolioManager.lastname].filter(Boolean).join(" ") || "Assigned"}
            </p>
          ) : (
            <p className="text-sm text-muted">No portfolio manager assigned yet.</p>
          )}
        </div>
        <div>
          <h3 className="text-xs font-medium tracking-wide text-muted uppercase mb-2">
            Members ({roster.length})
          </h3>
          {roster.length === 0 ? (
            <p className="text-sm text-muted">No members assigned to this startup yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {roster.map((member) => {
                const name = `${member.name || ""} ${member.lastname || ""}`.trim() || "Member";
                return (
                  <li key={member.id} className="py-2 flex items-center gap-2.5">
                    {member.profileImageUrl ? (
                      <img src={member.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <Avatar name={name} size="sm" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-slate-900 truncate">{name}</span>
                      {member.email && <span className="block text-xs text-muted truncate">{member.email}</span>}
                    </span>
                    <span className="text-xs text-slate-600 bg-slate-100 border border-line rounded px-2 py-0.5 whitespace-nowrap">
                      {member.groupRole || "Member"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default TeamSection;
