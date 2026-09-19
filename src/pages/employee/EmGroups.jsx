import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db, auth } from "../../config/marian-config.js";
import { collection, doc, getDoc, query, where, onSnapshot } from "firebase/firestore";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import { EmptyState, PageSkeleton } from "../../components/ui/states.jsx";

function EmGroups() {
  const [groups, setGroups] = useState([]);
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Startups";
  }, []);

  useEffect(() => {
    let unsubscribe;
    let cancelled = false;

    const init = async () => {
      try {
        const current = auth.currentUser;
        if (!current) return;
        const userDoc = await getDoc(doc(db, "users", current.uid));
        if (!userDoc.exists() || cancelled) return;
        const userData = { id: userDoc.id, ...userDoc.data() };
        setRole(userData.role || "");
        setUserName(`${userData.name || ""} ${userData.lastname || ""}`.trim());
        setUserId(userData.id);

        const q =
          userData.role === "Portfolio Manager"
            ? query(collection(db, "groups"), where("portfolioManager.id", "==", userData.id))
            : collection(db, "groups");

        unsubscribe = onSnapshot(
          q,
          (querySnapshot) => {
            if (!cancelled) {
              setGroups(querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
              setLoading(false);
            }
          },
          () => !cancelled && setLoading(false)
        );
      } catch (error) {
        console.error("Error fetching user groups:", error);
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const filteredGroups = [...groups]
    .filter(
      (group) =>
        (group.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (group.description || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (a.archived && !b.archived) return 1;
      if (!a.archived && b.archived) return -1;
      return (a.name || "").localeCompare(b.name || "");
    });

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="Startups"
        description={role === "Portfolio Manager" ? "Startups assigned to you." : "All startups in the program."}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search startups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search startups"
          className="tbi-input max-w-64"
        />
      </div>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : filteredGroups.length === 0 ? (
        <EmptyState title="No startups found" description="Assigned startups will appear here." />
      ) : (
        <ul className="bg-white border border-line rounded divide-y divide-line">
          {filteredGroups.map((group) => (
            <li key={group.id} className={group.archived ? "opacity-60" : ""}>
              <Link
                to={`/employee/view-group/${group.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
              >
                <Avatar name={group.name} size="lg" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-slate-900 truncate">{group.name}</span>
                  <span className="block text-[13px] text-muted truncate">
                    {(group.members || []).length} members
                    {group.portfolioManager?.id !== userId && group.portfolioManager
                      ? ` · ${group.portfolioManager.name || ""} ${group.portfolioManager.lastname || ""}`.trimEnd()
                      : ""}
                    {group.archived ? " · Archived" : ""}
                  </span>
                </span>
                <StatusBadge status={group.archived ? "Archived" : group.incubateeStatus || "Active"} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

export default EmGroups;
