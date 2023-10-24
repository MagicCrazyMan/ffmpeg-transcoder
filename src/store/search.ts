import { assignIn, cloneDeep } from "lodash";
import { v4 } from "uuid";
import { create } from "zustand";
import { TaskArgsSource } from "../libs/task";
import { ModifyingTaskArgsItem } from "../libs/task/modifying";
import { Search, SearchDirectory, SearchFile, searchDirectory } from "../tauri/fs";
import { usePresetStore } from "./preset";

export type SearchStoreState = {
  /**
   * Prints relative path in table
   */
  printRelativePath: boolean;
  /**
   * Sets should prints relative path or absolute path in table
   * @param enabled `true` for printing relative path; `false` for printing absolute path
   */
  setPrintRelativePath: (enabled: boolean) => void;
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
  setInputDirectory: (inputDir?: string) => void;
  /**
   * Output directory for saving result files
   */
  outputDir?: string;
  /**
   * Sets output directory
   *
   * @param outputDir Output directory
   */
  setOutputDirectory: (outputDir?: string) => void;
  /**
   * Search result
   */
  search?: Search;
  /**
   * Is file loading
   */
  isSearching: boolean;
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
  /**
   * Root node of table list
   */
  root: SearchDirectoryNode | undefined;
  /**
   * Files count
   */
  filesCount: number;
  /**
   * Directories count
   */
  directoriesCount: number;
  /**
   * A hash map maps absolute path, inputId and outputId of a **file** node to node instance itself,
   * intend for rapid node searching.
   */
  nodeMap: Map<string, SearchEntryNode>;
  /**
   * Expended row keys in table
   */
  expendedRowKeys: string[];
  setExpandedRowKeys: (expendedRowKeys: string[]) => void;
  /**
   * Selected row keys in table
   */
  selectedRowKeys: string[];
  selectedRowKeysSet: Set<string>;
  setSelectedRowKeys: (selectedRowKeys: string[]) => void;
  /**
   * A hash map maps inputId of search file node to an editable task args
   */
  inputArgsMap: Map<string, ModifyingTaskArgsItem>;
  setInputArgsMap: (
    inputArgsMap:
      | Map<string, ModifyingTaskArgsItem>
      | ((state: Map<string, ModifyingTaskArgsItem>) => Map<string, ModifyingTaskArgsItem>)
  ) => void;
  /**
   * A hash map maps outputId of search file node to an editable task args
   *
   * If `path` of output args is falsy, `inputDir` + `relative` will be used as path.
   */
  outputArgsMap: Map<string, ModifyingTaskArgsItem>;
  setOutputArgsMap: (
    outputArgsMap:
      | Map<string, ModifyingTaskArgsItem>
      | ((state: Map<string, ModifyingTaskArgsItem>) => Map<string, ModifyingTaskArgsItem>)
  ) => void;
};

export type SearchEntryNode = SearchDirectoryNode | SearchFileNode;

export type SearchDirectoryNode = Omit<SearchDirectory, "children"> & {
  children: SearchEntryNode[];
  parent: SearchDirectoryNode | null;
};

export type SearchFileNode = SearchFile & {
  parent: SearchDirectoryNode;
  inputId: string;
  outputId: string;
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

type SearchStorage = Pick<
  SearchStoreState,
  "printRelativePath" | "extensionFilters" | "regularFilters" | "maxDepth"
>;

const DEFAULT_SEARCH_STORAGE: SearchStorage = {
  printRelativePath: true,
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
  const { printRelativePath, maxDepth, extensionFilters, regularFilters } = loadSearchStorage();

  const setPrintRelativePath = (printRelativePath: boolean) => {
    set({ printRelativePath });
  };

  const setMaxDepth = (maxDepth: number) => {
    set({ maxDepth });
  };

  const setInputDirectory = (inputDir?: string) => {
    set({ inputDir });
  };

  const setOutputDirectory = (outputDir?: string) => {
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

  const setExpandedRowKeys = (expendedRowKeys: string[]) => {
    set({ expendedRowKeys });
  };

  const setSelectedRowKeys = (selectedRowKeys: string[]) => {
    set({
      selectedRowKeys,
      selectedRowKeysSet: new Set(selectedRowKeys),
    });
  };

  const setInputArgsMap = (
    inputArgsMap:
      | Map<string, ModifyingTaskArgsItem>
      | ((state: Map<string, ModifyingTaskArgsItem>) => Map<string, ModifyingTaskArgsItem>)
  ) => {
    if (typeof inputArgsMap === "function") {
      set((state) => ({
        inputArgsMap: inputArgsMap(state.inputArgsMap),
      }));
    } else {
      set({ inputArgsMap: inputArgsMap });
    }
  };

  const setOutputArgsMap = (
    outputArgsMap:
      | Map<string, ModifyingTaskArgsItem>
      | ((state: Map<string, ModifyingTaskArgsItem>) => Map<string, ModifyingTaskArgsItem>)
  ) => {
    if (typeof outputArgsMap === "function") {
      set((state) => ({
        outputArgsMap: outputArgsMap(state.outputArgsMap),
      }));
    } else {
      set({ outputArgsMap: outputArgsMap });
    }
  };

  /**
   * Searches entries via Tauri when input directory change
   */
  api.subscribe((state, prevState) => {
    if (state.inputDir !== prevState.inputDir || state.maxDepth !== prevState.maxDepth) {
      set({ search: undefined });

      if (state.inputDir) {
        set({ isSearching: true });
        searchDirectory(state.inputDir, state.maxDepth)
          .then((search) => {
            set({ search });
          })
          .finally(() => {
            set({ isSearching: false });
          });
      }
    }
  });

  /**
   * Creates new tree for table when search directory, extension filters or regular filters change
   */
  api.subscribe((state, prevState) => {
    if (
      state.search !== prevState.search ||
      state.extensionFilters !== prevState.extensionFilters ||
      state.regularFilters !== prevState.regularFilters
    ) {
      if (state.search) {
        const { filesCount, directoriesCount, root, nodeMap, expendedRowKeys } = createRoot(
          state.search.entry,
          state.extensionFilters,
          state.regularFilters
        );

        set({
          root,
          filesCount,
          directoriesCount,
          nodeMap,
          // only expend keys when entries count smaller than or equals 100
          expendedRowKeys: filesCount + directoriesCount <= 100 ? expendedRowKeys : [],
          selectedRowKeys: [],
          selectedRowKeysSet: new Set(),
          inputArgsMap: new Map(),
          outputArgsMap: new Map(),
        });
      } else {
        set({
          root: undefined,
          filesCount: 0,
          directoriesCount: 0,
          nodeMap: new Map(),
          expendedRowKeys: [],
          selectedRowKeys: [],
          selectedRowKeysSet: new Set(),
          inputArgsMap: new Map(),
          outputArgsMap: new Map(),
        });
      }
    }
  });

  /**
   * Cleans args only when search directory
   */
  api.subscribe((state, prevState) => {
    if (state.search !== prevState.search) {
      set({
        inputArgsMap: new Map(),
        outputArgsMap: new Map(),
      });
    }
  });

  /**
   * Updates task args when selected row keys change.
   * Creates new args if one never selected before,
   * but not deletes when unselecting.
   */
  api.subscribe((state, prevState) => {
    if (state.selectedRowKeys !== prevState.selectedRowKeys) {
      if (state.selectedRowKeys.length === 0) return;

      const { storage } = usePresetStore.getState();
      const inputArgsMap = new Map(state.inputArgsMap);
      const outputArgsMap = new Map(state.outputArgsMap);

      state.selectedRowKeys.forEach((key) => {
        const node = state.nodeMap.get(key);
        if (!node || node.type !== "File") return;

        if (!state.inputArgsMap.has(node.inputId)) {
          inputArgsMap.set(node.inputId, {
            id: node.inputId,
            selection: storage.defaultDecode ?? TaskArgsSource.Auto,
          });
        }

        if (!state.outputArgsMap.has(node.outputId)) {
          outputArgsMap.set(node.outputId, {
            id: node.outputId,
            selection: storage.defaultEncode ?? TaskArgsSource.Auto,
          });
        }
      });

      set({ inputArgsMap: inputArgsMap, outputArgsMap: outputArgsMap });
    }
  });

  /**
   * Stores search storage when fields change
   */
  api.subscribe((state, prevState) => {
    if (
      state.printRelativePath !== prevState.printRelativePath ||
      state.maxDepth !== prevState.maxDepth ||
      state.extensionFilters !== prevState.extensionFilters ||
      state.regularFilters !== prevState.regularFilters
    ) {
      storeSearchStorage({
        printRelativePath: state.printRelativePath,
        maxDepth: state.maxDepth,
        extensionFilters: state.extensionFilters,
        regularFilters: state.regularFilters,
      });
    }
  });

  return {
    printRelativePath,
    setPrintRelativePath,
    maxDepth,
    setMaxDepth,
    isSearching: false,
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
    root: undefined,
    filesCount: 0,
    directoriesCount: 0,
    nodeMap: new Map(),
    expendedRowKeys: [],
    setExpandedRowKeys,
    selectedRowKeys: [],
    selectedRowKeysSet: new Set(),
    setSelectedRowKeys,
    inputArgsMap: new Map(),
    setInputArgsMap,
    outputArgsMap: new Map(),
    setOutputArgsMap,
  };
});

const createRoot = (
  entry: SearchDirectory,
  extensionFilters: SearchStoreState["extensionFilters"],
  regularFilters: SearchStoreState["regularFilters"]
) => {
  let filesCount = 0;
  let directoriesCount = 0;
  const nodeMap: Map<string, SearchEntryNode> = new Map();
  const expendedRowKeys: string[] = [];

  const root: SearchDirectoryNode = { ...entry, children: [], parent: null };

  const directories: [SearchDirectory, SearchDirectoryNode][] = [[entry, root]];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const item = directories.pop();
    if (!item) break;

    const [directory, directoryNode] = item;

    for (const child of directory.children) {
      // apply filters
      let shouldDrop = false;
      {
        // apply regular filters
        if (regularFilters.enabled) {
          for (const regularFilter of regularFilters.filters) {
            if (shouldDrop) break;
            if (!regularFilter.value) continue;
            if (!regularFilter.enabled) continue;
            if (!regularFilter.file && child.type === "File") continue;
            if (!regularFilter.directory && child.type === "Directory") continue;

            let included: boolean;
            if (regularFilter.regex) {
              try {
                const regex = new RegExp(regularFilter.value);
                included = regex.test(child.name);
              } catch (err) {
                console.error(err);
                continue;
              }
            } else {
              included = child.name.includes(regularFilter.value);
            }
            shouldDrop = regularFilter.blacklist ? included : !included;
          }
        }

        // apply extension filters for files
        if (!shouldDrop && child.type === "File") {
          if (child.extension) {
            // for file having extension, filter them
            const included = extensionFilters.extensions.includes(child.extension);
            if (extensionFilters.state === ExtensionFilterState.Whitelist) {
              shouldDrop = !included;
            } else if (extensionFilters.state === ExtensionFilterState.Blacklist) {
              shouldDrop = included;
            }
          } else {
            // if file has no extension, drop only when extension filters enabled
            if (extensionFilters.state !== ExtensionFilterState.Disabled) {
              shouldDrop = true;
            }
          }
        }
      }

      if (shouldDrop) continue;

      if (child.type === "Directory") {
        const subdirectoryNode: SearchDirectoryNode = {
          ...child,
          children: [],
          parent: directoryNode,
        };
        expendedRowKeys.push(child.absolute);
        directories.push([child, subdirectoryNode]);

        directoryNode.children.push(subdirectoryNode);

        directoriesCount++;
      } else {
        const inputId = v4();
        const outputId = v4();
        const fileNode: SearchFileNode = {
          ...child,
          inputId,
          outputId,
          parent: directoryNode,
        };

        directoryNode.children.push(fileNode);
        nodeMap.set(fileNode.absolute, fileNode);
        nodeMap.set(inputId, fileNode);
        nodeMap.set(outputId, fileNode);

        filesCount++;
      }
    }

    // if directory empty, clean upper directories
    {
      if (directoryNode.children.length === 0) {
        if (directoryNode.parent) {
          // recursively clean empty directories from current node to upper nodes
          let node: SearchDirectoryNode = directoryNode;
          while (node.parent) {
            const removed = node.parent.children.filter((child) => child !== node);
            directoriesCount -= node.parent.children.length - removed.length;

            node.parent.children = removed;

            if (removed.length === 0) {
              node = node.parent;
            } else {
              break;
            }
          }
        } else {
          // reach root node, if root node has no children, remove undefined directly
          return { filesCount: 0, directoriesCount: 0, root, nodeMap, expendedRowKeys };
        }
      }
    }
  }

  return { filesCount, directoriesCount, root, nodeMap, expendedRowKeys };
};
