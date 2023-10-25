import { v4 } from "uuid";
import { create } from "zustand";
import { SearchDirectory } from "../libs/search";
import { ExtensionFilterState } from "../libs/search/extension_filter";
import { RegularFilter } from "../libs/search/regular_filter";
import { SearchDirectoryNode, SearchEntryNode, SearchFileNode } from "../libs/search/table_tree";
import { TaskArgsSource } from "../libs/task";
import { ModifyingTaskArgsItem } from "../libs/task/modifying";
import { searchDirectory } from "../tauri/fs";
import { usePresetStore } from "./preset";

export type SearchStoreState = {
  /**
   * Data that persist inside local storage.
   */
  storage: SearchStorage;
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
  search?: SearchDirectory;
  /**
   * Is file loading
   */
  isSearching: boolean;
  /**
   * Sets extension filters state
   */
  setExtensionFilterState: (state: ExtensionFilterState) => void;
  /**
   * Sets extension filters extension list
   */
  setExtensionList: (extensions: string[]) => void;
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
  selectedRows: SearchFileNode[];
  selectedRowKeysSet: Set<string>;
  setSelectedRows: (selectedRowKeys: string[], selectedRows: SearchFileNode[]) => void;
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
   * If `path` of output args is falsy, `outputDir` + `relative` will be used as path.
   */
  outputArgsMap: Map<string, ModifyingTaskArgsItem>;
  setOutputArgsMap: (
    outputArgsMap:
      | Map<string, ModifyingTaskArgsItem>
      | ((state: Map<string, ModifyingTaskArgsItem>) => Map<string, ModifyingTaskArgsItem>)
  ) => void;
};

type SearchStorage = {
  printRelativePath: boolean;
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
   * Max depth should walk in during searching
   */
  maxDepth: number;
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
  const defaultStorage: SearchStorage = {
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

  const raw = localStorage.getItem(SEARCH_LOCALSTORAGE_KEY);
  return raw ? { ...defaultStorage, ...JSON.parse(raw) } : defaultStorage;
};

export const useSearchStore = create<SearchStoreState>((set, _get, api) => {
  const storage = loadSearchStorage();

  /**
   * Searches entries via Tauri when input directory change
   */
  api.subscribe((state, prevState) => {
    if (
      state.inputDir !== prevState.inputDir ||
      state.storage.maxDepth !== prevState.storage.maxDepth
    ) {
      set({
        search: undefined,
        nodeMap: undefined,
        inputArgsMap: new Map(),
        outputArgsMap: new Map(),
        expendedRowKeys: [],
        selectedRows: [],
        selectedRowKeysSet: new Set(),
      });

      if (state.inputDir) {
        set({ isSearching: true });

        searchDirectory(state.inputDir, state.storage.maxDepth)
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
      state.storage.extensionFilters !== prevState.storage.extensionFilters ||
      state.storage.regularFilters !== prevState.storage.regularFilters
    ) {
      if (state.search) {
        const { filesCount, directoriesCount, root, nodeMap, expendedRowKeys } = createRoot(
          state.search,
          state.storage.extensionFilters,
          state.storage.regularFilters
        );

        set({
          root,
          filesCount,
          directoriesCount,
          nodeMap,
          // only expend keys when entries count smaller than or equals 100
          expendedRowKeys: filesCount + directoriesCount <= 100 ? expendedRowKeys : [],
        });
      }
    }
  });

  /**
   * Updates task args when selected row keys change.
   */
  api.subscribe((state, prevState) => {
    if (state.selectedRows === prevState.selectedRows) return;
    if (state.selectedRows.length === 0) return;

    const { defaultDecode, defaultEncode } = usePresetStore.getState();
    const inputArgsMap = new Map(state.inputArgsMap);
    const outputArgsMap = new Map(state.outputArgsMap);

    // creates for selected
    state.selectedRows.forEach((node) => {
      if (!state.inputArgsMap.has(node.absolute)) {
        inputArgsMap.set(node.absolute, {
          id: node.absolute,
          selection: defaultDecode ?? TaskArgsSource.Auto,
          path: state.inputDir ? state.inputDir + node.relative : undefined,
        });
      }

      if (!state.outputArgsMap.has(node.absolute)) {
        outputArgsMap.set(node.absolute, {
          id: node.absolute,
          selection: defaultEncode ?? TaskArgsSource.Auto,
          path: state.outputDir ? state.outputDir + node.relative : undefined,
        });
      }
    });

    set({
      inputArgsMap,
      outputArgsMap,
    });
  });

  /**
   * Replaces all output dir of existing output args
   */
  api.subscribe((state, prevState) => {
    if (state.outputDir === prevState.outputDir) return;

    const outputArgsMap = new Map(state.outputArgsMap);

    const entries = state.outputArgsMap.entries();
    for (let entry = entries.next(); !entry.done; entry = entries.next()) {
      const [id, value] = entry.value;

      let path: string | undefined;
      if (state.outputDir) {
        if (prevState.outputDir && value.path) {
          path = value.path.replace(prevState.outputDir, state.outputDir);
        } else {
          path = state.outputDir + state.nodeMap.get(value.id)!.relative;
        }
      } else {
        path = undefined;
      }

      outputArgsMap.set(id, {
        ...value,
        path,
      });
    }

    set({ outputArgsMap });
  });

  /**
   * Stores search storage when fields change
   */
  api.subscribe((state, prevState) => {
    if (state.storage !== prevState.storage) {
      storeSearchStorage(state.storage);
    }
  });

  return {
    storage,
    setPrintRelativePath(printRelativePath) {
      set(({ storage }) => ({ storage: { ...storage, printRelativePath } }));
    },
    setMaxDepth(maxDepth) {
      set(({ storage }) => ({ storage: { ...storage, maxDepth } }));
    },
    isSearching: false,
    setInputDirectory(inputDir) {
      set({ inputDir });
    },
    setOutputDirectory(outputDir) {
      set({ outputDir });
    },
    setExtensionFilterState(state) {
      set(({ storage }) => ({
        storage: { ...storage, extensionFilters: { ...storage.extensionFilters, state } },
      }));
    },
    setExtensionList(extensions) {
      const lowerAndDedup = Array.from(
        new Set(extensions.map((extension) => extension.toLocaleLowerCase()))
      );

      set(({ storage }) => ({
        storage: {
          ...storage,
          extensionFilters: { ...storage.extensionFilters, extensions: lowerAndDedup },
        },
      }));
    },
    toggleRegularFilter() {
      set(({ storage }) => ({
        storage: {
          ...storage,
          regularFilters: { ...storage.regularFilters, enabled: !storage.regularFilters.enabled },
        },
      }));
    },
    addRegularFilter(initialValue) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          regularFilters: {
            ...storage.regularFilters,
            filters: [
              ...storage.regularFilters.filters,
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
        },
      }));
    },
    removeRegularFilter(id) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          regularFilters: {
            ...storage.regularFilters,
            filters: storage.regularFilters.filters.filter((filter) => filter.id !== id),
          },
        },
      }));
    },
    updateRegularFilter(id, partial) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          regularFilters: {
            ...storage.regularFilters,
            filters: storage.regularFilters.filters.map((filter) => {
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
        },
      }));
    },
    root: undefined,
    filesCount: 0,
    directoriesCount: 0,
    nodeMap: new Map(),
    expendedRowKeys: [],
    setExpandedRowKeys(expendedRowKeys) {
      set({ expendedRowKeys });
    },
    selectedRows: [],
    selectedRowKeysSet: new Set(),
    setSelectedRows(selectedRowKeys, selectedRows) {
      set({ selectedRows, selectedRowKeysSet: new Set(selectedRowKeys) });
    },
    inputArgsMap: new Map(),
    setInputArgsMap(inputArgsMap) {
      if (typeof inputArgsMap === "function") {
        set((state) => ({
          inputArgsMap: inputArgsMap(state.inputArgsMap),
        }));
      } else {
        set({ inputArgsMap });
      }
    },
    outputArgsMap: new Map(),
    setOutputArgsMap(outputArgsMap) {
      if (typeof outputArgsMap === "function") {
        set((state) => ({
          outputArgsMap: outputArgsMap(state.outputArgsMap),
        }));
      } else {
        set({ outputArgsMap: outputArgsMap });
      }
    },
  };
});

const createRoot = (
  entry: SearchDirectory,
  extensionFilters: SearchStorage["extensionFilters"],
  regularFilters: SearchStorage["regularFilters"]
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
            if (!child.name) continue;

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
        const fileNode: SearchFileNode = {
          ...child,
          parent: directoryNode,
        };

        directoryNode.children.push(fileNode);
        nodeMap.set(fileNode.absolute, fileNode);

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
