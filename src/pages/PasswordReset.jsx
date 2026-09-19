import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../config/marian-config";
import AuthLayout from "../components/auth/AuthLayout.jsx";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";

// Password reset via the existing Firebase email flow. The success message
// is intentionally generic so the page never reveals whether an address is
// registered (anti-enumeration).
function PasswordReset() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = "MarianTrack | Forgot Password";
  }, []);

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError("");
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      await sendPasswordResetEmail(auth, value);
      setSent(true);
    } catch (err) {
      console.error("Password reset failed:", err?.code || err);
      // Unknown addresses resolve to the same success state so the page
      // cannot be used to probe for registered accounts.
      if (err?.code === "auth/user-not-found") {
        setSent(true);
      } else {
        setError("We couldn't send the reset link right now. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthLayout
      backTo="/login"
      backLabel="Back to Sign In"
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Enter the email address associated with your MarianTrack account."
    >
      {sent ? (
        <div role="status" className="flex gap-2.5 p-4 rounded border border-green-200 bg-green-50">
          <FiCheckCircle className="shrink-0 mt-0.5 text-green-700" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-green-900">Check your email</p>
            <p className="text-sm text-green-800 mt-1">
              If an account is associated with that email address, we&apos;ve sent instructions to
              reset your password.
            </p>
            <Link to="/login" className="inline-block mt-3 text-sm font-medium text-accent hover:underline">
              Back to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePasswordReset}>
          {error && (
            <div role="alert" className="mb-4 flex gap-2.5 p-3.5 rounded border border-red-200 bg-red-50">
              <FiAlertCircle className="shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          <label className="tbi-label" htmlFor="reset-email">
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            required
            placeholder="you@example.com"
            className="tbi-input h-12 text-[15px] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending}
            className="mt-4 w-full h-12 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? "Sending Reset Link..." : "Send Reset Link"}
          </button>
          <p className="mt-5 text-center text-sm text-muted">
            Remember your password?{" "}
            <Link to="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

export default PasswordReset;
