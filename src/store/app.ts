import { DialogFilter } from "@tauri-apps/api/dialog";
import { cloneDeep } from "lodash";
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
 * File filters by media types
 */
export type OpenFileFilters = {
  videos: string[];
  audios: string[];
  images: string[];
  subtitles: string[];
  text: string[];
};

/**
 * App configuration
 */
export type Configuration = {
  /**
   * Current theme
   */
  theme: Theme;
  /**
   * File filters for open dialog
   */
  openFileFilters: OpenFileFilters;
  /**
   * File filters for save dialog
   */
  saveFileFilters: DialogFilter[];
};

const DEFAULT_CONFIGURATION: Configuration = {
  theme: Theme.FollowSystem,
  openFileFilters: {
    videos: [
      "webm",
      "mkv",
      "flv",
      "vob",
      "ogg",
      "ogv",
      "gif",
      "gifv",
      "mng",
      "avi",
      "mts",
      "m2ts",
      "ts",
      "mov",
      "qt",
      "wmv",
      "yuv",
      "rm",
      "rmvb",
      "viv",
      "asf",
      "amv",
      "mp4",
      "m4p",
      "m4v",
      "mpg",
      "mp2",
      "mpeg",
      "mpe",
      "mpv",
      "m2v",
      "m3v",
      "svi",
      "3gp",
      "3g2",
      "3gp2",
      "mxf",
      "roq",
      "nsv",
      "flv",
      "f4v",
      "f4p",
      "f4a",
      "f4b",
    ],
    audios: [
      "3gp",
      "aa",
      "aac",
      "aax",
      "act",
      "aiff",
      "alac",
      "amr",
      "ape",
      "au",
      "awb",
      "dss",
      "dvf",
      "flac",
      "gsm",
      "iklax",
      "ivs",
      "m4a",
      "m4b",
      "m4p",
      "mmf",
      "movpkg",
      "mp3",
      "mpc",
      "msv",
      "nmf",
      "ogg",
      "oga",
      "mogg",
      "opus",
      "ra",
      "rm",
      "raw",
      "rf64",
      "sln",
      "tta",
      "voc",
      "vox",
      "wav",
      "wma",
      "wv",
      "webm",
      "8svx",
      "cda",
    ],
    images: [
      "apng",
      "avif",
      "gif",
      "jpg",
      "jpeg",
      "jfif",
      "pjpeg",
      "pjp",
      "png",
      "svg",
      "webp",
      "bmp",
      "ico",
      "cur",
      "tif",
      "tiff",
    ],
    subtitles: [
      "aqt",
      "gsub",
      "jss",
      "sub",
      "ttxt",
      "pjs",
      "psb",
      "rt",
      "smi",
      "slt",
      "ssf",
      "srt",
      "ssa",
      "ass",
      "usf",
      "idx",
      "vtt",
    ],
    text: ["txt"],
  },
  saveFileFilters: [
    { name: "MPEG-4", extensions: ["mp4"] },
    { name: "WebM", extensions: ["webm"] },
    { name: "Matroska", extensions: ["mkv"] },
    { name: "AVI", extensions: ["avi"] },
    { name: "Windows Media Video", extensions: ["wmv"] },
    { name: "Real Media", extensions: ["rm"] },
    { name: "Real Media Variable Bitrate", extensions: ["rmvb"] },
    { name: "Ogg Video", extensions: ["ogg"] },
    { name: "WAV", extensions: ["wav"] },
    { name: "MPEG Layer III Audio", extensions: ["mp3"] },
    { name: "Free Lossless Audio Codec", extensions: ["flac"] },
    { name: "AIFF", extensions: ["aiff"] },
    { name: "ALAC", extensions: ["alac"] },
    { name: "Animated Portable Network Graphics", extensions: ["apng"] },
    { name: "AV1 Image File Format", extensions: ["avif"] },
    { name: "Graphics Interchange Format", extensions: ["gif"] },
    { name: "Joint Photographic Expert Group image", extensions: ["jpg", "jpeg"] },
    { name: "Portable Network Graphics", extensions: ["png"] },
    { name: "Scalable Vector Graphics", extensions: ["svg"] },
    { name: "Web Picture format", extensions: ["webp"] },
    { name: "Custom", extensions: ["*"] },
  ],
};

const LOCAL_CONFIGURATION_LOCALSTORAGE_KEY = "configuration";

/**
 * Loads configuration from local storage
 */
const loadLocalConfiguration = () => {
  const raw = localStorage.getItem(LOCAL_CONFIGURATION_LOCALSTORAGE_KEY);
  return {
    ...(raw ? JSON.parse(raw) : undefined),
  } as Partial<Configuration>;
};
/**
 * Stores configuration from local storage
 */
const storeLocalConfiguration = (configuration: Partial<Configuration>) => {
  localStorage.setItem(LOCAL_CONFIGURATION_LOCALSTORAGE_KEY, JSON.stringify(configuration));
};

/**
 * Formalizes {@link OpenFileFilters}s to {@link DialogFilter}s
 * @param fileFilters File filters
 * @returns Dialog filters
 */
const formalizeOpenDialogFilters = ({
  audios,
  images,
  videos,
  subtitles,
  text,
}: OpenFileFilters): DialogFilter[] => {
  return [
    {
      name: "Media Files",
      extensions: Array.from(new Set([...videos, ...audios, ...images, ...subtitles])),
    },
    { name: "Video Files", extensions: videos },
    { name: "Audio Files", extensions: audios },
    { name: "Image Files", extensions: images },
    { name: "Subtitle Files", extensions: subtitles },
    { name: "Plain Text Files", extensions: text },
    { name: "All Files", extensions: ["*"] },
  ];
};

export type AppState = {
  /**
   * App configuration,
   * merge default configuration and local configuration
   */
  configuration: Configuration;
  /**
   * App local configuration
   */
  localConfiguration: Partial<Configuration>;
  /**
   * Sets configuration
   * @param configuration Partial configuration
   */
  setLocalConfiguration: (configuration: Partial<Configuration>) => void;

  /**
   * File filters for open file dialog.
   *
   * This field synchronize from {@link Configuration.openFileFilters}.
   */
  openDialogFilters: DialogFilter[];
  /**
   * File filters for save file dialog.
   *
   * This field synchronize from {@link Configuration.saveFileFilters}.
   */
  saveDialogFilters: DialogFilter[];

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
export const useAppStore = create<AppState>((set, get, api) => {
  const localConfiguration = loadLocalConfiguration();
  const configuration = { ...cloneDeep(DEFAULT_CONFIGURATION), ...localConfiguration };
  setArcoTheme(configuration.theme);
  const setLocalConfiguration = (localConfiguration: Partial<Configuration>) => {
    // updates and stores local configuration
    set((state) => {
      const lc = { ...state.localConfiguration, ...localConfiguration };
      storeLocalConfiguration(lc);
      return { localConfiguration: lc };
    });
    // updates configuration
    set((state) => ({
      configuration: { ...state.configuration, ...localConfiguration },
    }));
  };

  api.subscribe((state, prevState) => {
    // updates acro if theme changed
    if (state.configuration.theme !== prevState.configuration.theme) {
      setArcoTheme(state.configuration.theme);
    }

    // updates open dialog filters if open file filters changed
    if (state.configuration.openFileFilters !== prevState.configuration.openFileFilters) {
      set({ openDialogFilters: formalizeOpenDialogFilters(state.configuration.openFileFilters) });
    }

    if (state.configuration.saveFileFilters !== prevState.configuration.saveFileFilters) {
      set({ saveDialogFilters: cloneDeep(state.configuration.saveFileFilters) });
    }
  });

  const openDialogFilters: DialogFilter[] = formalizeOpenDialogFilters(
    configuration.openFileFilters
  );
  const saveDialogFilters: DialogFilter[] = cloneDeep(configuration.saveFileFilters);

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
    localConfiguration,
    setLocalConfiguration,
    openDialogFilters,
    saveDialogFilters,
    systemParticulars,
    updateSystemParticulars,
    join,
  };
});
