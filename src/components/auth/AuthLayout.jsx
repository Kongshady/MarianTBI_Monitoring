import { Link } from "react-router-dom";
import { FiArrowLeft } from "react-icons/fi";
import MarianLogo from "../../assets/images/MarianLogoWtext.png";

// Shared authentication shell: compact branding panel + centered form
// column. Every public auth page (sign-in adjacent flows, registration,
// reset, waiting) renders inside this so the system feels like one product.
function AuthLayout({ title, eyebrow, description, backTo, backLabel = "Back", children, wide = false }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Branding panel */}
      <div className="relative hidden lg:flex lg:basis-[45%] bg-banner-img bg-cover bg-center" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-t from-primary-deep/90 via-primary-deep/45 to-black/35" />
        <div className="relative flex flex-col justify-end p-12 xl:p-16 text-white max-w-xl">
          <p className="text-[13px] font-medium tracking-[0.18em] uppercase text-slate-200">
            University of the Immaculate Conception
          </p>
          <p className="mt-3 text-5xl font-extrabold tracking-tight leading-none">MARIAN</p>
          <p className="mt-2 text-xl font-semibold leading-snug">
            Technology
            <br />
            Business Incubator
          </p>
          <span className="mt-5 block w-12 h-1 bg-[#C22A72] rounded-full" />
          <p className="mt-4 text-sm leading-relaxed text-slate-100">
            Empowering startups through innovation, collaboration, mentorship, and technology.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex flex-col lg:basis-[55%]">
        <div className="lg:hidden bg-primary-color px-6 py-4 flex items-center gap-3">
          <img src={MarianLogo} alt="Marian TBI" className="w-10 h-10 bg-white rounded p-0.5 object-contain" />
          <p className="text-white font-bold tracking-wide text-sm">MARIANTRACK</p>
        </div>

        <main className="flex-1 flex items-center justify-center px-6 py-10 sm:px-10">
          <div className={`w-full ${wide ? "max-w-[520px]" : "max-w-[420px]"}`}>
            {backTo && (
              <Link
                to={backTo}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent hover:underline mb-6"
              >
                <FiArrowLeft aria-hidden="true" />
                {backLabel}
              </Link>
            )}
            <div className="hidden lg:flex flex-col items-center text-center mb-6">
              <img src={MarianLogo} alt="Marian TBI logo" className="w-14 h-14 object-contain" />
            </div>
            {eyebrow && (
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-500 text-center lg:text-left">
                {eyebrow}
              </p>
            )}
            <h1 className="mt-1 text-[28px] font-bold tracking-tight text-slate-900 text-center lg:text-left">
              {title}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-muted text-center lg:text-left">{description}</p>
            )}
            <div className="mt-6">{children}</div>
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

export default AuthLayout;
