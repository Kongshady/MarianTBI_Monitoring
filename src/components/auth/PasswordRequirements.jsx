import { passwordChecks } from "../../lib/password.js";

// Live password-requirements checklist driven by the canonical policy.
// Only announces changes once the user has typed something.
function PasswordRequirements({ password, id = "password-requirements" }) {
  const checks = passwordChecks(password);
  const started = (password || "").length > 0;
  const metCount = checks.filter((c) => c.met).length;

  return (
    <div className="mt-2" aria-live="polite" aria-label={`Password requirements: ${metCount} of ${checks.length} met`}>
      <p className="text-xs font-medium text-slate-600 mb-1">Password requirements</p>
      <ul id={id} className="flex flex-col gap-1">
        {checks.map((check) => (
          <li
            key={check.key}
            className={`flex items-center gap-2 text-[13px] ${!started ? "text-slate-500" : check.met ? "text-green-700" : "text-slate-500"}`}
          >
            <span
              aria-hidden="true"
              className={`inline-flex items-center justify-center w-4 h-4 rounded-full border text-[10px] font-bold ${
                started && check.met ? "bg-green-600 border-green-600 text-white" : "border-slate-300 text-transparent"
              }`}
            >
              ✓
            </span>
            {check.label}
            <span className="sr-only">{check.met ? "satisfied" : "not satisfied"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PasswordRequirements;
