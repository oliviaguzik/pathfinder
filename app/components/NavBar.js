"use client";

import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../../lib/AuthProvider";

export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  return (
    <nav className="topnav">
      <a href="/" className="brand">PathFinder</a>
      <div className="row" style={{ gap: 4 }}>
        <div className="navlinks">
          <a href="/" className={pathname === "/" ? "active" : ""}>Tasks</a>
          <a href="/goals" className={pathname === "/goals" ? "active" : ""}>Goals</a>
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
