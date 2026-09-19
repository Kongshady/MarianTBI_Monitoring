import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

// Labeled password input with an accessible visibility toggle.
// Labels/ids are caller-provided so every instance stays unique.
function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password",
  disabled = false,
  required = false,
  describedBy,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="tbi-label" htmlFor={id}>
        {label} {required && <span className="text-red-600" aria-hidden="true">*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          aria-describedby={describedBy}
          className="tbi-input h-12 text-[15px] pr-12 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition disabled:opacity-50"
        >
          {visible ? <FiEyeOff className="text-lg" aria-hidden="true" /> : <FiEye className="text-lg" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default PasswordInput;
