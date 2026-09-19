# Marian TBI PMIS — Permission Matrix

Source of truth for WHO → CAN DO WHAT → ON WHICH RECORD → AT WHICH STATE.
Screens derive every check from `src/lib/permissions.js`; Firestore rules
(`firestore.rules`, currently a local draft — not yet deployed) enforce it
server-side. If this doc and the code disagree, the code wins and this doc
must be updated.

Roles: **Applicant** (applying) → **Incubatee** (accepted; same account, see
Lifecycle below) · **Mentor** (record-scoped) · **Portfolio Manager**
(assigned startups) · **TBI Assistant** (operations) · **TBI Manager**
(operations + decisions + user admin) · **Management** (read-oriented
oversight; business writes denied by rule) · **System Administrator**
(users/roles + audit; business areas hidden and denied). Team functions
inside a startup (Project Manager / System Analyst / Developer) are NOT
login roles.

| Module | Applicant | Incubatee (own startup) | Mentor | Portfolio Mgr | TBI Asst | TBI Mgr | Mgmt | SysAdmin |
|---|---|---|---|---|---|---|---|---|
| Own profile | Edit own fields | Edit own fields | Edit own fields | Edit own fields | Edit own fields | Edit own fields | Edit own fields | Edit own fields |
| Applications | Own CRUD + submit | Own/history | — | — | Review/move | Review/move/decide | Read | — |
| Screening / Evaluation notes | No (status only) | No (status only) | No | No | Manage (`reviewNotes`, staff-only) | Manage | No | No |
| Startups | — | Own (PM-side edits) | Assigned view | Assigned view | Manage | Manage | Read | — |
| Programs / Activities | View / register | View / register | View | View | Manage | Manage + delete | Read | — |
| Milestones | — | PM-side manage; PM deletes | Assigned view | View | Manage | Manage | Read | — |
| Mentorship | — | View own | Record own sessions | View | Assign + record | Assign + record | Read | — |
| Progress reports | Own (as applicant) | Submit own | Assigned view | View | Review | Review + delete | Read | — |
| Assessments | Result only | Result only | Own input | View | Manage | Manage + delete | Read | — |
| Graduation / Exit | — | View own | View assigned | View | Move non-terminal | Record outcomes | Read | — |
| Reports | Own | Own | Assigned | Operational | Operational | Operational | Organization-wide | System |
| Users / Roles / Config | No | No | No | No | No | Manage | No | Manage |
| Audit log | No | No | No | No | Read | Read | No | Read |

Lifecycle: Applicant → (Accepted + onboarding) → Incubatee on the SAME
account — onboarding promotes `users.role` (Applicant → Incubatee, only when
currently Applicant), sets `lifecycleStage: incubatee` and links
`users.groupId`. Returned applications reopen for editing on the same
record; terminal outcomes are append-only (`outcomes` collection, no
update/delete).

Transition authority: Submit (owner) · Screen/Evaluate/Return (staff) ·
Accept/Reject (Manager; Management dual-approval pending decision) ·
Onboard incl. same-account promotion (staff) · Graduate/Exit (Manager +
outcome record) · Record session (staff or assigned mentor) · Verify docs
(staff; entity pending). Application + incubation transitions are enforced
in `firestore.rules`, not just UI.

Record-level model: owners via `applicantId`/`incubateeId`/`userId`;
startup scope via `memberIds[]`/`portfolioManagerId` mirrors (writers
maintain them; legacy docs fall back to embedded objects, no backfill
needed); mentors via active `mentorAssignments`.

Page access (enforced in `ProtectedRoute` + `src/lib/access.js`, not just nav):

- Wrong role on a route → `/forbidden` (403 page) when signed in, `/`
  when signed out. Record denial inside a page → inline `AccessRestricted`.
- Startup detail: member, actively assigned mentor, staff, or read-only
  Management. Ended assignments close page access (chat history stays).
  Mentors get a forced read-only view even where team gates would open.
- Application detail: owner, staff, or read-only Management. SysAdmin
  explicitly denied (no business access).
- Admin startup view: every manage affordance resolves through the viewer
  role, so Management sees the same page read-only.

System administration: code-defined role defaults in `src/lib/roles.js`
(`ROLE_PERMISSIONS`, `mayPerformSensitive`); account disable/enable
(revokes access, preserves history) with a Disabled tab and confirmations;
`/admin/roles` (Managers read-only, System Administrator configures),
`/admin/system` settings, and `/admin/audit` append-only viewer — the
latter two System Administrator only. Managers assign
predefined roles in user management (audited) but cannot configure roles,
permissions, settings, or the audit log. Business collections deny SysAdmin
writes by rule.

Role permission adjustments (System Administrator only): additive
`roleOverrides/{role}` documents (`grants[]`, `revokes[]`, `active` /
`archived` — never deleted) adjust the code defaults without rewriting
them; missing or archived means defaults apply exactly. Human-readable
catalog in `src/lib/permissionCatalog.js` (Role → Module → Action →
Scope); technical keys stay internal and are validated server-side. The
System Administrator role is locked (no override document may target it),
nobody may change their own role, only a System Administrator may hand out
the System Administrator role, and Manager user-admin powers honor active
revokes — all enforced in `firestore.rules`, with every change confirmed
in UI and written to the audit log.

Open items: deployed production rules are unverified — emulator-test the
draft before deploying; Management dual-approval gate undecided;
bundle/image diet + responsive/a11y sweep outstanding.
