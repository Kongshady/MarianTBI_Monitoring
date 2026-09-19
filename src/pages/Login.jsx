import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../config/marian-config.js";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { FcGoogle } from "react-icons/fc";
import { FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";
import MarianLogo from "../assets/images/MarianLogoWtext.png";
import { classifySignIn } from "../lib/auth.js";

// Unified sign-in: one entry point for every role. The account record in
// Firestore decides status, role, and landing page — the UI never asks for
// or assumes a role. Wraps the existing Firebase email + Google providers.
function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    document.title = "MarianTrack | Sign In";
  }, []);

  const finishWith = async (uid) => {
    const result = await classifySignIn(uid);
    if (!result.ok) {
      setError(result.message);
      await auth.signOut().catch(() => {});
      return;
    }
    navigate(result.redirect, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy || googleBusy) return;
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishWith(credential.user.uid);
    } catch (err) {
      console.error("Email sign-in failed:", err.code || err);
      setError("Email or password is incorrect. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (busy || googleBusy) return;
    setError("");
    setGoogleBusy(true);
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await finishWith(result.user.uid);
    } catch (err) {
      console.error("Google sign-in failed:", err.code || err);
      if (err.code !== "auth/popup-closed-by-user") {
        setError("We couldn't sign you in with Google right now. Please try again.");
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const locked = busy || googleBusy;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Branding panel */}
      <div className="relative hidden lg:flex lg:basis-[55%] bg-banner-img bg-cover bg-center" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-t from-primary-deep/90 via-primary-deep/45 to-black/35" />
        <div className="relative flex flex-col justify-end p-12 xl:p-16 text-white max-w-xl">
          <p className="text-[13px] font-medium tracking-[0.18em] uppercase text-slate-200">
            University of the Immaculate Conception
          </p>
          <p className="mt-3 text-6xl font-extrabold tracking-tight leading-none">MARIAN</p>
          <p className="mt-2 text-2xl font-semibold leading-snug">
            Technology
            <br />
            Business Incubator
          </p>
          <span className="mt-5 block w-12 h-1 bg-[#C22A72] rounded-full" />
          <p className="mt-4 text-[15px] leading-relaxed text-slate-100">
            Empowering startups through innovation, collaboration, mentorship, and technology.
          </p>
          <p className="mt-4 text-xs font-medium tracking-[0.22em] uppercase text-slate-300">
            Innovation · Mentorship · Growth
          </p>
        </div>
      </div>

      {/* Authentication panel */}
      <div className="flex-1 flex flex-col lg:basis-[45%]">
        {/* Compact brand header for small screens */}
        <div className="lg:hidden bg-primary-color px-6 py-5 flex items-center gap-3">
          <img src={MarianLogo} alt="Marian TBI" className="w-11 h-11 bg-white rounded p-0.5 object-contain" />
          <div className="leading-tight">
            <p className="text-white font-bold tracking-wide">MARIAN TBI</p>
            <p className="text-slate-300 text-xs tracking-[0.2em]">MARIANTRACK</p>
          </div>
        </div>

        <main className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">
            <div className="flex flex-col items-center text-center">
              <img src={MarianLogo} alt="Marian TBI logo" className="w-16 h-16 object-contain" />
              <p className="mt-3 text-sm font-semibold tracking-[0.24em] text-slate-500">MARIANTRACK</p>
              <h1 className="mt-2 text-[30px] font-bold tracking-tight text-slate-900">Welcome back</h1>
              <p className="mt-1 text-sm text-muted">Sign in to continue to MarianTrack.</p>
            </div>

            {error && (
              <div role="alert" className="mt-6 flex gap-2.5 p-3.5 rounded border border-red-200 bg-red-50">
                <FiAlertCircle className="shrink-0 mt-0.5 text-red-600" aria-hidden="true" />
                <p className="text-sm text-red-800">
                  <span className="font-medium">Sign-in failed. </span>
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6" noValidate={false}>
              <label className="tbi-label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={locked}
                required
                placeholder="you@example.com"
                className="tbi-input h-12 text-[15px] mb-4 disabled:opacity-60"
              />

              <div className="flex items-baseline justify-between mb-1">
                <label className="tbi-label !mb-0" htmlFor="login-password">
                  Password
                </label>
                <Link to="/password-reset" tabIndex={locked ? -1 : 0} className="text-[13px] font-medium text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={locked}
                  required
                  placeholder="Enter your password"
                  className="tbi-input h-12 text-[15px] pr-12 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={locked}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition disabled:opacity-50"
                >
                  {showPassword ? <FiEyeOff className="text-lg" aria-hidden="true" /> : <FiEye className="text-lg" aria-hidden="true" />}
                </button>
              </div>

              <button
                type="submit"
                disabled={locked}
                className="mt-5 w-full h-12 bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {busy ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6" aria-hidden="true">
              <span className="flex-1 border-t border-line" />
              <span className="text-xs text-muted">Or</span>
              <span className="flex-1 border-t border-line" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={locked}
              className="w-full h-12 flex items-center justify-center gap-2.5 bg-white border border-line rounded text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FcGoogle className="w-5 h-5" aria-hidden="true" />
              {googleBusy ? "Connecting..." : "Continue with Google"}
            </button>

            <p className="mt-6 text-center text-sm text-muted">
              Don&apos;t have an account?{" "}
              <Link to="/create-account" className="font-medium text-accent hover:underline">
                Create an account
              </Link>
            </p>

            <footer className="mt-10 text-center">
              <p className="text-xs text-slate-400">MarianTrack · Marian Technology Business Incubator</p>
              <p className="text-xs text-slate-400 mt-0.5">© 2026 University of the Immaculate Conception</p>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Login;
