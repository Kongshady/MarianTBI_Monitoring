import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import ConfirmDialog from "../../components/ui/ConfirmDialog.jsx";
import { toast } from "../../lib/toast.js";
import DocumentsPanel from "../../components/documents/DocumentsPanel.jsx";
import { ErrorState, PageSkeleton, AccessRestricted } from "../../components/ui/states.jsx";
import {
  APPLICATION_STATUS,
  APPLICATION_TRANSITIONS,
  canTransition,
  formatDateTimeSafe,
  toDateSafe,
} from "../../lib/domain.js";
import {
  moveApplication,
  submitApplication,
  updateDraftApplication,
} from "../../lib/applications.js";
import { onboardApplication } from "../../lib/onboarding.js";
import {
  REVIEW_KIND_LIST,
  createReviewNote,
  deleteReviewNote,
  subscribeToReviewNotes,
  updateReviewNote,
} from "../../lib/reviews.js";
import { isStaffAppRole, isManagerAppRole, isPortfolioManagerRole } from "../../lib/permissions.js";
import { resolveApplicationAccess } from "../../lib/access.js";
import { writeAuditEntry } from "../../lib/audit.js";

function groupPathForRole(userRole, groupId) {
  if (isStaffAppRole(userRole)) return `/admin/view-group/${groupId}`;
  if (isPortfolioManagerRole(userRole)) return `/employee/view-group/${groupId}`;
  return `/incubatee/view-group/${groupId}`;
}

const FIELD_DEFS = [
  { key: "enterpriseName", label: "Enterprise name", type: "text", required: true },
  { key: "description", label: "Business description", type: "textarea", required: true },
  { key: "problem", label: "Problem", type: "textarea", required: false },
  { key: "solution", label: "Solution", type: "textarea", required: false },
  { key: "targetMarket", label: "Target market", type: "textarea", required: false },
  { key: "businessModel", label: "Business model", type: "textarea", required: false },
  { key: "team", label: "Team", type: "textarea", required: false },
];

function ApplicationDetail() {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [app, setApp] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [moveNote, setMoveNote] = useState("");
  const [acting, setActing] = useState(false);
  const [pmList, setPmList] = useState([]);
  const [pmId, setPmId] = useState("");
  const [programOptions, setProgramOptions] = useState([]);
  const [obProgramId, setObProgramId] = useState("");
  const [obStartDate, setObStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [obEndDate, setObEndDate] = useState("");
  const [obObjectives, setObObjectives] = useState("");
  const [obError, setObError] = useState("");
  const [obSaving, setObSaving] = useState(false);
  const [linkedGroupName, setLinkedGroupName] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteKind, setNoteKind] = useState(REVIEW_KIND_LIST[0]);
  const [noteFindings, setNoteFindings] = useState("");
  const [noteRecommendation, setNoteRecommendation] = useState("");
  const [noteError, setNoteError] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const isStaff = isStaffAppRole(role);
  const isManager = isManagerAppRole(role);
  const isOwner = user && app && app.applicantId === user.id;
  const canEdit = isOwner && [APPLICATION_STATUS.DRAFT, APPLICATION_STATUS.RETURNED].includes(app?.status);
  const nextStatuses = app ? APPLICATION_TRANSITIONS[app.status] || [] : [];
  const needsOnboarding = isStaff && app?.status === APPLICATION_STATUS.ACCEPTED && !app?.incubateeGroupId;

  useEffect(() => {
    document.title = "Application Detail";
  }, []);

  useEffect(() => {
    let unsubApp = () => {};
    let unsubEvents = () => {};
    let cancelled = false;

    const init = async () => {
      try {
        const current = auth.currentUser;
        if (!current) {
          setError("You are not signed in.");
          setLoading(false);
          return;
        }
        const userDoc = await getDoc(doc(db, "users", current.uid));
        if (!userDoc.exists()) {
          setError("User record not found.");
          setLoading(false);
          return;
        }
        const userData = { id: userDoc.id, ...userDoc.data() };
        if (cancelled) return;
        setUser(userData);
        setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());
        setRole(userData.role || "");

        unsubApp = onSnapshot(
          doc(db, "applications", id),
          (snap) => {
            if (cancelled) return;
            if (!snap.exists()) {
              setError("Application not found.");
              setLoading(false);
              return;
            }
            const data = { id: snap.id, ...snap.data() };
            // Record-level gate: owner, staff, or read-only Management.
            // System Administrators have no business access.
            const level = resolveApplicationAccess({
              application: data,
              userId: userData.id,
              appRole: userData.role,
            });
            if (!level) {
              setAccessDenied(true);
              setLoading(false);
              return;
            }
            setApp(data);
            setForm({
              enterpriseName: data.enterpriseName || "",
              description: data.description || "",
              problem: data.problem || "",
              solution: data.solution || "",
              targetMarket: data.targetMarket || "",
              businessModel: data.businessModel || "",
              team: data.team || "",
            });
            setLoading(false);
          },
          (err) => {
            console.error("Error loading application:", err);
            if (!cancelled) {
              setError("Failed to load the application.");
              setLoading(false);
            }
          }
        );

        const q = query(collection(db, "applicationEvents"), where("applicationId", "==", id));
        unsubEvents = onSnapshot(
          q,
          (snap) => {
            if (cancelled) return;
            const list = snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (toDateSafe(b.createdAt)?.getTime() || 0) - (toDateSafe(a.createdAt)?.getTime() || 0));
            setEvents(list);
          },
          (err) => console.error("Error loading application history:", err)
        );
      } catch (err) {
        console.error("Error opening application:", err);
        if (!cancelled) {
          setError("Failed to open the application.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsubApp();
      unsubEvents();
    };
  }, [id]);

  // Internal review notes: staff-only subscription (owners never subscribe).
  useEffect(() => {
    if (!isStaff || !id) return;
    return subscribeToReviewNotes(id, setNotes, (err) =>
      console.error("Error loading review notes:", err)
    );
  }, [id, isStaff]);

  // Staff: load Portfolio Manager + program options once onboarding becomes available.
  useEffect(() => {
    if (!needsOnboarding) return;
    let cancelled = false;
    const loadOptions = async () => {
      try {
        const pmSnap = await getDocs(query(collection(db, "users"), where("role", "==", "Portfolio Manager")));
        if (!cancelled) {
          setPmList(
            pmSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((u) => u.status === "approved")
              .sort((a, b) => `${a.name || ""} ${a.lastname || ""}`.localeCompare(`${b.name || ""} ${b.lastname || ""}`))
          );
        }
        const pgSnap = await getDocs(collection(db, "programs"));
        if (!cancelled) {
          setProgramOptions(
            pgSnap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
          );
        }
      } catch (err) {
        console.error("Error loading onboarding options:", err);
      }
    };
    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [needsOnboarding]);

  // Linked startup name for the onboarding link.
  useEffect(() => {
    if (!app?.incubateeGroupId) {
      setLinkedGroupName("");
      return;
    }
    let cancelled = false;
    getDoc(doc(db, "groups", app.incubateeGroupId))
      .then((snap) => {
        if (!cancelled) setLinkedGroupName(snap.exists() ? snap.data().name || "Startup" : "Startup");
      })
      .catch((err) => console.error("Error loading linked startup:", err));
    return () => {
      cancelled = true;
    };
  }, [app?.incubateeGroupId]);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      await confirm.run();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.enterpriseName?.trim() || !form.description?.trim()) {
      setFormError("Enterprise name and business description are required to save a draft.");
      return;
    }
    setSaving(true);
    try {
      await updateDraftApplication(id, user.id, form);
      await writeAuditEntry({
        actorId: user.id,
        action: "application.draft_saved",
        targetType: "application",
        targetId: id,
        detail: app.status,
      });
      toast("Draft saved.");
    } catch (err) {
      console.error("Error saving draft:", err);
      setFormError(err.message || "Failed to save the draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setConfirm({
      title: "Submit application?",
      description: "This sends the application for screening. You cannot edit after submitting.",
      confirmLabel: "Submit",
      run: async () => {
        setFormError("");
        setSaving(true);
        try {
          await updateDraftApplication(id, user.id, form);
          await submitApplication(id, user.id);
          toast("Application submitted for screening.");
        } catch (err) {
          console.error("Error submitting application:", err);
          setFormError(err.message || "Failed to submit the application.");
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleMove = async (toStatus) => {
    if (!canTransition(APPLICATION_TRANSITIONS, app.status, toStatus)) return;
    const needsConfirm = [APPLICATION_STATUS.ACCEPTED, APPLICATION_STATUS.REJECTED].includes(toStatus);
    const run = async () => {
      setFormError("");
      setActing(true);
      try {
        await moveApplication(id, user.id, toStatus, moveNote.trim());
        setMoveNote("");
        toast(`Application moved to ${toStatus}.`);
      } catch (err) {
        console.error("Error moving application:", err);
        setFormError(err.message || "Failed to update the application.");
      } finally {
        setActing(false);
      }
    };
    if (needsConfirm) {
      setConfirm({
        title: `Record decision "${toStatus}"?`,
        description: "This is written to the application history.",
        confirmLabel: toStatus,
        danger: toStatus === APPLICATION_STATUS.REJECTED,
        run,
      });
    } else {
      run();
    }
  };

  const handleNoteSave = async (e) => {
    e.preventDefault();
    setNoteError("");
    if (!noteFindings.trim()) {
      setNoteError("Findings are required.");
      return;
    }
    setNoteSaving(true);
    try {
      if (editingNoteId) {
        await updateReviewNote(editingNoteId, user.id, {
          kind: noteKind,
          findings: noteFindings,
          recommendation: noteRecommendation,
        });
      } else {
        await createReviewNote(id, user.id, {
          kind: noteKind,
          findings: noteFindings,
          recommendation: noteRecommendation,
        });
      }
      setNoteFindings("");
      setNoteRecommendation("");
      setEditingNoteId(null);
    } catch (err) {
      console.error("Error saving review note:", err);
      setNoteError(err.message || "Failed to save the note.");
    } finally {
      setNoteSaving(false);
    }
  };

  const handleNoteDelete = async (noteId) => {
    setConfirm({
      title: "Delete this internal note?",
      description: "This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
      run: async () => {
        try {
          await deleteReviewNote(noteId, user.id);
        } catch (err) {
          console.error("Error deleting review note:", err);
          setNoteError(err.message || "Failed to delete the note.");
        }
      },
    });
  };

  const handleOnboard = async (e) => {
    e.preventDefault();
    setObError("");
    if (!pmId) {
      setObError("Select a Portfolio Manager.");
      return;
    }
    if (!obStartDate) {
      setObError("Incubation start date is required.");
      return;
    }
    setConfirm({
      title: "Onboard as incubatee startup?",
      description: "The application stays Accepted; a linked startup is created with history preserved.",
      confirmLabel: "Onboard",
      run: async () => {
        setObSaving(true);
        try {
          const manager = pmList.find((m) => m.id === pmId);
          await onboardApplication(id, user.id, {
            portfolioManager: manager,
            programId: obProgramId,
            startDate: obStartDate,
            expectedEndDate: obEndDate,
            objectives: obObjectives,
          });
          toast("Startup onboarded.");
        } catch (err) {
          console.error("Error onboarding application:", err);
          setObError(err.message || "Failed to onboard.");
        } finally {
          setObSaving(false);
        }
      },
    });
  };

  return (
    <AppShell role={role} userName={userName}>
      {loading ? (
        <PageSkeleton rows={6} />
      ) : error ? (
        <ErrorState message={error} />
      ) : accessDenied ? (
        <AccessRestricted
          message="This application belongs to another applicant. If you need access, ask your TBI administrator."
          backTo="/applications"
          backLabel="Back to applications"
        />
      ) : (
        <>
          <PageHeader
            backTo="/applications"
            backLabel="Applications"
            title={app.enterpriseName || "Untitled application"}
            description={`Application ${app.id.slice(0, 8)} · Submitted ${app.submittedAt ? formatDateTimeSafe(toDateSafe(app.submittedAt)) : "as draft"}`}
            actions={<StatusBadge status={app.status} />}
          />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <section className="lg:col-span-2 bg-white border border-line rounded p-6">
              {app.status === APPLICATION_STATUS.RETURNED && isOwner && (
                <p className="mb-4 text-sm bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded">
                  Returned for revision. Correct the details below and resubmit — stay on this same application.
                </p>
              )}

              <form onSubmit={handleSaveDraft} className="mt-4 flex flex-col gap-4">
                {FIELD_DEFS.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium mb-1" htmlFor={field.key}>
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        id={field.key}
                        value={form[field.key] || ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        disabled={!canEdit}
                        rows="3"
                        className="w-full p-2 border rounded-sm text-sm disabled:bg-gray-100"
                      />
                    ) : (
                      <input
                        id={field.key}
                        type="text"
                        value={form[field.key] || ""}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        disabled={!canEdit}
                        className="w-full p-2 border rounded-sm text-sm disabled:bg-gray-100"
                      />
                    )}
                  </div>
                ))}

                {formError && <p className="text-red-500 text-sm">{formError}</p>}

                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-gray-200 rounded-sm text-sm hover:bg-gray-300 disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save Draft"}
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={saving}
                      className="px-4 py-2 bg-accent text-white rounded-sm text-sm hover:bg-opacity-80 disabled:opacity-60"
                    >
                      Review &amp; Submit
                    </button>
                  </div>
                )}
              </form>

              {(isOwner || isStaff) && (
                <div className="mt-6 pt-5 border-t border-line">
                  <DocumentsPanel
                    scope="application"
                    scopeId={id}
                    owner={{ id: user.id, name: user.name, lastname: user.lastname, email: user.email }}
                    canUpload={isOwner}
                    canVerify={isStaff}
                    canDelete={isManager}
                  />
                </div>
              )}
            </section>

            <aside className="flex flex-col gap-4">
              {app.incubateeGroupId ? (
                <section className="bg-white p-4 rounded-sm shadow">
                  <h2 className="font-bold text-sm mb-1">Linked startup</h2>
                  <p className="text-xs text-gray-600">
                    Onboarded{app.incubateeStatus ? ` (${app.incubateeStatus})` : ""}.
                  </p>
                  <Link
                    to={groupPathForRole(role, app.incubateeGroupId)}
                    className="inline-block mt-2 text-sm text-accent hover:underline"
                  >
                    Open {linkedGroupName || "startup"} →
                  </Link>
                </section>
              ) : (
                needsOnboarding && (
                  <section className="bg-white p-4 rounded-sm shadow">
                    <h2 className="font-bold text-sm mb-1">Onboarding</h2>
                    <p className="text-xs text-gray-500 mb-3">
                      Creates the incubatee startup from this application. History is preserved.
                    </p>
                    <form onSubmit={handleOnboard} className="flex flex-col gap-2">
                      <label className="text-xs font-medium" htmlFor="obPm">
                        Portfolio Manager <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="obPm"
                        value={pmId}
                        onChange={(e) => setPmId(e.target.value)}
                        className="p-2 border rounded-sm text-sm"
                      >
                        <option value="">Select manager</option>
                        {pmList.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.lastname}
                          </option>
                        ))}
                      </select>
                      <label className="text-xs font-medium" htmlFor="obProgram">
                        Program / cohort (optional)
                      </label>
                      <select
                        id="obProgram"
                        value={obProgramId}
                        onChange={(e) => setObProgramId(e.target.value)}
                        className="p-2 border rounded-sm text-sm"
                      >
                        <option value="">None</option>
                        {programOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-medium" htmlFor="obStart">
                            Start date <span className="text-red-500">*</span>
                          </label>
                          <input
                            id="obStart"
                            type="date"
                            value={obStartDate}
                            onChange={(e) => setObStartDate(e.target.value)}
                            className="w-full p-2 border rounded-sm text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium" htmlFor="obEnd">
                            Expected end
                          </label>
                          <input
                            id="obEnd"
                            type="date"
                            value={obEndDate}
                            onChange={(e) => setObEndDate(e.target.value)}
                            className="w-full p-2 border rounded-sm text-sm"
                          />
                        </div>
                      </div>
                      <label className="text-xs font-medium" htmlFor="obObjectives">
                        Incubation objectives
                      </label>
                      <textarea
                        id="obObjectives"
                        value={obObjectives}
                        onChange={(e) => setObObjectives(e.target.value)}
                        rows="2"
                        className="p-2 border rounded-sm text-sm"
                        placeholder="What should this incubatee accomplish?"
                      />
                      {obError && <p className="text-red-500 text-xs">{obError}</p>}
                      <button
                        type="submit"
                        disabled={obSaving}
                        className="px-3 py-2 bg-accent text-white rounded-sm text-xs hover:bg-opacity-80 disabled:opacity-60"
                      >
                        {obSaving ? "Onboarding..." : "Onboard as Incubatee"}
                      </button>
                    </form>
                  </section>
                )
              )}

              {isStaff && nextStatuses.length > 0 && (
                <section className="bg-white p-4 rounded-sm shadow">
                  <h2 className="font-bold text-sm mb-2">Staff actions</h2>
                  <label className="block text-xs font-medium mb-1" htmlFor="moveNote">
                    Note (kept in history)
                  </label>
                  <textarea
                    id="moveNote"
                    value={moveNote}
                    onChange={(e) => setMoveNote(e.target.value)}
                    rows="2"
                    className="w-full p-2 border rounded-sm text-sm mb-2"
                    placeholder="Reason, conditions, next steps..."
                  />
                  <div className="flex flex-col gap-2">
                    {nextStatuses.map((to) => (
                      <button
                        key={to}
                        onClick={() => handleMove(to)}
                        disabled={acting}
                        className="px-3 py-2 bg-primary-color text-white rounded-sm text-xs hover:bg-opacity-80 disabled:opacity-60"
                      >
                        Move to {to}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {isStaff && (
              <section className="bg-white p-4 rounded-sm shadow">
                <h2 className="font-bold text-sm mb-1">Internal review notes</h2>
                <p className="text-xs text-gray-500 mb-2">
                  Staff-only deliberation. Never visible to the applicant.
                </p>
                <form onSubmit={handleNoteSave} className="flex flex-col gap-2 mb-3">
                  <select
                    value={noteKind}
                    onChange={(e) => setNoteKind(e.target.value)}
                    className="p-2 border rounded-sm text-xs"
                    aria-label="Note kind"
                  >
                    {REVIEW_KIND_LIST.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={noteFindings}
                    onChange={(e) => setNoteFindings(e.target.value)}
                    rows="2"
                    placeholder="Findings..."
                    className="p-2 border rounded-sm text-xs"
                  />
                  <input
                    type="text"
                    value={noteRecommendation}
                    onChange={(e) => setNoteRecommendation(e.target.value)}
                    placeholder="Recommendation (optional)"
                    className="p-2 border rounded-sm text-xs"
                  />
                  {noteError && <p className="text-red-500 text-xs">{noteError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={noteSaving}
                      className="px-3 py-2 bg-gray-800 text-white rounded-sm text-xs hover:bg-opacity-80 disabled:opacity-60"
                    >
                      {noteSaving ? "Saving..." : editingNoteId ? "Update Note" : "Add Note"}
                    </button>
                    {editingNoteId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(null);
                          setNoteFindings("");
                          setNoteRecommendation("");
                        }}
                        className="px-3 py-2 bg-gray-200 rounded-sm text-xs hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
                <ul className="flex flex-col gap-2">
                  {notes.length === 0 && <li className="text-xs text-gray-500">No internal notes yet.</li>}
                  {notes.map((n) => (
                    <li key={n.id} className="text-xs border-l-2 border-gray-300 pl-2">
                      <p className="font-medium">{n.kind}</p>
                      <p className="text-gray-700">{n.findings}</p>
                      {n.recommendation && <p className="text-gray-600">→ {n.recommendation}</p>}
                      <div className="flex gap-2 mt-1">
                        <button
                          onClick={() => {
                            setEditingNoteId(n.id);
                            setNoteKind(n.kind);
                            setNoteFindings(n.findings || "");
                            setNoteRecommendation(n.recommendation || "");
                          }}
                          className="text-accent hover:underline"
                        >
                          Edit
                        </button>
                        {isManager && (
                          <button onClick={() => handleNoteDelete(n.id)} className="text-red-600 hover:underline">
                            Delete
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
              )}

              <section className="bg-white p-4 rounded-sm shadow">
                <h2 className="font-bold text-sm mb-2">History</h2>
                {app.submittedAt && (
                  <p className="text-xs text-gray-600">Submitted: {formatDateTimeSafe(toDateSafe(app.submittedAt))}</p>
                )}
                {app.decidedAt && (
                  <p className="text-xs text-gray-600">
                    Decided ({app.decision}): {formatDateTimeSafe(toDateSafe(app.decidedAt))}
                  </p>
                )}
                {app.decisionNotes && <p className="text-xs text-gray-600 mt-1">Notes: {app.decisionNotes}</p>}
                <ul className="mt-3 flex flex-col gap-2">
                  {events.length === 0 && <li className="text-xs text-gray-500">No review events yet.</li>}
                  {events.map((ev) => (
                    <li key={ev.id} className="text-xs border-l-2 border-gray-200 pl-2">
                      <p className="font-medium">
                        {ev.from} → {ev.to}
                      </p>
                      {ev.note && <p className="text-gray-600">{ev.note}</p>}
                      <p className="text-gray-400">{formatDateTimeSafe(toDateSafe(ev.createdAt))}</p>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </>
      )}
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title || ""}
        description={confirm?.description || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        danger={confirm?.danger || false}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => !confirmBusy && setConfirm(null)}
      />
    </AppShell>
  );
}

export default ApplicationDetail;

