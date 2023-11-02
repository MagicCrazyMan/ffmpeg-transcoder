import { v4 } from "uuid";
import { create } from "zustand";
import { Task, TaskArgs, TaskData } from "../libs/task";
import { Idle, TaskState, TaskStateCode } from "../libs/task/state_machine";

export type TaskStoreState = {
  /**
   * Tasks list
   */
  tasks: Task[];
  /**
   * Adds a new task from specified task args
   * @param args Task args
   */
  addTasks: (...args: TaskArgs[]) => void;
  /**
   * Updates state of a task by id.
   * @param id Task id
   * @param partial Partial task.
   */
  updateTask: (id: string, partial: Partial<Task>) => void;
  /**
   * Starts or resumes a task by id.
   * @param id Task id
   */
  startTask: (id: string) => Promise<void>;
  /**
   * Pauses a task by id.
   * @param id Task id
   */
  pauseTask: (id: string) => Promise<void>;
  /**
   * Stops a task by id.
   * @param id Task id
   */
  stopTask: (id: string) => Promise<void>;
  /**
   * Finishes a task by id.
   *
   * Do not use this method,
   * only finish message from backend should finish a task.
   * @param id Task id
   */
  finishTask: (id: string) => Promise<void>;
  /**
   * Errors a task by id.
   *
   * Do not use this method,
   * only error message from backend should error a task.
   * @param id Task id
   * @param reason Error reason
   */
  errorTask: (id: string, reason: string) => Promise<void>;
  /**
   * Removes a task by id
   * @param id Task id
   */
  removeTask: (id: string) => void;
  /**
   * Resets a task.
   * Only a task in `Finished`, `Stopped` or `Errored` state could be reset
   * @param id Task id
   * @returns
   */
  resetTask: (id: string) => void;
  /**
   * Starts all tasks.
   */
  startAllTasks: () => Promise<void>;
  /**
   * Pauses all tasks.
   */
  pauseAllTasks: () => Promise<void>;
  /**
   * Stops all tasks.
   */
  stopAllTasks: () => Promise<void>;
  /**
   * Stops all removable tasks.
   */
  removeAllTasks: () => void;
  /**
   * Starts next queueing task
   */
  startNextQueueing: () => Promise<void>;
};

export const useTaskStore = create<TaskStoreState>((set, get) => {
  const getTask = (id: string) => get().tasks.find((task) => task.id === id);

  const toState = async (
    id: string | Task,
    action: "start" | "pause" | "stop" | "finish" | "error",
    errorReason = "unknown reason"
  ) => {
    const task = typeof id === "string" ? getTask(id) : id;
    if (!task || task.data.commanding) return;

    set(({ tasks }) => ({
      tasks: tasks.map((t) => {
        if (t.id === task.id) {
          return {
            ...t,
            data: {
              ...t.data,
              commanding: true,
            },
          };
        } else {
          return t;
        }
      }),
    }));

    let next: { nextState: TaskState; nextData: Partial<TaskData> };
    switch (action) {
      case "start": {
        next = await task.state.start(task);
        break;
      }
      case "pause": {
        next = await task.state.pause(task);
        break;
      }
      case "stop": {
        next = await task.state.stop(task);
        break;
      }
      case "finish": {
        next = await task.state.finish(task);
        break;
      }
      case "error": {
        next = await task.state.error(task, errorReason);
        break;
      }
    }

    set(({ tasks }) => ({
      tasks: tasks.map((t) => {
        if (t.id === task.id) {
          return {
            ...t,
            data: {
              ...t.data,
              ...next.nextData,
              commanding: false,
            },
            state: next.nextState,
          };
        } else {
          return t;
        }
      }),
    }));
  };

  const startNextQueueing = async () => {
    const nextTask = get().tasks.find((task) => task.state.code === TaskStateCode.Queueing);
    if (nextTask) await toState(nextTask.id, "start");
  };

  return {
    tasks: [],
    addTasks(...args: TaskArgs[]) {
      set((state) => ({
        tasks: [
          ...state.tasks,
          ...args.map((args) => {
            return {
              id: v4(),
              data: {
                args: args,
                durations: [],
                creationTime: new Date().toISOString(),
                commanding: false,
              },
              state: new Idle(),
            } as Task;
          }),
        ],
      }));
    },
    updateTask(id: string, partial: Partial<Task>) {
      set(({ tasks }) => ({
        tasks: tasks.map((task) => {
          if (task.id === id) {
            return {
              ...task,
              ...partial,
            };
          } else {
            return task;
          }
        }),
      }));
    },
    async startTask(id: string) {
      await toState(id, "start");
    },
    async pauseTask(id: string) {
      await toState(id, "pause");
      await startNextQueueing();
    },
    async stopTask(id: string) {
      await toState(id, "stop");
      await startNextQueueing();
    },
    async finishTask(id: string) {
      await toState(id, "finish");
      await startNextQueueing();
    },
    async errorTask(id: string, reason: string) {
      await toState(id, "error", reason);
      await startNextQueueing();
    },
    removeTask(id: string) {
      if (getTask(id)?.state.removable) {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        }));
      }
    },
    resetTask(id: string) {
      if (getTask(id)?.state.removable) {
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id === id) {
              return {
                id: v4(),
                state: new Idle(),
                data: {
                  commanding: false,
                  creationTime: new Date().toISOString(),
                  args: task.data.args,
                  durations: [],
                },
              } as Task;
            } else {
              return task;
            }
          }),
        }));
      }
    },
    async startAllTasks() {
      for (const task of get().tasks) {
        await toState(task, "start");
      }
    },
    async pauseAllTasks() {
      for (const task of get().tasks) {
        await toState(task, "pause");
      }
    },
    async stopAllTasks() {
      for (const task of get().tasks) {
        await toState(task, "stop");
      }
    },
    removeAllTasks() {
      const removable = new Set(
        get()
          .tasks.filter(({ state }) => state.removable)
          .map(({ id }) => id)
      );

      set(({ tasks }) => ({
        tasks: tasks.filter(({ id }) => !removable.has(id)),
      }));
    },
    startNextQueueing,
  };
});
