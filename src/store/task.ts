import { EventCallback, listen } from "@tauri-apps/api/event";
import { v4 } from "uuid";
import { create } from "zustand";
import { Task, TaskData, TaskArgs } from "../libs/task";
import { TASK_MESSAGE_EVENT, TaskMessage } from "../libs/task/message";
import {
  Errored,
  Finished,
  Idle,
  Running,
  TaskState,
  TaskStateCode,
} from "../libs/task/state_machine";

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
};

export const useTaskStore = create<TaskStoreState>((set, get) => {
  const getTask = (id: string) => get().tasks.find((task) => task.id === id);

  const toState = async (id: string | Task, action: "start" | "pause" | "stop") => {
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

    let nextState: TaskState;
    let nextData: Partial<TaskData>;
    switch (action) {
      case "start": {
        const next = await task.state.start(task);
        nextState = next.nextState;
        nextData = next.nextData;
        break;
      }
      case "pause": {
        const next = await task.state.pause(task);
        nextState = next.nextState;
        nextData = next.nextData;
        break;
      }
      case "stop": {
        const next = await task.state.stop(task);
        nextState = next.nextState;
        nextData = next.nextData;
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
              ...nextData,
              commanding: false,
            },
            state: nextState,
          };
        } else {
          return t;
        }
      }),
    }));

    // starts next task if some tasks in queueing
    switch (action) {
      case "start":
        break;
      case "pause":
      case "stop": {
        const nextTask = get().tasks.find((task) => task.state.code === TaskStateCode.Queueing);
        if (nextTask) await toState(nextTask.id, "start");
        break;
      }
    }
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
    },
    async stopTask(id: string) {
      await toState(id, "stop");
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
  };
});

/**
 * Handles task message
 * @param event Tauri event carrying task message
 */
const handleTaskMessage: EventCallback<TaskMessage> = async (event) => {
  const { tasks, updateTask, startTask } = useTaskStore.getState();

  const message = event.payload;

  const task = tasks.find((task) => task.id === message.id);
  if (!task) return;  

  let nextTask: Task | undefined;
  // overwrite frontend state by message from backend
  switch (message.state) {
    case "Running":
      updateTask(message.id, { state: new Running(message) });
      break;
    case "Errored":
      updateTask(message.id, { state: new Errored(message.reason) });
      nextTask = tasks.find((task) => task.state.code === TaskStateCode.Queueing);
      break;
    case "Finished":
      updateTask(message.id, { state: new Finished() });
      nextTask = tasks.find((task) => task.state.code === TaskStateCode.Queueing);
      break;
  }

  // starts next task if some tasks in queueing
  if (nextTask) await startTask(nextTask.id);
};

/**
 * Starts listening task messages from backend.
 * @param updateTask Updater.
 */
listen<TaskMessage>(TASK_MESSAGE_EVENT, handleTaskMessage);
