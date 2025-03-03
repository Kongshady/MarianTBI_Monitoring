import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../config/marian-config.js";
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import CustomButton from "../../components/CustomButton";
import MarianLogo from "../../assets/images/MarianLogoWtext.png";
import { FcGoogle } from "react-icons/fc";

function LoginAsEmployee() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const allowedRoles = ["TBI Manager", "Portfolio Manager"];

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Check user status and role in Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.status === "approved" && allowedRoles.includes(userData.role)) {
                    navigate("/employee-dashboard"); // Redirect to dashboard if approved and role is valid
                } else {
                    setError("Access denied. Your account is either pending approval or you do not have permission.");
                }
            } else {
                setError("User not found.");
            }
        } catch (error) {
            setError("Invalid credentials. Please try again.");
        }
    };

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            
            // Check user status and role in Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.status === "approved" && allowedRoles.includes(userData.role)) {
                    navigate("/employee-dashboard");
                } else {
                    setError("Access denied. Your account is either pending approval or you do not have permission.");
                }
            } else {
                setError("User not found.");
            }
        } catch (error) {
            setError("Google Sign-In failed. Try again.");
        }
    };

    return (
        <div className="flex flex-row-reverse h-screen">
            {/* Left Section - Login Form */}
            <div className="flex flex-col w-1/2 gap-6 items-center justify-center p-10">
                <img src={MarianLogo} alt="MarianTBI-logo" className="w-28 p-2" />

                {/* Login Form */}
                <form onSubmit={handleLogin} className="flex flex-col gap-3 w-full max-w-xs">
                    <h1 className="text-center font-bold text-xl">Login As Employee</h1>
                    {error && <p className="text-red-500 text-center">{error}</p>}
                    <input type="text" placeholder="Email" className="bg-gray-200 p-3 rounded" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    <input type="password" placeholder="Password" className="bg-gray-200 p-3 rounded" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <CustomButton text="Log In" className="bg-primary-color text-text-color hover:bg-white hover:text-primary-color transition-all" />
                </form>

                <TextDivider />

                <button onClick={handleGoogleLogin} className="flex items-center justify-center gap-2 bg-white p-3 border-2 rounded cursor-pointer transition hover:scale-105">
                    <FcGoogle className="w-6 h-6" />
                    <span className="text-gray-600">Sign in with Google</span>
                </button>

                {/* Forgot Password & Create Account Links */}
                <div className="flex justify-between w-full max-w-xs">
                    <Link to="/password-reset" className="text-blue-600 hover:underline">
                        Forgot Password?
                    </Link>
                    <Link to="/create-account" className="text-blue-600 hover:underline">
                        Create Account
                    </Link>
                </div>
            </div>

            {/* Right Section - Greetings */}
            <div className="relative w-1/2 flex flex-col justify-center gap-5 p-10 text-text-color bg-banner-img bg-cover bg-center bg-no-repeat">
                {/* Dark Overlay for Better Readability */}
                <div className="absolute inset-0 bg-black opacity-40"></div>

                <div className="relative z-10">
                    <h1 className="text-lg font-semibold">University of the Immaculate Conception</h1>

                    <div>
                        <h1 className="text-7xl font-bold">MARIAN</h1>
                        <h2 className="text-4xl font-bold">Technology</h2>
                        <h2 className="text-4xl font-bold">Business</h2>
                        <h2 className="text-4xl font-bold">Incubator</h2>
                    </div>

                    <p className="text-sm leading-relaxed">
                        Lorem ipsum dolor sit amet consectetur adipisicing elit. Itaque
                        dolores iure odio numquam aliquam recusandae fuga impedit, eius totam
                        perspiciatis modi placeat mollitia, officiis vel ut rerum debitis
                        exercitationem? Dolore.
                    </p>
                </div>
            </div>
        </div>
    );
}

/* Divider Component */
function TextDivider() {
    return (
        <div className="flex items-center w-full">
            <div className="flex-grow border-t border-gray-400"></div>
            <span className="mx-4 text-gray-600">Or</span>
            <div className="flex-grow border-t border-gray-400"></div>
        </div>
    );
}

export default LoginAsEmployee;