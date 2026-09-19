import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/marian-config.js";
import { homePath } from "../components/layout/nav.js";

// Professional 403: authenticated users who lack access land here instead
// of being bounced to the landing page with no explanation.
function Forbidden() {
  const [home, setHome] = useState("/");
  const [role, setRole] = useState("");

  useEffect(() => {
    document.title = "Access restricted";
    const load = async () => {
      try {
        const current = auth.currentUser;
        if (!current) return;
        const userDoc = await getDoc(doc(db, "users", current.uid));
        if (userDoc.exists()) {
          const userRole = userDoc.data().role || "";
          setRole(userRole);
          setHome(homePath(userRole));
        }
      } catch (error) {
        console.error("Error resolving home:", error);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="bg-white border border-line rounded p-8 max-w-md w-full text-center">
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">403 · Access restricted</p>
        <h1 className="text-2xl font-semibold text-slate-900 mt-2">You don&apos;t have permission to access this page.</h1>
        <p className="text-sm text-muted mt-2">
          {role
            ? `Signed in as ${role}. If you need access, ask your TBI administrator.`
            : "If you need access, ask your TBI administrator."}
        </p>
        <Link
          to={home}
          className="inline-block mt-6 px-5 py-2.5 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}

export default Forbidden;
