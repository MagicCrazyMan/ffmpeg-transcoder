import { listen } from "@tauri-apps/api/event";
import { v4 } from "uuid";
import { create } from "zustand";

export type TaskStoreState = {
  tasks: Map<string, Task>;
};

export type Task = {
  params: TaskParams;
  commanding: boolean;
  metadata?: MediaMetadata;
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
  const tasks = new Map<string, Task>();
  // test data
  tasks.set(v4(), {
    commanding: false,
    params: {
      inputs: [{ path: "D:\\Captures\\2023-09-10 23-35-22.mp4", params: ["-c:v", "av1_cuvid"] }],
      outputs: [
        {
          path: "F:\\Transcode\\2023-09-10 23-35-22(2).mp4",
          params: [
            "-c:v",
            "hevc_nvenc",
            "-b:v",
            "2000",
            "-preset",
            "fast",
            "-c:a",
            "copy",
          ],
        },
      ],
    },
  });
  const updateTask = (id: string, task: Partial<Task>) => {
    const old = tasks.get(id);
    if (old) {
      // MUST create a new object and new Map for trigger update for ReactJS
      tasks.set(id, {
        ...old,
        ...task,
      });
      set({ tasks: new Map(tasks) });
    }
  };
  // starts listen to task message.
  // listener lives until app quits, thus, it is no need to unlisten it
  listenTaskMessages(updateTask);
  window.addEventListener("unload", () => {
    console.log(111);
    
    
  })

  return {
    tasks,
    updateTask,
  };
});
