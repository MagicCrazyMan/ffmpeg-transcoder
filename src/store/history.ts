import { cloneDeep } from "lodash";
import { create } from "zustand";
import { Task } from "./task";

export type HistoryState = {
  /**
   * History tasks
   */
  tasks: HistoryTask[];
  /**
   * Adds history tasks
   * @param tasks History tasks
   */
  addHistoryTasks: (...tasks: HistoryTask[]) => void;
  /**
   * Removes history task by id
   * @param id History task id
   */
  removeHistoryTask: (id: string) => void;
};

export type HistoryTask = Pick<Task, "id" | "params" | "creationTime">;

type HistoryStorage = Pick<HistoryState, "tasks">;

const HISTORIES_LOCALSTORAGE_KEY = "histories";

const DEFAULT_HISTORIES_STORAGE: HistoryStorage = {
  tasks: [],
};

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
  const raw = localStorage.getItem(HISTORIES_LOCALSTORAGE_KEY);
  return raw ? JSON.parse(raw) : cloneDeep(DEFAULT_HISTORIES_STORAGE);
};

export const useHistoryStore = create<HistoryState>((set, _get, api) => {
  const { tasks } = loadHistoriesStorage();

  const addHistoryTasks = (...tasks: HistoryTask[]) => {
    set((state) => ({
      tasks: [
        ...state.tasks,
        ...tasks.map(({ creationTime, id, params }) => ({
          id,
          creationTime,
          params: cloneDeep(params),
        })),
      ],
    }));
  };

  const removeHistoryTask = (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }));
  };

  /**
   * Stores histories into local storage when histories change
   */
  api.subscribe((state, prevState) => {
    if (state.tasks !== prevState.tasks) {
      storeHistoriesStorage({ tasks: state.tasks });
    }
  });

  return {
    tasks,
    addHistoryTasks,
    removeHistoryTask,
  };
});
