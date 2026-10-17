"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

// Switches the app's theme and remembers it.
export function applyTheme(next) {
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      className="ghost theme-toggle"
      onClick={toggle}
      aria-label="Toggle dark mode"
      style={{ visibility: theme ? "visible" : "hidden" }}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
    </button>
  );
}
