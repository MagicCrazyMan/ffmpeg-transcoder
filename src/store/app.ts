import { create } from "zustand";
import { getSystemParticulars, type SystemParticulars } from "../tauri/particulars";

/**
 * Theme color mode.
 */
export enum Theme {
  /**
   * Follows system theme.
   */
  Default = "0",
  /**
   * Uses dark theme and saves to local storage.
   */
  Light = "1",
  /**
   * Uses light theme and saves to local storage.
   */
  Dark = "2",
}

const THEME_LOCALSTORAGE_KEY = "theme";

/**
 * Gets theme on startup.
 *
 * Tries to get existing theme from local storage first,
 * if not existed, uses system theme.
 */
const getStartupTheme = () => {
  const value = localStorage.getItem(THEME_LOCALSTORAGE_KEY);
  let theme: Theme;
  switch (value) {
    case Theme.Light:
      theme = Theme.Light;
      break;
    case Theme.Dark:
      theme = Theme.Dark;
      break;
    default:
      theme = Theme.Default;
      break;
  }

  return theme;
};

/**
 * Updates acro design theme mode and saves to local storage
 * @param theme Theme
 */
const setArcoTheme = (theme: Theme) => {
  let exactTheme: Theme;
  if (theme === Theme.Default) {
    localStorage.removeItem(THEME_LOCALSTORAGE_KEY);
    exactTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? Theme.Dark
      : Theme.Light;
  } else {
    localStorage.setItem(THEME_LOCALSTORAGE_KEY, theme);
    exactTheme = theme;
  }

  if (exactTheme === Theme.Dark) {
    document.body.setAttribute("arco-theme", "dark");
    document.body.style.colorScheme = "dark";
  } else {
    document.body.removeAttribute("arco-theme");
    document.body.style.colorScheme = "light";
  }
};

export type AppState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;

  systemParticulars: null | SystemParticulars;
  updateSystemParticulars: () => Promise<void>;

  join: (...paths: string[]) => string;
};

/**
 * App store
 */
export const useAppStore = create<AppState>((set, get) => {
  const theme = getStartupTheme();
  setArcoTheme(theme);
  const setTheme = (theme: Theme) => {
    setArcoTheme(theme);
    set({ theme });
  };

  const systemParticulars = null as null | SystemParticulars;
  const updateSystemParticulars = async () => {
    set({ systemParticulars: await getSystemParticulars() });
  };

  const join = (...paths: string[]) => {
    const pathSeparator = get().systemParticulars?.path_separator ?? "/";
    return paths
      .flatMap((path) => path.split(pathSeparator))
      .filter((subject) => !!subject)
      .join(pathSeparator);
  };

  return {
    theme,
    setTheme,
    systemParticulars,
    updateSystemParticulars,
    join,
  };
});
