import { assignIn, cloneDeep } from "lodash";
import { v4 } from "uuid";
import { create } from "zustand";
import { SearchDirectory } from "../tauri/fs";

export type SearchStoreState = {
  /**
   * Input directory for searching
   */
  inputDir?: string;
  /**
   * Max depth should walk in during searching
   */
  maxDepth: number;
  /**
   * Sets max depth for searching.
   * @param maxDepth Max depth
   */
  setMaxDepth: (maxDepth: number) => void;
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
   * Search directory
   */
  searchDirectory?: SearchDirectory;
  /**
   * Sets search directory
   * @param searchDirectory Search directory
   */
  setSearchDirectory: (searchDirectory?: SearchDirectory) => void;
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

type SearchStorage = Pick<SearchStoreState, "extensionFilters" | "regularFilters" | "maxDepth">;

const DEFAULT_SEARCH_STORAGE: SearchStorage = {
  maxDepth: 5,
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
  const { maxDepth, extensionFilters, regularFilters } = loadSearchStorage();

  const setMaxDepth = (maxDepth: number) => {
    set({ maxDepth });
  };

  const setInputDirectory = (inputDir: string) => {
    set({ inputDir });
  };

  const setOutputDirectory = (outputDir: string) => {
    set({ outputDir });
  };

  const setSearchDirectory = (searchDirectory?: SearchDirectory) => {
    set({ searchDirectory });
  };

  const isFileLoading = false;
  const setFileLoading = (isFileLoading: boolean) => {
    set({ isFileLoading });
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
            blacklist: true,
            regex: false,
            directory: true,
            file: true,
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
      state.maxDepth !== prevState.maxDepth ||
      state.extensionFilters !== prevState.extensionFilters ||
      state.regularFilters !== prevState.regularFilters
    ) {
      storeSearchStorage({
        maxDepth: state.maxDepth,
        extensionFilters: state.extensionFilters,
        regularFilters: state.regularFilters,
      });
    }
  });

  return {
    maxDepth,
    setMaxDepth,
    setSearchDirectory,
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
