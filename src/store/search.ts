import { assignIn, cloneDeep } from "lodash";
import { v4 } from "uuid";
import { create } from "zustand";
import { TargetFile } from "../tauri/fs";

export type SearchStoreState = {
  /**
   * Input directory for searching
   */
  inputDir?: string;
  /**
   * Sets input directory
   *
   * @param inputDir Input directory
   */
  setInputDirectory: (inputDir: string) => void;
  /**
   * Output directory for saving result files
   */
  outputDir?: string;
  /**
   * Sets output directory
   *
   * @param outputDir Output directory
   */
  setOutputDirectory: (outputDir: string) => void;
  /**
   * Target files found from input directory
   */
  files: TargetFile[];
  /**
   * Sets target files
   * @param files Target files
   */
  setFiles: (files: TargetFile[]) => void;
  /**
   * Is file loading
   */
  isFileLoading: boolean;
  /**
   * Sets is file loading
   * @param loading Is file loading
   */
  setFileLoading: (loading: boolean) => void;
  /**
   * Extension filters
   */
  extensionFilters: {
    /**
     * Extension filter status
     */
    state: ExtensionFilterState;
    /**
     * Extension list.
     * Extensions are all in lowercase.
     */
    extensions: string[];
  };
  /**
   * Sets extension filters state
   */
  setExtensionFilterState: (state: ExtensionFilterState) => void;
  /**
   * Sets extension filters extension list
   */
  setExtensionList: (extensions: string[]) => void;
  /**
   * Regular filters
   */
  regularFilters: {
    /**
     * Globally enable or disable regular filters
     */
    enabled: boolean;
    /**
     * Regular filters
     */
    filters: RegularFilter[];
  };
  /**
   * Toggles a regular filter enable or disable
   */
  toggleRegularFilter: () => void;
  /**
   * Adds a new regular filter
   *
   * @param initialValue Initial regular filter value, optional
   */
  addRegularFilter: (initialValue?: Partial<RegularFilter>) => void;
  /**
   * Removes a regular filter by id
   *
   * @param id Regular filter id
   */
  removeRegularFilter: (id: string) => void;
  /**
   * Updates a regular filter by id
   *
   * @param id Regular filter id
   * @param partial Partial regular filter values
   */
  updateRegularFilter: (id: string, partial: Partial<RegularFilter>) => void;
};

/**
 * Extension filter status
 */
export enum ExtensionFilterState {
  Disabled = 0,
  Whitelist = 1,
  Blacklist = 2,
}

/**
 * Regular filter
 */
export type RegularFilter = {
  /**
   * Regular filter id
   */
  id: string;
  /**
   * Regular filter value
   */
  value?: string;
  /**
   * Enabled
   */
  enabled: boolean;
  /**
   * Filters as blacklist
   */
  blacklist: boolean;
  /**
   * Uses as regex
   */
  regex: boolean;
  /**
   * Apply on directory name
   */
  directory: boolean;
  /**
   * Apply on file name
   */
  file: boolean;
};

type SearchStorage = Pick<SearchStoreState, "extensionFilters" | "regularFilters">;

const DEFAULT_SEARCH_STORAGE: SearchStorage = {
  extensionFilters: {
    state: ExtensionFilterState.Disabled,
    extensions: [],
  },
  regularFilters: {
    enabled: false,
    filters: [],
  },
};

const SEARCH_LOCALSTORAGE_KEY = "search";

/**
 * Stores search storage into local storage
 *
 * @param searchStorage Search storage
 */
const storeSearchStorage = (searchStorage: SearchStorage) => {
  localStorage.setItem(SEARCH_LOCALSTORAGE_KEY, JSON.stringify(searchStorage));
};

/**
 * Loads search storage from local storage
 * @return Search storage
 */
const loadSearchStorage = (): SearchStorage => {
  const raw = localStorage.getItem(SEARCH_LOCALSTORAGE_KEY);
  return raw
    ? assignIn(cloneDeep(DEFAULT_SEARCH_STORAGE), JSON.parse(raw))
    : cloneDeep(DEFAULT_SEARCH_STORAGE);
};

export const useSearchStore = create<SearchStoreState>((set, _get, api) => {
  const files: TargetFile[] = [];
  const setFiles = (files: TargetFile[]) => {
    set({ files });
  };

  const isFileLoading = false;
  const setFileLoading = (isFileLoading: boolean) => {
    set({ isFileLoading });
  };

  const { extensionFilters, regularFilters } = loadSearchStorage();

  const setInputDirectory = (inputDir: string) => {
    set({ inputDir });
  };

  const setOutputDirectory = (outputDir: string) => {
    set({ outputDir });
  };

  const setExtensionFilterState = (state: ExtensionFilterState) => {
    set((s) => ({
      extensionFilters: { ...s.extensionFilters, state },
    }));
  };

  const setExtensionList = (extensions: string[]) => {
    const lowerAndDedup = Array.from(
      new Set(extensions.map((extension) => extension.toLocaleLowerCase()))
    );

    set((state) => ({
      extensionFilters: { ...state.extensionFilters, extensions: lowerAndDedup },
    }));
  };

  const toggleRegularFilter = () => {
    set((state) => ({
      regularFilters: {
        ...state.regularFilters,
        enabled: !state.regularFilters.enabled,
      },
    }));
  };

  const addRegularFilter = (initialValue?: Partial<RegularFilter>) => {
    set((state) => ({
      regularFilters: {
        ...state.regularFilters,
        filters: [
          ...state.regularFilters.filters,
          {
            enabled: true,
            blacklist: false,
            regex: false,
            directory: false,
            file: false,
            ...initialValue,
            id: v4(),
          },
        ],
      },
    }));
  };

  const removeRegularFilter = (id: string) => {
    set((state) => ({
      regularFilters: {
        ...state.regularFilters,
        filters: state.regularFilters.filters.filter((filter) => filter.id !== id),
      },
    }));
  };

  const updateRegularFilter = (id: string, partial: Partial<RegularFilter>) => {
    set((state) => ({
      regularFilters: {
        ...state.regularFilters,
        filters: state.regularFilters.filters.map((filter) => {
          if (filter.id === id) {
            return {
              ...filter,
              ...partial,
            };
          } else {
            return filter;
          }
        }),
      },
    }));
  };

  /**
   * Stores search storage when fields change
   */
  api.subscribe((state, prevState) => {
    if (
      state.extensionFilters !== prevState.extensionFilters ||
      state.regularFilters !== prevState.regularFilters
    ) {
      storeSearchStorage({
        extensionFilters: state.extensionFilters,
        regularFilters: state.regularFilters,
      });
    }
  });

  return {
    files,
    setFiles,
    isFileLoading,
    setFileLoading,
    setInputDirectory,
    setOutputDirectory,
    extensionFilters,
    setExtensionFilterState,
    setExtensionList,
    regularFilters,
    toggleRegularFilter,
    addRegularFilter,
    removeRegularFilter,
    updateRegularFilter,
  };
});
