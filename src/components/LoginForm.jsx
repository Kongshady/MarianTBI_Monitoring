

function SignUp(){
    return(
        <div className="h-screen flex items-center justify-center ">
            <form className="p-6 rounded-lg shadow-md w-100 bg-emerald-100 flex flex-col gap-1.5" action="">
                <h1 className="font-bold text-center">MarianTBI Create Account</h1>
                <div className="flex gap-1.5">
                    <input type="text" name="name" placeholder="First Name" className="w-full p-2 border rounded"/>
                    <input type="text" name="name" placeholder="Last Name" className="w-full p-2 border rounded"/>
                </div>
                <input type="text" name="name" placeholder="Email Address" className="w-full p-2 border rounded"/>
                <input type="text" name="name" placeholder="Role" className="w-full p-2 border rounded"/>
                <input type="text" name="name" placeholder="(63+) Mobile Number" className="w-full p-2 border rounded"/>
                <input type="text" name="name" placeholder="Password" className="w-full p-2 border rounded"/>
                <input type="text" name="name" placeholder="Confirm Password" className="w-full p-2 border rounded"/>
                <button type="submit" className="bg-rose-400 p-2 pt-3 pb-3 cursor-pointer rounded text-white hover:bg-white hover:text-rose-400 hover:border-2 transition">Create Account</button>
            </form>
        </div>
    );
}

export default SignUp