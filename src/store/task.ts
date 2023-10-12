import { listen } from "@tauri-apps/api/event";
import { v4 } from "uuid";
import { create } from "zustand";
import { Metadata } from "../tauri/task";
import { Preset } from "./preset";

export type TaskStoreState = {
  /**
   * Tasks list
   */
  tasks: Task[];
  /**
   * Updates state of a task by id.
   * @param id Task id
   * @param task New task state
   */
  updateTask: (id: string, task: Partial<Task>) => void;
  /**
   * Removes a task by id
   * @param id Task id
   */
  removeTask: (id: string) => void;
  /**
   * Adds a new task from specified task params.
   * @param params Task params
   */
  addTask: (params: TaskParams) => void;
  /**
   * Resets a task.
   * Only a task in {@link TaskState.Finished}, {@link TaskState.Stopped} or {@link TaskState.Errored} state could be reset
   * @param id 
   * @returns 
   */
  resetTask: (id: string) => void;
};

export type Task = {
  id: string;
  params: TaskParams;
  commanding: boolean;
  metadata?: boolean | Metadata[];
  message?: TaskMessage;
};

export type TaskParams = {
  inputs: TaskInputParams[];
  outputs: TaskOutputParams[];
};

export enum ParamsSource {
  Auto = 1,
  Custom = 2,
  FromPreset = 3,
}

export type TaskInputParams = {
  id: string;
  path: string;
  source: ParamsSource;
  /**
   * - if `source` is {@link ParamsSource.Auto}, `undefined`.
   * - if `source` is {@link ParamsSource.Custom}, `string`.
   * - if `source` is {@link ParamsSource.FromPreset}, a deep copy of preset.
   */
  params?: string[] | Preset;
};

export type TaskOutputParams = {
  id: string;
  path?: string;
  source: ParamsSource;
  params?: string[] | Preset;
};

export enum TaskState {
  Queueing = "Queueing",
  Running = "Running",
  Pausing = "Pausing",
  Stopped = "Stopped",
  Finished = "Finished",
  Errored = "Errored",
}

// export type TaskMessageStart = {
//   type: "Start";
//   id: string;
// };

export type TaskMessageRunning = {
  type: TaskState.Running;
  id: string;
  total_duration: number;
  raw: string[];
  frame?: number;
  fps?: number;
  bitrate?: number;
  total_size?: number;
  output_time_ms?: number;
  dup_frames?: number;
  drop_frames?: number;
  speed?: number;
};

export type TaskMessagePausing = {
  type: TaskState.Pausing;
  id: string;
};

export type TaskMessageStopped = {
  type: TaskState.Stopped;
  id: string;
};

export type TaskMessageFinished = {
  type: TaskState.Finished;
  id: string;
};

export type TaskMessageErrored = {
  type: TaskState.Errored;
  id: string;
  reason: string;
};

export type TaskMessage =
  //   | TaskMessageStart
  | TaskMessageRunning
  | TaskMessagePausing
  | TaskMessageStopped
  | TaskMessageFinished
  | TaskMessageErrored;

export const TASK_MESSAGE_EVENT = "transcoding";

/**
 * Starts listening task messages from backend.
 * @param updateTask Updater.
 */
const listenTaskMessages = (updateTask: (id: string, task: Partial<Task>) => void) => {
  listen<TaskMessage>(TASK_MESSAGE_EVENT, (event) => {
    const message = event.payload;
    updateTask(message.id, { message });
  });
};

export const useTaskStore = create<TaskStoreState>((set, get) => {
  const tasks: Task[] = [
    {
      id: v4(),
      commanding: false,
      params: {
        inputs: [
          {
            id: v4(),
            path: "D:\\Captures\\2023-09-10 23-35-22.mp4",
            source: ParamsSource.Custom,
            params: ["-c:v", "av1_cuvid"],
          },
        ],
        outputs: [
          {
            id: v4(),
            path: "F:\\Transcode\\2023-09-10 23-35-22(2).mp4",
            source: ParamsSource.Custom,
            params: ["-c:v", "hevc_nvenc", "-b:v", "2000", "-preset", "fast", "-c:a", "copy"],
          },
        ],
      },
    },
    {
      id: v4(),
      commanding: false,
      params: {
        inputs: [
          {
            id: v4(),
            path: "E:\\Music\\Hatsune Miku\\[180110][LIVE]MAGICAL MIRAI 2017\\[Vmoe]Hatsune Miku「Magical Mirai 2017」[BDrip][1920x1080p][HEVC_YUV420p10_60fps_2FLAC_5.1ch&2.0ch_Chapter][Effect Subtitles].mkv",
            source: ParamsSource.Custom,
            params: [],
          },
        ],
        outputs: [
          {
            id: v4(),
            path: "F:\\Transcode\\2.mp4",
            source: ParamsSource.Custom,
            params: ["-c:v", "hevc_nvenc", "-b:v", "2000", "-preset", "fast", "-c:a", "copy"],
          },
        ],
      },
    },
  ];

  const updateTask = (id: string, task: Partial<Task>) => {
    const tasks = get().tasks;
    const i = tasks.findIndex((task) => task.id === id);
    if (i !== -1) {
      const o = tasks[i];
      const n = {
        ...o,
        ...task,
      };
      tasks[i] = n;
      set({ tasks: [...tasks] });
    }
  };

  const removeTask = (id: string) => {
    const tasks = get().tasks;
    const i = tasks.findIndex((task) => task.id === id);
    if (i !== -1) {
      tasks.splice(i, 1);
      set({ tasks: [...tasks] });
    }
  };

  const addTask = (params: TaskParams) => {
    const newTask = {
      id: v4(),
      commanding: false,
      params,
    };
    set({
      tasks: [...get().tasks, newTask],
    });
  };

  const resetTask = (id: string) => {
    const tasks = get().tasks;
    const i = tasks.findIndex((task) => task.id === id);
    if (i !== -1) {
      const task = tasks[i]
      // only a task in finished, stopped or errored state could be reset
      if (task.message?.type !== TaskState.Finished && task.message?.type !== TaskState.Stopped && task.message?.type !== TaskState.Errored) {
        return
      }

      tasks[i] = {
        id: v4(),
        commanding: false,
        params: tasks[i].params,
      };
      set({ tasks: [...tasks] });
    }
  };
  // starts listen to task message.
  // listener lives until app quits, thus, it is no need to unlisten it
  listenTaskMessages(updateTask);

  return {
    tasks,
    updateTask,
    removeTask,
    addTask,
    resetTask,
  };
});
