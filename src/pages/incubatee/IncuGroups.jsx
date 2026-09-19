import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db, auth } from "../../config/marian-config.js";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import StatusBadge from "../../components/ui/StatusBadge.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import { EmptyState, PageSkeleton } from "../../components/ui/states.jsx";

function IncuGroups() {
  const [groups, setGroups] = useState([]);
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "My Startups";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchUserGroups = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && !cancelled) {
          setRole(userDoc.data().role || "");
          setUserName(`${userDoc.data().name || ""} ${userDoc.data().lastname || ""}`.trim());
        }
        const querySnapshot = await getDocs(collection(db, "groups"));
        if (cancelled) return;
        setGroups(
          querySnapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((group) => (group.members || []).some((member) => member.id === user.uid))
            .sort((a, b) => {
              if (a.archived && !b.archived) return 1;
              if (!a.archived && b.archived) return -1;
              return (a.name || "").localeCompare(b.name || "");
            })
        );
      } catch (error) {
        console.error("Error fetching user groups:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchUserGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        title="My startups"
        description="Startup teams you belong to. Open one for its workplan, milestones, and mentorship."
      />

      {loading ? (
        <PageSkeleton rows={4} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="No startup yet"
          description="Once staff place you in a startup team, it will appear here."
        />
      ) : (
        <ul className="bg-white border border-line rounded divide-y divide-line">
          {groups.map((group) => (
            <li key={group.id} className={group.archived ? "opacity-60" : ""}>
              <Link
                to={`/incubatee/view-group/${group.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition"
              >
                <Avatar name={group.name} size="lg" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-medium text-slate-900 truncate">{group.name}</span>
                  <span className="block text-[13px] text-muted truncate">
                    {(group.members || []).length} members
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

export default IncuGroups;
