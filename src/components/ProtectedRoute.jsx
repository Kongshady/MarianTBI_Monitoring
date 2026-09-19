import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, db } from "../config/marian-config.js";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Inline arrays in routes.jsx get a new reference on every render, which
  // would re-trigger this effect (and re-read Firestore) endlessly. Depend
  // on a stable stringified key instead.
  const allowedRolesKey = JSON.stringify(allowedRoles);

  useEffect(() => {
    const roles = JSON.parse(allowedRolesKey);
    const checkAuth = async (user) => {
      try {
        if (user) {
          setIsAuthenticated(true);
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.status === "approved" && roles.includes(userData.role)) {
              setIsAuthorized(true);
            }
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Failed to verify user authorization:", err);
      } finally {
        setIsLoading(false);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      checkAuth(user);
    });

    return () => unsubscribe(); // Cleanup the listener on unmount
  }, [allowedRolesKey]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-svh">
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  if (isAuthorized) return children;
  // Signed-in but wrong role → professional 403. Signed-out → landing.
  return <Navigate to={isAuthenticated ? "/forbidden" : "/"} replace />;
};

export default ProtectedRoute;