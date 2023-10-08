import { listen } from "@tauri-apps/api/event";
import { v4 } from "uuid";
import { create } from "zustand";
import { Metadata } from "../tauri/task";

export type TaskStoreState = {
  tasks: Task[];
  updateTask: (id: string, task: Partial<Task>) => void;
  removeTask: (id: string) => void;
  addTask: (params: TaskParams) => void;
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

export type TaskInputParams = {
  path: string;
  params?: string[];
};

export type TaskOutputParams = {
  path?: string;
  params?: string[];
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
  type: TaskState.Finished;
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

export const useTaskStore = create<TaskStoreState>((set) => {
  const tasks: Task[] = [
    {
      id: v4(),
      commanding: false,
      params: {
        inputs: [{ path: "D:\\Captures\\2023-09-10 23-35-22.mp4", params: ["-c:v", "av1_cuvid"] }],
        outputs: [
          {
            path: "F:\\Transcode\\2023-09-10 23-35-22(2).mp4",
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
            path: "E:\\Music\\Hatsune Miku\\[180110][LIVE]MAGICAL MIRAI 2017\\[Vmoe]Hatsune Miku「Magical Mirai 2017」[BDrip][1920x1080p][HEVC_YUV420p10_60fps_2FLAC_5.1ch&2.0ch_Chapter][Effect Subtitles].mkv",
            params: [],
          },
        ],
        outputs: [
          {
            path: "F:\\Transcode\\2.mp4",
            params: ["-c:v", "hevc_nvenc", "-b:v", "2000", "-preset", "fast", "-c:a", "copy"],
          },
        ],
      },
    },
  ];
  const updateTask = (id: string, task: Partial<Task>) => {
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
    const i = tasks.findIndex((task) => task.id === id);
    if (i !== -1) {
      tasks.splice(i, 1);
      set({ tasks: [...tasks] });
    }
  };
  const addTask = (params: TaskParams) => {
    tasks.push({
      id: v4(),
      commanding: false,
      params,
    });
    set({ tasks: [...tasks] });
  };
  const resetTask = (id: string) => {
    const i = tasks.findIndex((task) => task.id === id);
    if (i !== -1) {
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
