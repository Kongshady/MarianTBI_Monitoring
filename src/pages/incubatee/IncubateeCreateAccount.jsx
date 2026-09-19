import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import AuthLayout from "../../components/auth/AuthLayout.jsx";
import PasswordInput from "../../components/auth/PasswordInput.jsx";
import PasswordRequirements from "../../components/auth/PasswordRequirements.jsx";
import { meetsPasswordPolicy } from "../../lib/password.js";
import { getRegistrationOpen } from "../../lib/system.js";
import { FiAlertCircle } from "react-icons/fi";

// Public registration: Applicants only. The account starts as
// status=pending; a TBI administrator approves it, and onboarding later
// promotes Applicant → Incubatee on this same account. Backend logic
// (Firebase create + users doc shape) is unchanged.
function IncubateeCreateAccount() {
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
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "MarianTrack | Create Applicant Account";
    getRegistrationOpen().then(setRegistrationOpen);
  }, []);

  const passwordsMatch = password === confirmPassword;
  const formValid =
    name.trim() && lastname.trim() && email.trim() && mobile.trim() && meetsPasswordPolicy(password) && passwordsMatch;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!registrationOpen) {
      setError("Public registration is currently closed. Please contact the TBI office.");
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
        role: "Applicant",
        lifecycleStage: "applicant",
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
      eyebrow="Join as an applicant"
      title="Create applicant account"
      description="Register to begin your journey with Marian Technology Business Incubator."
      wide
    >
      <form onSubmit={handleSubmit}>
        {!registrationOpen && (
          <div role="note" className="mb-4 flex gap-2.5 p-3.5 rounded border border-amber-200 bg-amber-50">
            <FiAlertCircle className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
            <p className="text-sm text-amber-900">
              Public registration is currently closed. Please contact the TBI office for access.
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
            <label className="tbi-label" htmlFor="reg-first">
              First name <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-first"
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
            <label className="tbi-label" htmlFor="reg-last">
              Last name <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-last"
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
            <label className="tbi-label" htmlFor="reg-email">
              Email address <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-email"
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
            <label className="tbi-label" htmlFor="reg-mobile">
              Mobile number <span className="text-red-600" aria-hidden="true">*</span>
            </label>
            <input
              id="reg-mobile"
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

        <h2 className="text-sm font-semibold text-slate-900 mb-3">Account security</h2>
        <div className="mb-1">
          <PasswordInput
            id="reg-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={creating}
            required
            describedBy="reg-password-reqs"
          />
          <PasswordRequirements password={password} id="reg-password-reqs" />
        </div>
        <div className="mt-3">
          <PasswordInput
            id="reg-confirm"
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
          {creating ? "Creating Account..." : "Create Account"}
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

export default IncubateeCreateAccount;
