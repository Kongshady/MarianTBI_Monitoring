import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../../components/layout/AppShell.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Avatar from "../../components/ui/Avatar.jsx";
import { EmptyState, PageSkeleton } from "../../components/ui/states.jsx";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/marian-config.js";
import { IoArchiveOutline } from "react-icons/io5"; // Import the unarchive icon

function AdArchives() {
  const [archivedGroups, setArchivedGroups] = useState([]);
  const [filteredGroups, setFilteredGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [notice, setNotice] = useState(null);
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Admin | Archives"; // Set the page title

    const fetchArchivedGroups = async () => {
      try {
        const current = auth.currentUser;
        if (current) {
          const meDoc = await getDoc(doc(db, "users", current.uid));
          if (meDoc.exists()) {
            setRole(meDoc.data().role || "");
            setUserName(`${meDoc.data().name || ""} ${meDoc.data().lastname || ""}`.trim());
          }
        }
        const q = query(collection(db, "groups"), where("archived", "==", true));
        const querySnapshot = await getDocs(q);
        const archivedGroupsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setArchivedGroups(archivedGroupsData);
        setFilteredGroups(archivedGroupsData);
      } catch (error) {
        console.error("Error fetching archived groups:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArchivedGroups();
  }, []);

  const handleUnarchiveGroup = async (groupId) => {
    setNotice(null);
    try {
      await updateDoc(doc(db, "groups", groupId), { archived: false });
      setArchivedGroups(archivedGroups.filter(group => group.id !== groupId));
      setNotice({ tone: "success", text: "Startup restored from archives." });
    } catch (error) {
      console.error("Error unarchiving group:", error);
      setNotice({ tone: "error", text: "Could not restore this startup. Please try again." });
    }
  };

  const filterGroups = useCallback(() => {
    let filtered = archivedGroups;

    if (searchTerm) {
      filtered = filtered.filter(group =>
        group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchTerm.toLowerCase()) // Include description in the search
      );
    }

    if (selectedYear) {
      filtered = filtered.filter(group => {
        const createdAt = group.createdAt?.toDate();
        return createdAt && createdAt.getFullYear().toString() === selectedYear;
      });
    }

    setFilteredGroups(filtered);
  }, [searchTerm, selectedYear, archivedGroups]);

  useEffect(() => {
    filterGroups();
  }, [filterGroups]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleYearChange = (e) => {
    setSelectedYear(e.target.value);
  };

  const getYears = () => {
    const years = new Set();
    archivedGroups.forEach(group => {
      const createdAt = group.createdAt?.toDate();
      if (createdAt) {
        years.add(createdAt.getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  };

  return (
    <AppShell role={role} userName={userName}>
      <PageHeader
        backTo="/admin-groups"
        backLabel="Startups"
        title="Archives"
        description="Retired startups. Restoring returns them to the active list; history is preserved."
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={selectedYear}
          onChange={handleYearChange}
          className="tbi-input max-w-40"
          aria-label="Filter by year"
        >
          <option value="">All years</option>
          {getYears().map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
        <input
          type="search"
          value={searchTerm}
          onChange={handleSearchChange}
          placeholder="Search startups"
          aria-label="Search archived startups"
          className="tbi-input max-w-64"
        />
      </div>
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={`text-sm mb-4 p-3 rounded border ${notice.tone === "error" ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-800"}`}
        >
          {notice.text}
        </p>
      )}
      {loading ? (
        <PageSkeleton rows={4} />
      ) : filteredGroups.length === 0 ? (
        <EmptyState title="Archives are empty" description="Retired startups will appear here." />
      ) : (
        <ul className="bg-white border border-line rounded divide-y divide-line">
          {filteredGroups.map((group) => (
            <li key={group.id} className="p-4 flex items-center gap-4">
              <Avatar name={group.name} size="lg" />
              <Link to={`/admin/view-group/${group.id}`} className="flex-1 min-w-0">
                <span className="block text-[15px] font-medium text-slate-900 truncate">{group.name}</span>
                <span className="block text-[13px] text-muted truncate">{group.description}</span>
              </Link>
              <button
                onClick={() => handleUnarchiveGroup(group.id)}
                className="px-3 py-2 bg-white border border-line text-slate-700 rounded text-[13px] font-medium hover:bg-slate-50 transition inline-flex items-center gap-1.5"
                title="Restore startup"
              >
                <IoArchiveOutline aria-hidden="true" />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

export default AdArchives;