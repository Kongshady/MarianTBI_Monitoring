import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js"; // Import Firebase auth & Firestore
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import CustomButton from "../../components/CustomButton.jsx";

function EmployeeCreateAccount() {
    const [role, setRole] = useState(""); 
    const [name, setName] = useState("");
    const [lastname, setLastname] = useState("");
    const [email, setEmail] = useState("");
    const [mobile, setMobile] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = "Create Account as Employee"; // Set the page title
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!name || !lastname || !email || !mobile || !password || !confirmPassword || !role) {
            setError("All fields are required.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        try {
            // Firebase Authentication: Create User
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Store User in Firestore
            await setDoc(doc(db, "users", user.uid), {
                name,
                lastname,
                email,
                mobile,
                role,
                status: "pending", // Default status for approval
                timestamp: serverTimestamp()
            });

            alert("Account created successfully! Awaiting admin approval.");
            navigate("/waiting-for-approval"); // Redirect user to waiting page
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className="flex items-center justify-center h-svh">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-5 bg-white rounded-md shadow-xl max-w-lg">
                <h1 className="text-center text-lg font-bold pb-3">Create Account as Employee</h1>

                <div className="flex gap-2 ">
                    <input type="text" placeholder="Name" className="p-2 border rounded-sm text-sm w-full" required value={name} onChange={(e) => setName(e.target.value)} />
                    {/*  */}
                    <input type="text" placeholder="Lastname" className="p-2 border rounded-sm text-sm w-full" required value={lastname} onChange={(e) => setLastname(e.target.value)} />
                </div>

                <Dropdown setRole={setRole} role={role} className="border text-sm" />

                <input type="email" placeholder="Email" className="p-2 border text-sm" required value={email} onChange={(e) => setEmail(e.target.value)} />
                <input type="text" placeholder="Mobile Number" maxLength={11} className="p-2 border text-sm" required value={mobile} onChange={(e) => setMobile(e.target.value)} />
                <input type="password" placeholder="Password" className="p-2 border text-sm" required value={password} onChange={(e) => setPassword(e.target.value)} />
                <input type="password" placeholder="Confirm Password" className="p-2 border text-sm" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />

                {error && <p className="text-red-500 text-center">{error}</p>}

                <CustomButton text={"Create Account"} className={"bg-primary-color text-white hover:bg-white hover:text-primary-color transition-all"} />
            </form>
        </div>
    );
}

function Dropdown({ setRole, role, className }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const roles = [
        "TBI Manager",
        "TBI Assistant",
        "Portfolio Manager"
    ];

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className={`p-2 bg-white w-full text-left ${className} ${role ? "text-black" : "text-gray-400"}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                {role || "Choose Role"}
            </button>

            {isOpen && (
                <ul className="absolute left-0 mt-1 w-full bg-white shadow-md rounded-md z-10">
                    {roles.map((item, index) => (
                        <li
                            key={index}
                            className="px-4 py-2 hover:bg-gray-200 cursor-pointer transition"
                            onClick={() => {
                                setRole(item);
                                setIsOpen(false);
                            }}
                        >
                            {item}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default EmployeeCreateAccount;