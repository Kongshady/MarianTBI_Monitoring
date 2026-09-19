import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { APPLICATION_STATUS, APP_ROLES, INCUBATEE_STATUS, LIFECYCLE_STAGE } from "./domain.js";
import { writeAuditEntry } from "./audit.js";

// Onboarding: converts an Accepted application into a linked incubatee
// startup (groups doc) without duplicating or deleting anything.
// - Application keeps status Accepted; linkage is stored as incubateeGroupId.
// - Group carries applicationId + incubation metadata + incubateeStatus.
// - History is appended to applicationEvents + auditLog.
export async function onboardApplication(
  appId,
  actorId,
  { portfolioManager, programId, startDate, expectedEndDate, objectives }
) {
  if (!appId || !actorId) throw new Error("Application and actor are required.");
  if (!portfolioManager?.id) throw new Error("A Portfolio Manager is required.");
  if (!startDate) throw new Error("Incubation start date is required.");

  const snap = await getDoc(doc(db, "applications", appId));
  if (!snap.exists()) throw new Error("Application not found.");
  const app = snap.data();
  if (app.status !== APPLICATION_STATUS.ACCEPTED) {
    throw new Error("Only Accepted applications can be onboarded.");
  }
  if (app.incubateeGroupId) throw new Error("This application is already onboarded.");

  const groupRef = await addDoc(collection(db, "groups"), {
    name: app.enterpriseName || "Untitled startup",
    description: app.description || "",
    imageUrl: "",
    portfolioManager: {
      id: portfolioManager.id,
      name: portfolioManager.name || "",
      lastname: portfolioManager.lastname || "",
      email: portfolioManager.email || "",
    },
    portfolioManagerId: portfolioManager.id,
    members: [],
    memberIds: [],
    applicationId: appId,
    programId: programId?.trim() ? programId.trim() : null,
    incubationStartDate: startDate,
    incubationExpectedEndDate: expectedEndDate || null,
    objectives: objectives?.trim() ? objectives.trim() : "",
    incubateeStatus: INCUBATEE_STATUS.ONBOARDING,
    archived: false,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "applications", appId), {
    incubateeGroupId: groupRef.id,
    incubateeStatus: INCUBATEE_STATUS.ONBOARDING,
    updatedAt: serverTimestamp(),
  });

  // Promote the applicant on the SAME account: role Applicant → Incubatee
  // (only when currently Applicant — never demote staff or existing team),
  // stage applicant → incubatee, and link their startup for lookups.
  const applicantSnap = await getDoc(doc(db, "users", app.applicantId));
  if (applicantSnap.exists()) {
    const applicant = applicantSnap.data();
    const promotion = {
      lifecycleStage: LIFECYCLE_STAGE.INCUBATEE,
      groupId: groupRef.id,
    };
    if (applicant.role === APP_ROLES.APPLICANT) {
      promotion.role = APP_ROLES.INCUBATEE;
    }
    await updateDoc(doc(db, "users", app.applicantId), promotion);
  }

  await addDoc(collection(db, "applicationEvents"), {
    applicationId: appId,
    from: APPLICATION_STATUS.ACCEPTED,
    to: INCUBATEE_STATUS.ONBOARDING,
    note: "Onboarded as incubatee startup.",
    actorId,
    createdAt: serverTimestamp(),
  });

  await writeAuditEntry({
    actorId,
    action: "application.onboarded",
    targetType: "application",
    targetId: appId,
    detail: groupRef.id,
  });

  await writeAuditEntry({
    actorId,
    action: "user.promoted",
    targetType: "user",
    targetId: app.applicantId,
    detail: "applicant → incubatee",
  });

  return groupRef.id;
}
