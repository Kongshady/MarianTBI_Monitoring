import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../config/marian-config.js";
import { APP_ROLES } from "./domain.js";
import { defaultPermissionsFor } from "./roles.js";
import { catalogEntryFor } from "./permissionCatalog.js";
import { writeAuditEntry } from "./audit.js";

// Runtime permission adjustments per role, owned by the System Administrator.
//
// Shape: roleOverrides/{role} = {
//   grants: [technical keys], revokes: [technical keys],
//   status: "active" | "archived",
//   reason, updatedBy, updatedAt,
// }
//
// Additive by design: with no override document (or an archived one), the
// effective set equals the code defaults in src/lib/roles.js exactly, so
// existing authorization behavior never changes silently. Overrides are
// archived, never deleted. The System Administrator role is locked — neither
// the client nor firestore.rules accept overrides for it.

export const ROLE_OVERRIDES_COLLECTION = "roleOverrides";
export const PROTECTED_ROLE = APP_ROLES.SYS_ADMIN;
export const OVERRIDE_ACTIVE = "active";
export const OVERRIDE_ARCHIVED = "archived";

export function isProtectedRole(role) {
  return role === PROTECTED_ROLE;
}

export function subscribeRoleOverrides(onUpdate, onError) {
  return onSnapshot(
    collection(db, ROLE_OVERRIDES_COLLECTION),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (error) => {
      console.error("Error subscribing to role overrides:", error);
      if (onError) onError(error);
    }
  );
}

export function overrideForRole(overrides, role) {
  return (overrides || []).find((o) => o.id === role) || null;
}

function activeOverride(overrides, role) {
  const o = overrideForRole(overrides, role);
  return o && o.status === OVERRIDE_ACTIVE ? o : null;
}

// Effective permission keys for display and UI gating: defaults, plus
// active grants, minus active revokes. Pure — safe to call in render.
export function effectivePermissionsFor(role, overrides) {
  const base = new Set(defaultPermissionsFor(role));
  const o = activeOverride(overrides, role);
  if (o) {
    (o.grants || []).forEach((k) => base.add(k));
    (o.revokes || []).forEach((k) => base.delete(k));
  }
  return [...base];
}

export function grantedKeysFor(role, overrides) {
  const o = activeOverride(overrides, role);
  return o ? [...(o.grants || [])] : [];
}

export function revokedKeysFor(role, overrides) {
  const o = activeOverride(overrides, role);
  return o ? [...(o.revokes || [])] : [];
}

function assertEditable(role, key) {
  if (isProtectedRole(role)) {
    throw new Error("The System Administrator role is locked and cannot be modified.");
  }
  if (!catalogEntryFor(key)) {
    throw new Error(`Unknown permission key: ${key}`);
  }
}

// mode: "grant" (add access), "revoke" (remove default access), or
// "restore" (drop both lists for this key, returning to the default).
export async function savePermissionChange({ role, key, mode, reason, actorId }) {
  assertEditable(role, key);
  if (!["grant", "revoke", "restore"].includes(mode)) {
    throw new Error(`Unknown change mode: ${mode}`);
  }
  const ref = doc(db, ROLE_OVERRIDES_COLLECTION, role);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : { grants: [], revokes: [] };
  const grants = new Set(current.grants || []);
  const revokes = new Set(current.revokes || []);
  grants.delete(key);
  revokes.delete(key);
  if (mode === "grant") grants.add(key);
  if (mode === "revoke") revokes.add(key);
  await setDoc(
    ref,
    {
      grants: [...grants],
      revokes: [...revokes],
      status: OVERRIDE_ACTIVE,
      reason: reason || null,
      updatedBy: actorId || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  const action =
    mode === "grant" ? "role.permission_granted" : mode === "revoke" ? "role.permission_revoked" : "role.permission_restored";
  await writeAuditEntry({
    actorId,
    action,
    targetType: "role",
    targetId: role,
    detail: `${key}${reason ? ` — ${reason}` : ""}`,
  });
}

// Re-activate an archived override document, keeping its grant/revoke lists.
export async function restoreRoleOverrides({ role, reason, actorId }) {
  if (isProtectedRole(role)) {
    throw new Error("The System Administrator role is locked and cannot be modified.");
  }
  await setDoc(
    doc(db, ROLE_OVERRIDES_COLLECTION, role),
    {
      status: OVERRIDE_ACTIVE,
      reason: reason || null,
      updatedBy: actorId || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await writeAuditEntry({
    actorId,
    action: "role.overrides_restored",
    targetType: "role",
    targetId: role,
    detail: reason || null,
  });
}

// Archive instead of delete: history of what changed stays queryable.
export async function archiveRoleOverrides({ role, reason, actorId }) {
  if (isProtectedRole(role)) {
    throw new Error("The System Administrator role is locked and cannot be modified.");
  }
  await setDoc(
    doc(db, ROLE_OVERRIDES_COLLECTION, role),
    {
      status: OVERRIDE_ARCHIVED,
      reason: reason || null,
      updatedBy: actorId || null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  await writeAuditEntry({
    actorId,
    action: "role.overrides_archived",
    targetType: "role",
    targetId: role,
    detail: reason || null,
  });
}
