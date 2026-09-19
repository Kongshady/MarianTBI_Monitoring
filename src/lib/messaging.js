import { APP_ROLES } from "./domain.js";

// Relationship-based messaging authorization (client-side resolver).
// A contact appears in someone's list ONLY with a legitimate TBI
// relationship — never a global directory. Server-side, Firestore rules
// enforce participant-only reads, sender==auth writes, approved + non
// SysAdmin parties. Full pair-matrix enforcement belongs in a Cloud
// Function (no blind client trust); this resolver is the UX boundary.
//
// Contact: { id, name, lastname, role, relation, relationLabel,
//   groupId?, groupName?, readOnly? }

function personOf(user) {
  return {
    id: user.id,
    name: user.name || "",
    lastname: user.lastname || "",
    role: user.role || "",
  };
}

function dedupe(contacts) {
  const seen = new Set();
  return contacts.filter((c) => {
    if (!c?.id || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

function staffOf(users, label) {
  return users
    .filter((u) => u.status === "approved" && (u.role === APP_ROLES.TBI_MANAGER || u.role === APP_ROLES.TBI_ASSISTANT))
    .map((u) => ({ ...personOf(u), relation: "staff", relationLabel: label || "TBI Staff" }));
}

function managersOf(users) {
  return users
    .filter((u) => u.status === "approved" && u.role === APP_ROLES.TBI_MANAGER)
    .map((u) => ({ ...personOf(u), relation: "staff", relationLabel: "TBI Management chain" }));
}

function groupById(groups, id) {
  return (groups || []).find((g) => g.id === id) || null;
}

function membersOf(group) {
  return (group?.members || []).map((m) => ({
    id: m.id,
    name: m.name || "",
    lastname: m.lastname || "",
    role: m.groupRole || "Member",
  }));
}

// Groups the viewer belongs to as a team member (UID-based, not email).
export function myMemberGroups(groups, uid) {
  return (groups || []).filter((g) => (g.members || []).some((m) => m.id === uid));
}

export function activeAssignmentsForGroup(assignments, groupId) {
  return (assignments || []).filter((a) => a.groupId === groupId && !a.endedAt);
}

// Build the authorized contact list for a viewer.
// input: { me: {id, role}, users, groups, applications, assignments }
export function getChatContacts({ me, users = [], groups = [], applications = [], assignments = [] }) {
  if (!me?.id) return [];
  const approved = users.filter((u) => u.status === "approved" && u.id !== me.id);
  const byId = new Map(approved.map((u) => [u.id, u]));
  const role = me.role;

  const withUser = (contact) => {
    const full = byId.get(contact.id);
    if (full && !contact.name && !contact.lastname) {
      contact.name = full.name || "";
      contact.lastname = full.lastname || "";
      contact.role = contact.role || full.role || "";
    }
    return contact;
  };

  // System Administrator: no general chat participation by default.
  if (role === APP_ROLES.SYS_ADMIN) return [];

  // Management: operational chain only (Limited = closed by default).
  if (role === APP_ROLES.MANAGEMENT) {
    return dedupe([...staffOf(approved, "TBI Staff")]).map(withUser);
  }

  // Applicant: TBI staff for application support. No mentors, no peers.
  if (role === APP_ROLES.APPLICANT) {
    return dedupe(staffOf(approved, "TBI Staff · application support")).map(withUser);
  }

  // Mentor: staff + members of actively assigned startups.
  if (role === APP_ROLES.MENTOR) {
    const mine = assignments.filter((a) => a.mentorId === me.id && !a.endedAt);
    const out = [...staffOf(approved, "TBI Staff")];
    for (const a of mine) {
      const g = groupById(groups, a.groupId);
      if (!g) continue;
      for (const m of membersOf(g)) {
        if (m.id === me.id) continue;
        out.push({ ...m, relation: "incubatee", relationLabel: `Incubatee · ${g.name}`, groupId: g.id, groupName: g.name });
      }
      if (g.portfolioManager?.id && g.portfolioManager.id !== me.id) {
        out.push({
          id: g.portfolioManager.id,
          name: g.portfolioManager.name || "",
          lastname: g.portfolioManager.lastname || "",
          role: "Portfolio Manager",
          relation: "staff",
          relationLabel: `TBI Staff · ${g.name}`,
          groupId: g.id,
          groupName: g.name,
        });
      }
    }
    return dedupe(out).map(withUser);
  }

  // Portfolio Manager: chain + project leads of OWN startups + their mentors.
  if (role === APP_ROLES.PORTFOLIO_MANAGER) {
    const mine = groups.filter((g) => g.portfolioManager?.id === me.id || (g.portfolioManagerId || null) === me.id);
    const out = [...staffOf(approved, "TBI Staff"), ...managersOf(approved)];
    for (const g of mine) {
      for (const m of membersOf(g)) {
        if (m.id === me.id) continue;
        out.push({ ...m, relation: "incubatee", relationLabel: `Team · ${g.name}`, groupId: g.id, groupName: g.name });
      }
      for (const a of activeAssignmentsForGroup(assignments, g.id)) {
        const mentor = byId.get(a.mentorId);
        if (mentor) {
          out.push({ ...personOf(mentor), relation: "mentor", relationLabel: `Mentor · ${g.name}`, groupId: g.id, groupName: g.name });
        }
      }
    }
    return dedupe(out).map(withUser);
  }

  // TBI Manager / Assistant: operational scope = all applicants (with an
  // application), all team members, active mentors, staff, management.
  if (role === APP_ROLES.TBI_MANAGER || role === APP_ROLES.TBI_ASSISTANT) {
    const out = [];
    const applicantIds = new Set((applications || []).map((a) => a.applicantId));
    for (const u of approved) {
      if (applicantIds.has(u.id) && (u.role === APP_ROLES.APPLICANT || u.role === APP_ROLES.INCUBATEE)) {
        const app = (applications || []).find((a) => a.applicantId === u.id);
        out.push({
          ...personOf(u),
          relation: "applicant",
          relationLabel: app?.enterpriseName ? `Applicant · ${app.enterpriseName}` : "Applicant",
        });
      }
    }
    for (const g of groups || []) {
      if (g.archived) continue;
      for (const m of membersOf(g)) {
        out.push({ ...m, relation: "incubatee", relationLabel: `Team · ${g.name}`, groupId: g.id, groupName: g.name });
      }
    }
    const activeMentorIds = new Set((assignments || []).filter((a) => !a.endedAt).map((a) => a.mentorId));
    for (const u of approved) {
      if (u.role === APP_ROLES.MENTOR && activeMentorIds.has(u.id)) {
        out.push({ ...personOf(u), relation: "mentor", relationLabel: "Mentor" });
      }
      if (u.role === APP_ROLES.TBI_MANAGER || u.role === APP_ROLES.TBI_ASSISTANT) {
        out.push({ ...personOf(u), relation: "staff", relationLabel: "TBI Staff · internal" });
      }
      if (u.role === APP_ROLES.MANAGEMENT) {
        out.push({ ...personOf(u), relation: "staff", relationLabel: "Management" });
      }
    }
    return dedupe(out).map(withUser);
  }

  // Incubatee + legacy team roles: own teammates, own managers, staff,
  // and mentors actively assigned to own startups.
  const mine = myMemberGroups(groups, me.id);
  const out = [...staffOf(approved, "TBI Staff")];
  for (const g of mine) {
    if (g.portfolioManager?.id && g.portfolioManager.id !== me.id) {
      out.push({
        id: g.portfolioManager.id,
        name: g.portfolioManager.name || "",
        lastname: g.portfolioManager.lastname || "",
        role: "Portfolio Manager",
        relation: "staff",
        relationLabel: `My TBI Staff · ${g.name}`,
        groupId: g.id,
        groupName: g.name,
      });
    }
    for (const m of membersOf(g)) {
      if (m.id === me.id) continue;
      out.push({ ...m, relation: "teammate", relationLabel: `Teammate · ${g.name}`, groupId: g.id, groupName: g.name });
    }
    for (const a of activeAssignmentsForGroup(assignments, g.id)) {
      const mentor = byId.get(a.mentorId);
      if (mentor && mentor.id !== me.id) {
        out.push({ ...personOf(mentor), relation: "mentor", relationLabel: `My Mentor · ${g.name}`, groupId: g.id, groupName: g.name });
      }
    }
  }
  return dedupe(out).map(withUser);
}

// Past contacts: people with conversation history but no live relationship
// (e.g. ended mentor assignment). History stays readable; sending is closed.
export function getPastContacts({ me, allMessages = [], users = [], currentIds = [] }) {
  if (!me?.id) return [];
  const current = new Set(currentIds);
  const partnerIds = new Set();
  for (const m of allMessages || []) {
    if (m.senderId === me.id && m.receiverId && m.receiverId !== me.id) partnerIds.add(m.receiverId);
    if (m.receiverId === me.id && m.senderId && m.senderId !== me.id) partnerIds.add(m.senderId);
  }
  const byId = new Map((users || []).map((u) => [u.id, u]));
  const out = [];
  for (const pid of partnerIds) {
    if (current.has(pid)) continue;
    const u = byId.get(pid);
    if (!u) continue;
    out.push({
      id: pid,
      name: u.name || "",
      lastname: u.lastname || "",
      role: u.role || "",
      relation: "past",
      relationLabel: "Past contact · read-only",
      readOnly: true,
    });
  }
  return out;
}

// Composer gate. Returns { allowed, reason }.
export function canSendTo(contact) {
  if (!contact) return { allowed: false, reason: "" };
  if (contact.readOnly) {
    return {
      allowed: false,
      reason: "Messaging is unavailable because this relationship has ended. Previous messages are preserved below.",
    };
  }
  return { allowed: true, reason: "" };
}
