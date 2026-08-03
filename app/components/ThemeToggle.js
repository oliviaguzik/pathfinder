"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  return (
    <button
      className="ghost theme-toggle"
      onClick={toggle}
      aria-label="Toggle dark mode"
      style={{ visibility: theme ? "visible" : "hidden" }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
