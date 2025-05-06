import { Link, useNavigate } from "react-router-dom";
import CustomButton from "../components/CustomButton.jsx";
import MarianTbiLogo from "../assets/images/MarianTbiLogo.png";
import { FiArrowLeft } from "react-icons/fi"; // Import back icon

function CreateAccPage() {
    const navigate = useNavigate();

    return (
        <div className="flex items-center justify-center h-screen relative bg-gradient-to-r from-blue-500 to-indigo-500">
            {/* Back Button */}
            <button
                onClick={() => navigate(-1)} // Navigate to the previous page
                className="absolute top-4 left-4 text-white hover:text-gray-200 transition"
            >
                <FiArrowLeft size={24} />
            </button>

            <div className="flex flex-col gap-6 p-8 bg-white rounded-lg shadow-lg w-1/3">
                <img
                    src={MarianTbiLogo}
                    alt="MarianTbiLogo"
                    className="w-24 mx-auto shadow-lg p-3 rounded-full"
                />
                <h1 className="text-center text-2xl font-bold text-gray-800">Create an Account</h1>
                <p className="text-center text-sm text-gray-600">
                    Choose your account type to get started with <span className="font-bold text-primary-color">MarianTrack</span>.
                </p>
                <div className="flex flex-col gap-4">
                    <Link to={"/employee-create-account"}>
                        <CustomButton
                            text={"For Employees"}
                            className={
                                "bg-primary-color text-white hover:bg-white hover:text-primary-color border border-primary-color transition-all w-full py-3 rounded-md font-semibold"
                            }
                        />
                    </Link>
                    <p className="text-center text-sm text-gray-500">or</p>
                    <Link to={"/incubatee-create-account"}>
                        <CustomButton
                            text={"For Incubatees"}
                            className={
                                "bg-secondary-color text-white hover:bg-white hover:text-secondary-color border border-secondary-color transition-all w-full py-3 rounded-md font-semibold"
                            }
                        />
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default CreateAccPage;