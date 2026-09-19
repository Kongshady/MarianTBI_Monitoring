// Initials avatar. One style for sidebars, headers, rosters and comments.
function initialsFor(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Avatar({ name, size = "md", className = "" }) {
  const sizes = {
    sm: "w-7 h-7 text-[11px]",
    md: "w-9 h-9 text-xs",
    lg: "w-11 h-11 text-sm",
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-primary-color text-white font-semibold shrink-0 ${sizes[size] || sizes.md} ${className}`}
      aria-hidden="true"
    >
      {initialsFor(name)}
    </span>
  );
}

export default Avatar;
