import { useEffect } from "react";
import { Link } from "react-router-dom";
import { FiClock } from "react-icons/fi";
import AuthLayout from "../components/auth/AuthLayout.jsx";

// Post-registration state: every new account (applicant or access request)
// waits for administrator approval before it can sign in.
function WaitingForApproval() {
  useEffect(() => {
    document.title = "MarianTrack | Pending Approval";
  }, []);

  return (
    <AuthLayout
      eyebrow="Account created"
      title="Approval in progress"
      description="Your request is pending. A TBI administrator will review it shortly."
    >
      <div role="status" className="flex gap-3 p-4 rounded border border-amber-200 bg-amber-50">
        <FiClock className="shrink-0 mt-0.5 text-amber-700 text-lg" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-amber-900">What happens next?</p>
          <ul className="text-sm text-amber-900 mt-1.5 flex flex-col gap-1 list-disc pl-5">
            <li>An administrator reviews your request.</li>
            <li>Once approved, sign in with your email and password.</li>
            <li>Need it urgently? Reach out to the TBI office directly.</li>
          </ul>
        </div>
      </div>
      <Link
        to="/"
        className="block text-center mt-5 px-4 py-3 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition"
      >
        Got it
      </Link>
    </AuthLayout>
  );
}

export default WaitingForApproval;
