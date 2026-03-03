import { useEffect, useRef, useState } from "react";

export function ProfileButton({
  email,
  displayName,
}: {
  email: string;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = displayName
    ? displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : null;

  return (
    <div className="profile-wrapper" ref={menuRef}>
      <button
        className="profile-btn"
        onClick={() => setOpen((prev) => !prev)}
        title={email}
      >
        {initials ?? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </button>
      {open && (
        <div className="profile-dropdown">
          {displayName && (
            <div className="profile-dropdown-name">{displayName}</div>
          )}
          <div className="profile-dropdown-email">{email}</div>
        </div>
      )}
    </div>
  );
}
