# Chat & Messaging — Access Matrix

A contact appears in someone's list ONLY with a legitimate TBI
relationship (resolved client-side in `src/lib/messaging.js`). Server-side,
`firestore.rules` (local draft — not yet deployed) enforces
participant-only reads, `senderId == auth` writes, and approved,
non-SysAdmin parties on both ends. Pair-level matrix enforcement belongs in
a Cloud Function; until then the resolver is the UX boundary and the rules
are the coarse security boundary.

| Sender \ Recipient | Applicant | Incubatee | Mentor | TBI Staff | Management | SysAdmin |
|---|---|---|---|---|---|---|
| Applicant | — | No | No | Managers/Assistants only | No (Limited=closed) | No (rule-denied) |
| Incubatee | No | Teammates only | Active assignment only | Own PM + Mgr/Asst | No (Limited=closed) | No (rule-denied) |
| Mentor | No | Active assignments only | — | Mgr/Asst + own PMs | No (Limited=closed) | No (rule-denied) |
| Portfolio Mgr | No | Own startups' teams | Assigned mentors | Mgr/Asst | No | No (rule-denied) |
| TBI Mgr/Asst | Applicants w/ applications | All teams | Active mentors | Staff + Mgmt | Managers/Assistants | No (rule-denied) |
| Management | No (Limited=closed) | No (Limited=closed) | No (Limited=closed) | Mgr/Asst | Mgr/Asst + Mgmt | No (rule-denied) |
| SysAdmin | — (no contacts) | — | — | — | — | — |

Rules (enforced when deployed):

- Reads: participant-only (`senderId`/`receiverId` match).
- Creates: sender is caller; recipient exists, approved, not SysAdmin;
  sender not SysAdmin.
- Updates: sender edits text (`message`, `edited`); receiver flips `seen`.
- Deletes: sender only.

Lifecycle:

- Ended mentor assignment → contact drops from the directory; prior
  conversation stays visible with a read-only composer banner. History is
  never deleted or transferred.
- Applicant → Incubatee promotion keeps the account, so staff conversations
  continue uninterrupted.
- First message to a contact writes a `conversation.started` audit entry
  (no content logged).

Open items: conversations collection with staff-managed membership (would
let rules verify each pair instead of role gates); group/cohort chat
(not implemented — no requirement found); attachment support (none exists;
same scoping would apply); emulator execution (needs JDK 21+).
