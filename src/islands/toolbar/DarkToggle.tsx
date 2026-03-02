import { useState, useCallback, useEffect } from "react";
import { setTheme } from "@lib/preferences";

function isDark() {
  return document.documentElement.classList.contains("dark");
}

/**
 * React version of the dark-mode toggle used in the Astro Navbar.
 * Toggles the `.dark` class on `<html>` and persists the choice via the
 * centralised preferences library.
 */
export function DarkToggle() {
  const [dark, setDark] = useState(isDark);

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const toggle = useCallback(() => {
    document.documentElement.classList.toggle("dark");
    const next = isDark();
    setTheme(next ? "dark" : "light");
    setDark(next);
  }, []);

  return (
    <button className="dark-toggle" onClick={toggle} title="Toggle dark mode">
      {dark ? "☀" : "☾"}
    </button>
  );
}
