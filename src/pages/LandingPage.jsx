import { useEffect } from "react";
import { Link } from "react-router-dom";
import MarianLogo from "../assets/images/MarianLogoWtext.png";

// Public gateway: branding plus a single path into the unified sign-in.
// Role-specific login screens were consolidated into /login — accounts keep
// working, only the entry point changed.
function LandingPage() {
  useEffect(() => {
    document.title = "MarianTrack | Home";
  }, []);

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

      {/* Landing panel */}
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
              <img src={MarianLogo} alt="MarianTrack logo" className="w-16 h-16 object-contain" />
              <p className="mt-3 text-sm font-semibold tracking-[0.24em] text-slate-500">MARIANTRACK</p>
              <h1 className="mt-2 text-[30px] font-bold tracking-tight text-slate-900">Welcome to MarianTrack</h1>
              <p className="mt-1 text-sm text-muted">Your gateway to empowering startups through innovation, collaboration, and cutting-edge technology.</p>
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <Link
                to="/login"
                className="w-full h-12 flex items-center justify-center bg-primary-color text-white rounded text-[15px] font-semibold hover:bg-primary-deep transition"
              >
                Sign In
              </Link>
              <p className="text-center text-sm text-muted">
                Don&apos;t have an account?{" "}
                <Link to="/create-account" className="font-medium text-accent hover:underline">
                  Create an account
                </Link>
              </p>
            </div>

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

export default LandingPage;
