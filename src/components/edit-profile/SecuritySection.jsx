import { useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import StatusBadge from "../ui/StatusBadge.jsx";
import PasswordInput from "../auth/PasswordInput.jsx";
import PasswordRequirements from "../auth/PasswordRequirements.jsx";
import { toast } from "../../lib/toast.js";
import { meetsPasswordPolicy } from "../../lib/password.js";
import { writeAuditEntry } from "../../lib/audit.js";

// Security & account area: password/email changes (with re-authentication),
// verification status, current session info, and read-only account standing.
// Role is intentionally absent here — it lives in user management.
//
// Known limits (no backend to do better): other-device sign-out requires an
// administrator (Firebase Admin SDK); the Firestore email copy updates
// immediately while the Auth email flips only after the verification link.
function SecuritySection({ userData }) {
  const navigate = useNavigate();
  const authUser = auth.currentUser;
  const hasPasswordProvider = (authUser?.providerData || []).some((p) => p.providerId === "password");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState(null);
  const [pwSaving, setPwSaving] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailMessage, setEmailMessage] = useState(null);
  const [emailSaving, setEmailSaving] = useState(false);

  const [verified, setVerified] = useState(!!authUser?.emailVerified);
  const [verifyMessage, setVerifyMessage] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const reauthenticate = async (password) => {
    if (!authUser?.email) throw new Error("No email credential on this account.");
    const credential = EmailAuthProvider.credential(authUser.email, password);
    await reauthenticateWithCredential(authUser, credential);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwMessage(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMessage({ tone: "error", text: "Fill in all three password fields." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ tone: "error", text: "The new passwords do not match." });
      return;
    }
    if (!meetsPasswordPolicy(newPassword)) {
      setPwMessage({ tone: "error", text: "The new password does not meet the requirements below." });
      return;
    }
    setPwSaving(true);
    try {
      await reauthenticate(currentPassword);
      await updatePassword(authUser, newPassword);
      await writeAuditEntry({
        actorId: authUser.uid,
        action: "user.password_changed",
        targetType: "user",
        targetId: authUser.uid,
        detail: "",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMessage({ tone: "success", text: "Password changed successfully." });
      toast("Password changed.");
    } catch (error) {
      console.error("Error changing password:", error);
      setPwMessage({
        tone: "error",
        text: error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential"
          ? "Your current password is incorrect."
          : "Could not change the password. Please try again.",
      });
    } finally {
      setPwSaving(false);
    }
  };

  const handleEmailChange = async (e) => {
    e.preventDefault();
    setEmailMessage(null);
    const value = newEmail.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailMessage({ tone: "error", text: "Enter a valid new email address." });
      return;
    }
    if (!emailPassword) {
      setEmailMessage({ tone: "error", text: "Enter your current password to confirm." });
      return;
    }
    setEmailSaving(true);
    try {
      await reauthenticate(emailPassword);
      await verifyBeforeUpdateEmail(authUser, value);
      // Firestore copy updates now; the Auth email flips once the new
      // address is confirmed via the verification link.
      await updateDoc(doc(db, "users", authUser.uid), { email: value });
      await writeAuditEntry({
        actorId: authUser.uid,
        action: "user.email_change_requested",
        targetType: "user",
        targetId: authUser.uid,
        detail: "",
      });
      setNewEmail("");
      setEmailPassword("");
      setEmailMessage({ tone: "success", text: "Verification email sent. Your sign-in email updates after you confirm it." });
      toast("Verification email sent.");
    } catch (error) {
      console.error("Error changing email:", error);
      setEmailMessage({
        tone: "error",
        text: error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential"
          ? "Your current password is incorrect."
          : error?.code === "auth/email-already-in-use"
            ? "This email address is already registered."
            : "Could not change the email. Please try again.",
      });
    } finally {
      setEmailSaving(false);
    }
  };

  const handleRefreshVerification = async () => {
    setVerifyBusy(true);
    try {
      await authUser.reload();
      const fresh = !!auth.currentUser?.emailVerified;
      setVerified(fresh);
      setVerifyMessage(
        fresh
          ? { tone: "success", text: "Email verified. Thank you." }
          : { tone: "info", text: "Still unverified. Check your inbox and spam folder, then refresh again." }
      );
    } catch (error) {
      console.error("Error refreshing verification:", error);
      setVerifyMessage({ tone: "error", text: "Could not refresh the status. Please try again." });
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setVerifyBusy(true);
    try {
      await sendEmailVerification(authUser);
      setVerifyMessage({ tone: "success", text: "Verification email sent." });
    } catch (error) {
      console.error("Error resending verification:", error);
      setVerifyMessage({ tone: "error", text: "Could not send the email. Please try again shortly." });
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      sessionStorage.removeItem("currentUser");
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      toast("Could not sign out. Please try again.", "error");
    }
  };

  const providers = (authUser?.providerData || []).map((p) => p.providerId).join(", ") || "—";
  const created = authUser?.metadata?.creationTime
    ? new Date(authUser.metadata.creationTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const lastSignIn = authUser?.metadata?.lastSignInTime
    ? new Date(authUser.metadata.lastSignInTime).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <section aria-label="Security and account" className="mt-8 max-w-4xl">
      <h2 className="text-lg font-semibold text-slate-900">Security &amp; account</h2>
      <p className="text-sm text-muted mt-0.5 mb-4">Sign-in credentials, verification, sessions, and standing.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-line rounded p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Change password</h3>
          {!hasPasswordProvider ? (
            <p className="text-sm text-muted">
              You sign in with Google, so there is no MarianTrack password to change. Manage your
              password through your Google account instead.
            </p>
          ) : (
            <form onSubmit={handlePasswordChange}>
              {pwMessage && (
                <div
                  role={pwMessage.tone === "error" ? "alert" : "status"}
                  className={`mb-3 p-3 rounded border text-sm ${pwMessage.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
                >
                  {pwMessage.text}
                </div>
              )}
              <div className="mb-3">
                <PasswordInput
                  id="sec-current"
                  label="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={pwSaving}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="mb-1">
                <PasswordInput
                  id="sec-new"
                  label="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={pwSaving}
                  required
                  describedBy="sec-new-reqs"
                />
              </div>
              <PasswordRequirements password={newPassword} id="sec-new-reqs" />
              <div className="mt-3">
                <PasswordInput
                  id="sec-confirm"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={pwSaving}
                  required
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={pwSaving}
                className="mt-4 w-full h-12 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition disabled:opacity-60"
              >
                {pwSaving ? "Updating..." : "Update password"}
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <div className="bg-white border border-line rounded p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Change email</h3>
            {!hasPasswordProvider ? (
              <p className="text-sm text-muted">
                You sign in with Google, so your email is managed through your Google account.
              </p>
            ) : (
              <form onSubmit={handleEmailChange}>
                {emailMessage && (
                  <div
                    role={emailMessage.tone === "error" ? "alert" : "status"}
                    className={`mb-3 p-3 rounded border text-sm ${emailMessage.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
                  >
                    {emailMessage.text}
                  </div>
                )}
                <label className="tbi-label" htmlFor="sec-email">New email address</label>
                <input
                  id="sec-email"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={emailSaving}
                  required
                  placeholder="you@example.com"
                  className="tbi-input h-12 text-[15px] mb-3 disabled:opacity-60"
                />
                <PasswordInput
                  id="sec-email-password"
                  label="Current password (to confirm)"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  disabled={emailSaving}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="submit"
                  disabled={emailSaving}
                  className="mt-4 w-full h-12 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition disabled:opacity-60"
                >
                  {emailSaving ? "Sending..." : "Change email"}
                </button>
              </form>
            )}
          </div>

          <div className="bg-white border border-line rounded p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Email verification</h3>
            <p className="text-sm text-muted mb-3">
              Status:{" "}
              <span className={`font-medium ${verified ? "text-green-700" : "text-amber-700"}`}>
                {verified ? "Verified" : "Unverified"}
              </span>
            </p>
            {verifyMessage && (
              <p role="status" className="text-[13px] text-slate-600 mb-3">{verifyMessage.text}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleRefreshVerification}
                disabled={verifyBusy}
                className="px-4 py-2 bg-white border border-line text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition disabled:opacity-60"
              >
                {verifyBusy ? "Working..." : "Refresh status"}
              </button>
              {!verified && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={verifyBusy}
                  className="px-4 py-2 bg-white border border-line text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition disabled:opacity-60"
                >
                  Resend email
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div className="bg-white border border-line rounded p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Current session</h3>
          <dl className="text-sm text-slate-700 flex flex-col gap-1.5 mt-2">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Sign-in method</dt>
              <dd className="font-medium">{providers}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Account created</dt>
              <dd className="font-medium">{created}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Last sign-in</dt>
              <dd className="font-medium">{lastSignIn}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">This device</dt>
              <dd className="font-medium">This browser</dd>
            </div>
          </dl>
          <p className="text-xs text-muted mt-3">
            Signing out other devices requires an administrator — ask the TBI office if you lose a device.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 px-4 py-2 bg-white border border-line text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition"
          >
            Sign out
          </button>
        </div>

        <div className="bg-white border border-line rounded p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Account standing</h3>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusBadge status={userData?.status === "approved" ? "Active" : userData?.status || "—"} tone={userData?.status === "approved" ? "green" : "gray"} />
            <StatusBadge status={userData?.role || "—"} tone="blue" />
          </div>
          <p className="text-xs text-muted mt-3">
            Role changes are handled by TBI administrators through user management — never from this page.
          </p>
        </div>
      </div>
    </section>
  );
}

export default SecuritySection;
