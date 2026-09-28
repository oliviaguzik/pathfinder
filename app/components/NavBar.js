"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../../lib/AuthProvider";

const NAV_LINKS = [
  { href: "/", label: "Today" },
  { href: "/tasks", label: "Tasks" },
  { href: "/goals", label: "Goals" },
  { href: "/review", label: "Review" },
];

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <nav className="topnav">
      <a href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 21V4" />
            <path d="M5 5h12l-2.8 3.2L17 11.5H5" />
          </svg>
        </span>
        PathFinder
      </a>
      <div className="row" style={{ gap: 4 }}>
        <div className="navlinks">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} className={isActive(pathname, href) ? "active" : ""}>
              {label}
            </a>
          ))}
        </div>
        <ThemeToggle />
        {user && (
          <button className="ghost" onClick={signOut} title={user.email}>
            Sign out
          </button>
        )}
      </div>
    </nav>
  );
}
