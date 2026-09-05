"use client";

// Theme preference: "system" follows the OS, "light" / "dark" pin it via
// data-theme on <html>. The inline script in layout.tsx applies a pinned value
// before first paint; this store keeps React in sync without effects.
import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";

const KEY = "pokegrade.theme";
const EVENT = "pokegrade:theme";

function read(): ThemePref {
  if (typeof document === "undefined") return "system";
  const t = document.documentElement.getAttribute("data-theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function setTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useTheme(): ThemePref {
  return useSyncExternalStore(subscribe, read, () => "system");
}
