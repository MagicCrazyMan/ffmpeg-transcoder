import { assignIn, cloneDeep } from "lodash";
import { v4 } from "uuid";
import { create } from "zustand";
import { TaskParamsModifyingValue } from "../components/task";
import { TaskParamsCodecValue } from "../components/task/CodecModifier";
import { SearchDirectory, SearchFile } from "../tauri/fs";
import { usePresetStore } from "./preset";
import { ParamsSource } from "./task";

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
  /**
   * Root node of table list
   */
  root: SearchDirectoryNode | undefined;
  /**
   * A hash map maps absolute path, inputId and outputId of node to node instance itself,
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
   * A hash map maps inputId of search file node to an editable task params
   */
  inputParamsMap: Map<string, TaskParamsModifyingValue>;
  setInputParamsMap: (
    inputParamsMap:
      | Map<string, TaskParamsModifyingValue>
      | ((state: Map<string, TaskParamsModifyingValue>) => Map<string, TaskParamsModifyingValue>)
  ) => void;
  /**
   * A hash map maps outputId of search file node to an editable task params.
   *
   * If `path` of output params is falsy, `inputDir` + `relative` will be used as path.
   */
  outputParamsMap: Map<string, TaskParamsModifyingValue>;
  setOutputParamsMap: (
    outputParamsMap:
      | Map<string, TaskParamsModifyingValue>
      | ((state: Map<string, TaskParamsModifyingValue>) => Map<string, TaskParamsModifyingValue>)
  ) => void;
};

export type SearchEntryNode = SearchDirectoryNode | SearchFileNode;

export type SearchDirectoryNode = {
  type: "Directory";
  name: string;
  absolute: string;
  relative: string;
  children: SearchEntryNode[];
  path: string;
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

  const setExpandedRowKeys = (expendedRowKeys: string[]) => {
    set({ expendedRowKeys });
  };

  const setSelectedRowKeys = (selectedRowKeys: string[]) => {
    set({
      selectedRowKeys,
      selectedRowKeysSet: new Set(selectedRowKeys),
    });
  };

  const setInputParamsMap = (
    inputParamsMap:
      | Map<string, TaskParamsCodecValue>
      | ((state: Map<string, TaskParamsCodecValue>) => Map<string, TaskParamsCodecValue>)
  ) => {
    if (typeof inputParamsMap === "function") {
      set((state) => ({
        inputParamsMap: inputParamsMap(state.inputParamsMap),
      }));
    } else {
      set({ inputParamsMap });
    }
  };

  const setOutputParamsMap = (
    outputParamsMap:
      | Map<string, TaskParamsCodecValue>
      | ((state: Map<string, TaskParamsCodecValue>) => Map<string, TaskParamsCodecValue>)
  ) => {
    if (typeof outputParamsMap === "function") {
      set((state) => ({
        outputParamsMap: outputParamsMap(state.outputParamsMap),
      }));
    } else {
      set({ outputParamsMap });
    }
  };

  /**
   * Creates new tree for table when search directory, extension filters or regular filters change
   */
  api.subscribe((state, prevState) => {
    if (
      state.searchDirectory !== prevState.searchDirectory ||
      state.extensionFilters !== prevState.extensionFilters ||
      state.regularFilters !== prevState.regularFilters
    ) {
      if (state.searchDirectory) {
        const { root, nodeMap, expendedRowKeys } = createRoot(
          state.searchDirectory,
          state.extensionFilters,
          state.regularFilters
        );

        set({
          root,
          nodeMap,
          expendedRowKeys,
          selectedRowKeys: [],
          selectedRowKeysSet: new Set(),
          inputParamsMap: new Map(),
          outputParamsMap: new Map(),
        });
      } else {
        set({
          root: undefined,
          nodeMap: new Map(),
          expendedRowKeys: [],
          selectedRowKeys: [],
          selectedRowKeysSet: new Set(),
          inputParamsMap: new Map(),
          outputParamsMap: new Map(),
        });
      }
    }
  });

  /**
   * Cleans params only when search directory
   */
  api.subscribe((state, prevState) => {
    if (state.searchDirectory !== prevState.searchDirectory) {
      set({
        inputParamsMap: new Map(),
        outputParamsMap: new Map(),
      });
    }
  });

  /**
   * Updates task params when selected row keys change.
   * Creates new params if one never selected before,
   * but not deletes when unselecting.
   */
  api.subscribe((state, prevState) => {
    if (state.selectedRowKeys !== prevState.selectedRowKeys) {
      if (state.selectedRowKeys.length === 0) return;

      const { defaultDecode, defaultEncode } = usePresetStore.getState();
      const inputParamsMap = new Map(state.inputParamsMap);
      const outputParamsMap = new Map(state.outputParamsMap);

      state.selectedRowKeys.forEach((key) => {
        const node = state.nodeMap.get(key);
        if (!node || node.type !== "File") return;

        if (!state.inputParamsMap.has(node.inputId)) {
          inputParamsMap.set(node.inputId, {
            id: node.inputId,
            selection: defaultDecode ?? ParamsSource.Auto,
          });
        }

        if (!state.outputParamsMap.has(node.outputId)) {
          outputParamsMap.set(node.outputId, {
            id: node.outputId,
            selection: defaultEncode ?? ParamsSource.Auto,
          });
        }
      });

      set({ inputParamsMap, outputParamsMap });
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
    root: undefined,
    nodeMap: new Map(),
    expendedRowKeys: [],
    setExpandedRowKeys,
    selectedRowKeys: [],
    selectedRowKeysSet: new Set(),
    setSelectedRowKeys,
    inputParamsMap: new Map(),
    setInputParamsMap,
    outputParamsMap: new Map(),
    setOutputParamsMap,
  };
});

const createRoot = (
  searchDirectory: SearchDirectory,
  extensionFilters: SearchStoreState["extensionFilters"],
  regularFilters: SearchStoreState["regularFilters"]
) => {
  let root: SearchDirectoryNode | undefined = undefined;
  const nodeMap: Map<string, SearchEntryNode> = new Map();
  const expendedRowKeys: string[] = [];

  root = { ...searchDirectory, children: [], parent: null };

  const directories: [SearchDirectory, SearchDirectoryNode][] = [[searchDirectory, root]];
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
                included = new RegExp(regularFilter.value).test(child.name);
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
        const subdirectoryNode = { ...child, children: [], parent: directoryNode };
        expendedRowKeys.push(child.absolute);
        directories.push([child, subdirectoryNode]);

        directoryNode.children.push(subdirectoryNode);
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
      }
    }

    // if directory empty, clean upper directories
    {
      if (directoryNode.children.length === 0) {
        if (directoryNode.parent) {
          // recursively clean empty directories from current node to upper nodes
          let node: SearchDirectoryNode = directoryNode;
          while (node.parent) {
            node.parent.children = node.parent.children.filter((child) => child !== node);

            if (node.parent.children.length === 0) {
              node = node.parent;
            } else {
              break;
            }
          }
        } else {
          // reach root node, if root node has no children, remove undefined directly
          return { root, nodeMap, expendedRowKeys };
        }
      }
    }
  }

  return { root, nodeMap, expendedRowKeys };
};
