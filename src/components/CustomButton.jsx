function CustomButton({ text, className }) {
    return (
        <button className={`p-2 pl-9 pr-9 rounded text-sm shadow-lg font-semibold tracking-wide ${className}`}>
            {text}
        </button>
    );
}

export default CustomButton