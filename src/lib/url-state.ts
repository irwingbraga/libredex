"use client";

import { useSyncExternalStore } from "react";

// The query string is the app state. Writes go through navigate() so
// subscribers re-render synchronously, and back/forward fires popstate.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => null;

// null during prerender and hydration, then the live query string.
export function useLocationSearch(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function navigate(params: URLSearchParams, mode: "push" | "replace", state: Record<string, unknown> = {}) {
  const query = params.toString();
  const url = query ? `?${query}` : window.location.pathname;
  window.history[mode === "push" ? "pushState" : "replaceState"](state, "", url);
  listeners.forEach((listener) => listener());
}

// Theme lives on <html data-theme>, set before paint by the inline script in layout.
const themeListeners = new Set<() => void>();

export function useTheme(): [string | null, (theme: "light" | "dark") => void] {
  const theme = useSyncExternalStore(
    (listener) => {
      themeListeners.add(listener);
      return () => themeListeners.delete(listener);
    },
    () => document.documentElement.dataset.theme ?? "light",
    () => null,
  );
  const setTheme = (next: "light" | "dark") => {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    themeListeners.forEach((listener) => listener());
  };
  return [theme, setTheme];
}
