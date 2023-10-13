import { create } from "zustand";
import { getSystemParticulars, type SystemParticulars } from "../tauri/particulars";

/**
 * Theme color mode.
 */
export enum Theme {
  /**
   * Follows system theme.
   */
  FollowSystem = "0",
  /**
   * Uses dark theme and saves to local storage.
   */
  Light = "1",
  /**
   * Uses light theme and saves to local storage.
   */
  Dark = "2",
}

/**
 * Updates acro design theme mode and saves to local storage
 * @param theme Theme
 */
const setArcoTheme = (theme: Theme) => {
  let exactTheme: Theme;
  if (theme === Theme.FollowSystem) {
    exactTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? Theme.Dark
      : Theme.Light;
  } else {
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

/**
 * App configuration
 */
export type Configuration = {
  /**
   * Current theme
   */
  theme: Theme;
};

const DEFAULT_CONFIGURATION: Configuration = {
  theme: Theme.FollowSystem,
};

const CONFIGURATION_LOCALSTORAGE_KEY = "configuration";

/**
 * Gets configuration from local storage
 */
const getConfiguration = () => {
  const raw = localStorage.getItem(CONFIGURATION_LOCALSTORAGE_KEY);
  if (raw) {
    return {
      ...DEFAULT_CONFIGURATION,
      ...(JSON.parse(raw) as Configuration),
    };
  } else {
    localStorage.setItem(CONFIGURATION_LOCALSTORAGE_KEY, JSON.stringify(DEFAULT_CONFIGURATION));
    return {
      ...DEFAULT_CONFIGURATION,
    };
  }
};

export type AppState = {
  /**
   * App configuration
   */
  configuration: Configuration;
  /**
   * Sets configuration
   * @param configuration Partial configuration
   */
  setConfiguration: (configuration: Partial<Configuration>) => void;

  /**
   * System particulars of current machine
   */
  systemParticulars: null | SystemParticulars;
  /**
   * Fetches and updates system particulars of current machine via Tauri
   */
  updateSystemParticulars: () => Promise<void>;

  /**
   * A convenient utility to join multiple strings into a path
   * using system based path separator.
   * @param paths Path components
   * @returns Joined path
   */
  join: (...paths: string[]) => string;
};

/**
 * App store
 */
export const useAppStore = create<AppState>((set, get) => {
  const configuration = getConfiguration();
  setArcoTheme(configuration.theme);
  const setConfiguration = (configuration: Partial<Configuration>) => {
    if (configuration.theme) {
      setArcoTheme(configuration.theme);
    }
    set((state) => ({ configuration: { ...state.configuration, ...configuration } }));
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
    configuration,
    setConfiguration,
    systemParticulars,
    updateSystemParticulars,
    join,
  };
});
