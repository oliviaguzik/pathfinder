"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import ThemeToggle, { applyTheme } from "./ThemeToggle";
import Menu from "./Menu";
import Icon from "./Icon";
import BrandMark from "./BrandMark";
import { useAuth } from "../../lib/AuthProvider";
import { replayTour } from "../../lib/tourState";
import NotificationSettings from "./NotificationSettings";
import Link from "next/link";

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

// Wide screens: one top bar with the pages, theme and Sign out. Phones: no
// bar, just the app icon and the ☰ menu in a slim row above the page's big
// title, like the iPhone's own apps; once you scroll, a slim bar with the
// page name fades in. The pages
// move to a tab bar along the bottom, one thumb-tap away.
export default function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pageName = NAV_LINKS.find(({ href }) => isActive(pathname, href))?.label || "PathFinder";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 44);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav className={`topnav ${scrolled ? "scrolled" : ""}`}>
        <span className="topnav-title" aria-hidden="true">
          {pageName}
        </span>
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-name">PathFinder</span>
        </Link>
        <div className="row topnav-wide" style={{ gap: 4 }}>
          <div className="navlinks">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={isActive(pathname, href) ? "active" : ""}>
                {label}
              </Link>
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
            <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon name={icon} size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
