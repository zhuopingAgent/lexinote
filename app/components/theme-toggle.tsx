"use client";

import { useSyncExternalStore } from "react";

type ThemeName = "dark" | "paper";

const THEME_STORAGE_KEY = "lexinote-theme";
const THEME_CHANGE_EVENT = "lexinote-theme-change";
const THEMES: Array<{ label: string; value: ThemeName }> = [
  { label: "Classic", value: "dark" },
  { label: "Paper", value: "paper" },
];

function isThemeName(value: string | null | undefined): value is ThemeName {
  return value === "dark" || value === "paper";
}

function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
}

function getThemeSnapshot(): ThemeName {
  if (typeof document === "undefined") {
    return "dark";
  }

  const currentTheme = document.documentElement.dataset.theme;

  if (isThemeName(currentTheme)) {
    return currentTheme;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  return isThemeName(storedTheme) ? storedTheme : "dark";
}

function subscribeToThemeChange(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribeToThemeChange,
    getThemeSnapshot,
    () => "dark"
  );

  function selectTheme(nextTheme: ThemeName) {
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <div className="theme-toggle" role="group" aria-label="切换主题">
      {THEMES.map((item) => {
        const isActive = item.value === theme;

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={isActive}
            className={
              isActive
                ? "theme-toggle__option theme-toggle__option--active"
                : "theme-toggle__option"
            }
            onClick={() => selectTheme(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
