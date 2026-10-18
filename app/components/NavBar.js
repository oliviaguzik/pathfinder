"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import ThemeToggle, { applyTheme } from "./ThemeToggle";
import Menu from "./Menu";
import Icon from "./Icon";
import { useAuth } from "../../lib/AuthProvider";
import { replayTour } from "../../lib/tourState";
import NotificationSettings from "./NotificationSettings";

const NAV_LINKS = [
  { href: "/", label: "Today", icon: "home" },
  { href: "/plan", label: "Plan", icon: "calendar" },
  { href: "/goals", label: "Goals", icon: "target" },
  { href: "/review", label: "Review", icon: "chart" },
];

function isActive(pathname, href) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function toggleTheme() {
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
}

// Wide screens: one top bar with the pages, theme and Sign out. Phones: the top
// bar keeps the logo and a ☰ menu (theme, Sign out), and the pages move to a
// tab bar along the bottom, one thumb-tap away.
export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <>
      <nav className="topnav">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 21V4" />
              <path d="M5 5h12l-2.8 3.2L17 11.5H5" />
            </svg>
          </span>
          <span className="brand-name">PathFinder</span>
        </a>
        <div className="row topnav-wide" style={{ gap: 4 }}>
          <div className="navlinks">
            {NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className={isActive(pathname, href) ? "active" : ""}>
                {label}
              </a>
            ))}
          </div>
          <button className="ghost icon-btn" onClick={() => setNotificationsOpen(true)} aria-label="Notifications" title="Notifications">
            <Icon name="bell" size={16} />
          </button>
          <button className="ghost icon-btn" onClick={replayTour} aria-label="Tour of this page" title="Tour of this page">
            <Icon name="help" size={16} />
          </button>
          <ThemeToggle />
          {user && (
            <button className="ghost" onClick={signOut} title={user.email}>
              Sign out
            </button>
          )}
        </div>
        <div className="topnav-phone">
          <Menu
            icon="menu"
            label="Menu"
            items={[
              { label: "Notifications", onClick: () => setNotificationsOpen(true) },
              { label: "Tour of this page", onClick: replayTour },
              { label: "Switch light / dark", onClick: toggleTheme },
              ...(user ? [{ label: "Sign out", onClick: signOut }] : []),
            ]}
          />
        </div>
      </nav>
      <NotificationSettings open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <nav className="tabbar" aria-label="Pages">
        {NAV_LINKS.map(({ href, label, icon }) => {
          const active = isActive(pathname, href);
          return (
            <a key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
    </>
  );
}
