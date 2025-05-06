import { useEffect, useState } from "react";
import EmployeeSidebar from "../../components/sidebar/EmployeeSidebar.jsx";
import { db } from "../../config/marian-config.js";
import { collection, getDocs, query, where } from "firebase/firestore";

function EmDashboard() {
    const [totalGroups, setTotalGroups] = useState(0); // State for total groups
    const [groups, setGroups] = useState([]); 
    const [groupRequests, setGroupRequests] = useState({}); 
    const [groupProgress, setGroupProgress] = useState({}); 
    const [user, setUser] = useState(null); 

    useEffect(() => {
        document.title = "Employee | Dashboard"; 

        const fetchDashboardData = async () => {
            try {
                // Fetch the logged-in user from sessionStorage
                const storedUser = sessionStorage.getItem("currentUser");
                if (storedUser) {
                    const userData = JSON.parse(storedUser);
                    setUser(userData);

                    // Fetch groups assigned to the Portfolio Manager
                    let groupsQuery;
                    if (userData.role === "Portfolio Manager") {
                        groupsQuery = query(
                            collection(db, "groups"),
                            where("portfolioManager.id", "==", userData.id)
                        );
                    } else {
                        groupsQuery = collection(db, "groups"); // Fetch all groups for other roles
                    }

                    const groupsSnapshot = await getDocs(groupsQuery);
                    const groupsData = groupsSnapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));
                    setGroups(groupsData);
                    setTotalGroups(groupsData.length); // Set total number of assigned groups

                    // Fetch requests and count them per group
                    const requestsSnapshot = await getDocs(collection(db, "requests"));
                    const requestsData = requestsSnapshot.docs.map((doc) => doc.data());

                    const requestsCount = {};
                    groupsData.forEach((group) => {
                        requestsCount[group.id] = requestsData.filter(
                            (request) => request.groupId === group.id
                        ).length;
                    });
                    setGroupRequests(requestsCount); // Set the number of requests per group

                    // Fetch workplan and calculate progress for each group
                    const workplanSnapshot = await getDocs(collection(db, "workplan"));
                    const workplanData = workplanSnapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }));

                    const progressData = {};
                    groupsData.forEach((group) => {
                        const groupTasks = workplanData.filter(
                            (task) => task.groupId === group.id
                        );
                        const totalTasks = groupTasks.length;
                        const completedTasks = groupTasks.filter(
                            (task) => task.status === "Completed"
                        ).length;
                        const progress = totalTasks > 0
                            ? Math.round((completedTasks / totalTasks) * 100)
                            : 0;
                        progressData[group.id] = progress;
                    });
                    setGroupProgress(progressData); // Set progress percentage per group
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            }
        };

        fetchDashboardData();
    }, []);

    return (
        <div className="flex">
            <EmployeeSidebar />
            <div className="flex flex-col items-start justify-start h-screen w-full p-10 bg-gray-100 overflow-x-auto">
                <h1 className="text-4xl font-bold">Employee Dashboard</h1>
                <p className="text-md text-gray-600 mb-4">Summary of all StartUps and their progress</p>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4 w-full">
                    {/* Total Groups Card */}
                    <div className="p-6 bg-white shadow rounded-sm hover:shadow-lg transition-shadow duration-300">
                        <h2 className="text-lg font-medium text-gray-800 ">Total Number of Assigned StartUps</h2>
                        <p className="text-3xl font-bold text-blue-500 mt-4">{totalGroups}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    {/* Table of Groups with Number of Requests */}
                    <div className="bg-white p-4 rounded-sm shadow w-full hover:shadow-lg transition-shadow duration-300">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Number of Requests per StartUps</h2>
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th scope="col" className="px-4 py-2">StartUp Name</th>
                                        <th scope="col" className="px-4 py-2">Number of Requests</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups
                                        .sort((a, b) => (groupRequests[b.id] || 0) - (groupRequests[a.id] || 0))
                                        .map((group) => (
                                            <tr key={group.id} className="border-b last:border-b-0">
                                                <td className="px-4 py-2">{group.name}</td>
                                                <td className="px-4 py-2">{groupRequests[group.id] || 0}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table of Groups with Total Progress Completion */}
                    <div className="bg-white p-4 rounded-sm shadow w-full hover:shadow-lg transition-shadow duration-300">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Total Progress Completion per StartUps</h2>
                        <div className="max-h-64 overflow-y-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th scope="col" className="px-4 py-2">StartUp Name</th>
                                        <th scope="col" className="px-4 py-2">Total Progress (%)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groups
                                        .sort((a, b) => (groupProgress[b.id] || 0) - (groupProgress[a.id] || 0))
                                        .map((group) => (
                                            <tr key={group.id} className="border-b last:border-b-0">
                                                <td className="px-4 py-2">{group.name}</td>
                                                <td className="px-4 py-2">{groupProgress[group.id] || 0}%</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EmDashboard;