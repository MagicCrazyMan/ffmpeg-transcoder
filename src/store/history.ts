import { cloneDeep } from "lodash";
import { create } from "zustand";
import { HistoryTask } from "../libs/history";

export type HistoryState = {
  /**
   * Data that persist inside local storage.
   */
  storage: HistoryStorage;
  /**
   * Adds history tasks
   * @param tasks History tasks
   */
  addHistoryTasks: (...tasks: HistoryTask[]) => void;
  /**
   * Removes history task by id
   * @param id History task id
   */
  removeHistoryTasks: (...ids: string[]) => void;
};

type HistoryStorage = {
  /**
   * History tasks
   */
  tasks: HistoryTask[];
};

const HISTORIES_LOCALSTORAGE_KEY = "histories";

/**
 * Stores history storage into local storage
 * @param storage History storage
 */
const storeHistoriesStorage = (storage: HistoryStorage) => {
  localStorage.setItem(HISTORIES_LOCALSTORAGE_KEY, JSON.stringify(storage));
};

/**
 * Loads history storage from local storage
 * @returns History storage
 */
const loadHistoriesStorage = (): HistoryStorage => {
  const defaultStorage: HistoryStorage = {
    tasks: [],
  };

  const raw = localStorage.getItem(HISTORIES_LOCALSTORAGE_KEY);
  return raw ? { ...defaultStorage, ...JSON.parse(raw) } : defaultStorage;
};

export const useHistoryStore = create<HistoryState>((set, _get, api) => {
  /**
   * Stores histories into local storage when histories change
   */
  api.subscribe((state, prevState) => {
    if (state.storage !== prevState.storage) {
      storeHistoriesStorage(state.storage);
    }
  });

  return {
    storage: loadHistoriesStorage(),
    addHistoryTasks(...tasks: HistoryTask[]) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          tasks: [
            ...storage.tasks,
            ...tasks.map(({ creationTime, id, args }) => ({
              id,
              creationTime,
              args: cloneDeep(args),
            })),
          ],
        },
      }));
    },
    removeHistoryTasks(...id: string[]) {
      const idsSet = new Set(id);
      set(({ storage }) => ({
        storage: {
          ...storage,
          tasks: storage.tasks.filter((task) => !idsSet.has(task.id)),
        },
      }));
    },
  };
});
