import { Link } from "react-router-dom";
import { useEffect } from "react";
import AuthLayout from "../components/auth/AuthLayout.jsx";

// Public entry to registration. Only Applicant accounts are
// self-registerable; every other account type is provisioned by a
// TBI administrator through user management.
function CreateAccPage() {
  useEffect(() => {
    document.title = "MarianTrack | Create Account";
  }, []);

  return (
    <AuthLayout
      backTo="/login"
      backLabel="Back to Sign In"
      eyebrow="Join MarianTrack"
      title="Create your account"
      description="Choose how you are joining MarianTrack."
    >
      <div className="border border-line rounded p-5">
        <h2 className="text-base font-semibold text-slate-900">Applicant</h2>
        <p className="text-sm text-muted mt-1">
          Apply to the Marian TBI incubation program and submit your startup for review.
        </p>
        <Link
          to="/incubatee-create-account"
          className="block text-center mt-4 px-4 py-3 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition"
        >
          Continue as Applicant
        </Link>
      </div>

      <p className="mt-5 text-[13px] text-muted leading-relaxed">
        Joining as a mentor, employee, or partner? Those accounts are created by Marian TBI
        administrators. Please contact the TBI office for access.
      </p>

      <p className="mt-3 text-center text-[13px] text-muted">
        TBI personnel with an invitation?{" "}
        <Link to="/employee-create-account" className="font-medium text-accent hover:underline">
          Request employee access
        </Link>
      </p>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default CreateAccPage;
