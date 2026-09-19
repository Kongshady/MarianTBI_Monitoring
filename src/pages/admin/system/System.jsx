import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../../../config/marian-config.js";
import AppShell from "../../../components/layout/AppShell.jsx";
import PageHeader, { SectionTitle } from "../../../components/ui/PageHeader.jsx";
import { ErrorState, PageSkeleton } from "../../../components/ui/states.jsx";
import { toast } from "../../../lib/toast.js";
import { getRegistrationOpen, setRegistrationOpen } from "../../../lib/system.js";
import { subscribeToAuditLog } from "../../../lib/audit.js";

// System surface (System Administrator only): configuration that controls
// the platform itself, plus a security snapshot. Business operations live
// elsewhere — this page intentionally offers none.
function System() {
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [registrationOpen, setRegistrationOpenState] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ pending: 0, disabled: 0, privileged: 0 });
  const [recentSensitive, setRecentSensitive] = useState([]);

  useEffect(() => {
    document.title = "System Settings";
    let unsubAudit = () => {};
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
        if (cancelled) return;
        setRole(userDoc.data().role || "");
        setUserName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
        setUserId(userDoc.id);

        const [open, usersSnap] = await Promise.all([
          getRegistrationOpen(),
          getDocs(collection(db, "users")),
        ]);
        if (cancelled) return;
        setRegistrationOpenState(open);
        const all = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setStats({
          pending: all.filter((u) => u.status === "pending").length,
          disabled: all.filter((u) => u.status === "disabled").length,
          privileged: all.filter((u) => ["TBI Manager", "System Administrator"].includes(u.role)).length,
        });

        unsubAudit = subscribeToAuditLog((list) => {
          if (cancelled) return;
          setRecentSensitive(
            list
              .filter((e) => /^(user|roles|settings)\./.test(e.action || ""))
              .slice(0, 10)
          );
          setLoading(false);
        });
      } catch (err) {
        console.error("Error loading system page:", err);
        if (!cancelled) {
          setError("Failed to load system settings.");
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      unsubAudit();
    };
  }, []);

  const handleToggleRegistration = async () => {
    setSaving(true);
    try {
      await setRegistrationOpen(userId, !registrationOpen);
      setRegistrationOpenState(!registrationOpen);
      toast(registrationOpen ? "Public registration closed." : "Public registration opened.");
    } catch (err) {
      console.error("Error updating registration setting:", err);
      toast("Failed to update the setting.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="System settings"
        description="Platform-level configuration. Business operations live in their own modules."
      />

      {loading ? (
        <PageSkeleton rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : (
        <>
          <section className="bg-white border border-line rounded p-5 mb-5">
            <SectionTitle hint="When closed, public signup forms refuse new registrations (server-enforced). Existing users are unaffected.">
              Public registration
            </SectionTitle>
            <div className="flex flex-wrap items-center gap-3">
              <span
                role="status"
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${
                  registrationOpen
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${registrationOpen ? "bg-emerald-600" : "bg-slate-400"}`}
                  aria-hidden="true"
                />
                {registrationOpen ? "Open" : "Closed"}
              </span>
              <button
                onClick={handleToggleRegistration}
                disabled={saving}
                className="px-4 py-2 bg-primary-color text-white rounded text-sm font-medium hover:bg-primary-deep transition disabled:opacity-60"
              >
                {saving ? "Saving..." : registrationOpen ? "Close registration" : "Open registration"}
              </button>
            </div>
          </section>

          <section className="bg-white border border-line rounded p-5 mb-5">
            <SectionTitle hint="Live counts from user records.">Security snapshot</SectionTitle>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border border-line rounded overflow-hidden">
              {[
                { label: "Pending approvals", value: stats.pending },
                { label: "Disabled accounts", value: stats.disabled },
                { label: "Managers + SysAdmins", value: stats.privileged },
              ].map((s) => (
                <div key={s.label} className="bg-white px-4 py-4">
                  <dt className="text-xs text-muted">{s.label}</dt>
                  <dd className="text-[28px] leading-8 font-semibold text-slate-900 tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="bg-white border border-line rounded p-5">
            <SectionTitle hint="Latest sensitive admin actions (user, role, settings changes). Full history lives in Audit Logs.">
              Recent sensitive changes
            </SectionTitle>
            {recentSensitive.length === 0 ? (
              <p className="text-sm text-muted">No sensitive changes recorded yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {recentSensitive.map((e) => (
                  <li key={e.id} className="py-2 text-sm">
                    <span className="font-medium text-slate-900">{e.action}</span>
                    <span className="block text-xs text-muted">
                      {e.detail || "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

export default System;
