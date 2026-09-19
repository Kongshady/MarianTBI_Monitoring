import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import AuthLayout from "../../components/auth/AuthLayout.jsx";
import PasswordInput from "../../components/auth/PasswordInput.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { meetsPasswordPolicy } from "../../lib/password.js";
import { getRegistrationOpen } from "../../lib/system.js";
import { FiAlertCircle, FiChevronDown, FiInfo } from "react-icons/fi";

// Employee access requests. There is deliberately no admin-provisioning
// magic here: client-side Firebase Auth cannot create users for someone
// else (it would sign the administrator out), so every request below lands
// as status=pending and a TBI Manager approves, corrects, or rejects the
// role in user management. The approval gate IS the administrative control.
function EmployeeCreateAccount() {
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [lastname, setLastname] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const roles = ["TBI Manager", "TBI Assistant", "Portfolio Manager", "Mentor"];

  useEffect(() => {
    document.title = "MarianTrack | Request Employee Access";
    getRegistrationOpen().then(setRegistrationOpen);
  }, []);

  useEffect(() => {
    const onOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const passwordsMatch = password === confirmPassword;
  const formValid =
    name.trim() && lastname.trim() && email.trim() && mobile.trim() && role && meetsPasswordPolicy(password) && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!registrationOpen) {
      setError("Access requests are currently closed. Please contact the TBI office.");
      return;
    }
    if (!formValid) {
      setError("Please correct the highlighted fields.");
      return;
    }
    setCreating(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        lastname: lastname.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        role,
        status: "pending",
        timestamp: serverTimestamp(),
      });

      navigate("/waiting-for-approval");
    } catch (error) {
      setError(error.code === "auth/email-already-in-use"
        ? "This email address is already registered. Try signing in instead."
        : error.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AuthLayout
      backTo="/create-account"
      backLabel="Back"
      eyebrow="Team access"
      title="Request employee access"
      description="For TBI personnel and mentors. Every request is reviewed by an administrator before activation."
      wide
    >
      <div role="note" className="mb-5 flex gap-2.5 p-3.5 rounded border border-sky-200 bg-sky-50">
        <FiInfo className="shrink-0 mt-0.5 text-sky-700" aria-hidden="true" />
        <p className="text-[13px] text-sky-900">
          This sends an access request — it does not activate an account by itself. A TBI
          administrator reviews the requested role before approval.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {!registrationOpen && (
          <div role="note" className="mb-4 flex gap-2.5 p-3.5 rounded border border-amber-200 bg-amber-50">
            <FiAlertCircle className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
            <p className="text-sm text-amber-900">
              Access requests are currently closed. Please contact the TBI office.
            </p>
          </div>
        )}
        {error && (
          <div role="alert" className="mb-4 flex gap-2.5 p-3.5 rounded border border-red-200 bg-red-50">
            <FiAlertCircle className="shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <h2 className="text-sm font-semibold text-slate-900 mb-3">Personal information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="tbi-label" htmlFor="emp-first">
              First name <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="emp-first"
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={creating}
              required
              className="tbi-input h-12 text-[15px] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="tbi-label" htmlFor="emp-last">
              Last name <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="emp-last"
              type="text"
              autoComplete="family-name"
              value={lastname}
              onChange={(e) => setLastname(e.target.value)}
              disabled={creating}
              required
              className="tbi-input h-12 text-[15px] disabled:opacity-60"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="tbi-label" htmlFor="emp-email">
              Email address <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="emp-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={creating}
              required
              className="tbi-input h-12 text-[15px] disabled:opacity-60"
            />
          </div>
          <div>
            <label className="tbi-label" htmlFor="emp-mobile">
              Mobile number <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="emp-mobile"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={11}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              disabled={creating}
              required
              className="tbi-input h-12 text-[15px] disabled:opacity-60"
            />
          </div>
        </div>

        <h2 className="text-sm font-semibold text-slate-900 mb-3">Requested access</h2>
        <label className="tbi-label" id="emp-role-label">
          Role requested <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <div className="relative mb-5" ref={dropdownRef} role="group" aria-labelledby="emp-role-label">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            onClick={() => !creating && setIsOpen((v) => !v)}
            disabled={creating}
            className={`tbi-input h-12 text-[15px] w-full text-left flex items-center justify-between disabled:opacity-60 ${role ? "text-slate-900" : "text-slate-400"}`}
          >
            {role || "Choose a role"}
            <FiChevronDown className="text-slate-500" aria-hidden="true" />
          </button>
          {isOpen && (
            <ul role="listbox" aria-label="Requested role" className="absolute left-0 mt-1 w-full bg-white border border-line rounded shadow-lg z-10 max-h-56 overflow-y-auto">
              {roles.map((item) => (
                <li
                  key={item}
                  role="option"
                  aria-selected={role === item}
                  tabIndex={0}
                  onClick={() => {
                    setRole(item);
                    setIsOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setRole(item);
                      setIsOpen(false);
                    }
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-slate-50 ${role === item ? "font-medium text-slate-900" : "text-slate-700"}`}
                >
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <h2 className="text-sm font-semibold text-slate-900 mb-3">Account security</h2>
        <div className="mb-1">
          <PasswordInput
            id="emp-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={creating}
            required
            describedBy="emp-password-reqs"
          />
          <PasswordRequirements password={password} id="emp-password-reqs" />
        </div>
        <div className="mt-3">
          <PasswordInput
            id="emp-confirm"
            label="Confirm password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmTouched(true);
            }}
            disabled={creating}
            required
            autoComplete="new-password"
          />
          {confirmTouched && confirmPassword && (
            <p role="status" className={`text-[13px] mt-1.5 ${passwordsMatch ? "text-green-700" : "text-red-600"}`}>
              {passwordsMatch ? "Passwords match." : "Passwords do not match."}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={creating || !formValid || !registrationOpen}
          className="mt-5 w-full h-12 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {creating ? "Sending Request..." : "Send Access Request"}
        </button>

        <p className="mt-5 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default EmployeeCreateAccount;
