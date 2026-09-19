import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/marian-config.js";

// Single post-authentication routine shared by every sign-in entry point.
// The UI never decides the role: Firestore users/{uid} is the source of
// truth, and the same function maps it to a landing page everywhere.
export function resolveLanding(role) {
  switch (role) {
    case "Applicant":
      return "/applications";
    case "Portfolio Manager":
      return "/employee-dashboard";
    case "TBI Manager":
    case "TBI Assistant":
    case "Management":
      return "/admin-dashboard";
    case "System Administrator":
      return "/admin-user-management";
    case "Incubatee":
    case "Mentor":
    default:
      return "/incubatee-dashboard";
  }
}

// Reads the caller's account record and classifies the sign-in outcome.
// Returns { ok, status, role, redirect } — never throws for known states.
export async function classifySignIn(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (!userDoc.exists()) {
    return {
      ok: false,
      code: "no-account",
      message: "No account found for these credentials. Create an account or contact Marian TBI administration.",
    };
  }
  const userData = userDoc.data();
  if (userData.status !== "approved") {
    return {
      ok: false,
      code: "inactive",
      message: "Your account is currently inactive. Please contact Marian TBI administration.",
    };
  }
  return { ok: true, status: userData.status, role: userData.role, redirect: resolveLanding(userData.role) };
}
