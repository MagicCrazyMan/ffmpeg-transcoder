import { listen } from "@tauri-apps/api/event";
import { v4 } from "uuid";
import { create } from "zustand";
import {
  startTask as startTaskTauri,
  stopTask as stopTaskTauri,
  resumeTask as resumeTaskTauri,
  pauseTask as pauseTaskTauri,
} from "../tauri/task";
import {
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  FFprobeNotFoundError,
  FFprobeUnavailableError,
  TaskNotFoundError,
  toMessage,
} from "../tauri/error";
import { Metadata } from "../tauri/task";
import { Preset } from "./preset";
import { useAppStore } from "./app";
import dayjs, { Dayjs } from "dayjs";

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
   * Starts or resumes a task by id.
   * @param id Task id
   */
  startTask: (id: string) => void;
  /**
   * Pauses a task by id.
   * @param id Task id
   */
  pauseTask: (id: string) => void;
  /**
   * Stops a task by id.
   * @param id Task id
   */
  stopTask: (id: string) => void;
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
   * Only a task in `Finished`, `Stopped` or `Errored` state could be reset
   * @param id Task id
   * @returns
   */
  resetTask: (id: string) => void;
};

export type Task = {
  id: string;
  params: TaskParams;
  state: TaskState;
  workTimeDurations: [Dayjs, Dayjs | undefined][];
  metadata?: boolean | Metadata[];
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
  /**
   * - if `source` is {@link ParamsSource.Auto}, `undefined`.
   * - if `source` is {@link ParamsSource.Custom}, `string`.
   * - if `source` is {@link ParamsSource.FromPreset}, a deep copy of preset.
   */
  params?: string[] | Preset;
};

export type TaskState =
  | TaskStateIdle
  | TaskStateCommanding
  | TaskStateQueueing
  | TaskStateRunning
  | TaskStatePausing
  | TaskStateStopped
  | TaskStateFinished
  | TaskStateErrored;

export type TaskStateIdle = {
  type: "Idle";
};

export type TaskStateCommanding = {
  type: "Commanding";
  prevState: TaskState;
};

export type TaskStateQueueing = {
  type: "Queueing";
  prevState: TaskStateIdle | TaskStatePausing;
};

export type TaskStateRunning = {
  type: "Running";
  message: TaskMessageRunning;
};

export type TaskStatePausing = {
  type: "Pausing";
  lastRunningMessage?: TaskMessageRunning;
};

export type TaskStateStopped = {
  type: "Stopped";
};

export type TaskStateFinished = {
  type: "Finished";
};

export type TaskStateErrored = {
  type: "Errored";
  reason: string;
};

export const useTaskStore = create<TaskStoreState>((set, get) => {
  const tasks: Task[] = [
    {
      id: v4(),
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
      state: {
        type: "Idle",
      },
      workTimeDurations: [],
    },
    {
      id: v4(),
      params: {
        inputs: [
          {
            id: v4(),
            path: "E:\\Music\\Hatsune Miku\\[180110][LIVE]MAGICAL MIRAI 2017\\[Vmoe]Hatsune Miku「Magical Mirai 2017」[BDrip][1920x1080p][HEVC_YUV420p10_60fps_2FLAC_5.1ch&2.0ch_Chapter][Effect Subtitles].mkv",
            source: ParamsSource.Custom,
            params: ["-c:v", "hevc_qsv"],
          },
        ],
        outputs: [
          {
            id: v4(),
            path: "F:\\Transcode\\2.mp4",
            source: ParamsSource.Custom,
            params: [
              "-c:v",
              "hevc_nvenc",
              "-preset",
              "fast",
              "-x265-params",
              "lossless=1",
              "-c:a",
              "copy",
            ],
          },
        ],
      },
      state: {
        type: "Idle",
      },
      workTimeDurations: [],
    },
  ];

  const updateTask = (id: string, partial: Partial<Task>) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
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
  };

  const startTask = (id: string) => {
    const tasks = get().tasks;
    const task = tasks.find((task) => task.id === id)!;

    if (
      task.state.type !== "Idle" &&
      task.state.type !== "Pausing" &&
      task.state.type !== "Queueing"
    )
      return;

    // if exceeds max running count, set to queueing state
    if (
      tasks.filter((task) => task.state.type === "Running" || task.state.type === "Commanding")
        .length +
        1 >
      useAppStore.getState().configuration.maxRunning
    ) {
      if (task.state.type !== "Queueing")
        updateTask(task.id, { state: { type: "Queueing", prevState: task.state } });
      return;
    }

    updateTask(task.id, { state: { type: "Commanding", prevState: task.state } });

    let promise: Promise<void>;
    if (task.state.type === "Idle") {
      promise = startTaskTauri(task.id, task.params);
    } else if (task.state.type === "Pausing") {
      promise = resumeTaskTauri(task.id);
    } else if (task.state.prevState.type === "Idle") {
      promise = startTaskTauri(task.id, task.params);
    } else {
      promise = resumeTaskTauri(task.id);
    }

    promise.catch(
      (
        err:
          | FFmpegNotFoundError
          | FFprobeNotFoundError
          | FFmpegUnavailableError
          | FFprobeUnavailableError
          | TaskNotFoundError
      ) => {
        console.error(err);
        updateTask(task.id, {
          state: {
            type: "Errored",
            reason: toMessage({ type: err.type }),
          },
        });
      }
    );
  };

  const pauseTask = (id: string) => {
    const tasks = get().tasks;
    const task = tasks.find((task) => task.id === id)!;

    if (task.state.type === "Running") {
      updateTask(task.id, { state: { type: "Commanding", prevState: task.state } });
      pauseTaskTauri(task.id).catch((err: TaskNotFoundError) => {
        console.error(err);
        updateTask(task.id, {
          state: {
            type: "Errored",
            reason: toMessage({ type: err.type }),
          },
        });
      });
    } else if (task.state.type === "Queueing") {
      updateTask(task.id, { state: { type: "Idle" } });
    }
  };

  const stopTask = (id: string) => {
    const task = get().tasks.find((task) => task.id === id)!;

    if (task.state.type === "Running" || task.state.type === "Pausing") {
      updateTask(task.id, { state: { type: "Commanding", prevState: task.state } });
      stopTaskTauri(task.id).catch((err: TaskNotFoundError) => {
        console.error(err);
        updateTask(task.id, {
          state: {
            type: "Errored",
            reason: toMessage({ type: err.type }),
          },
        });
      });
    } else if (task.state.type === "Queueing") {
      updateTask(task.id, { state: { type: "Stopped" } });
    }
  };

  const removeTask = (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((task) => task.id !== id),
    }));
  };

  const addTask = (params: TaskParams) => {
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id: v4(),
          state: { type: "Idle" },
          workTimeDurations: [],
          params,
        },
      ],
    }));
  };

  const resetTask = (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((task) => {
        if (task.id === id) {
          return {
            id: v4(),
            state: { type: "Idle" },
            workTimeDurations: [],
            params: task.params,
          };
        } else {
          return task;
        }
      }),
    }));
  };

  return {
    tasks,
    updateTask,
    startTask,
    pauseTask,
    stopTask,
    removeTask,
    addTask,
    resetTask,
  };
});

export type TaskMessageRunning = {
  state: TaskStateRunning["type"];
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
  state: TaskStatePausing["type"];
  id: string;
};

export type TaskMessageStopped = {
  state: TaskStateStopped["type"];
  id: string;
};

export type TaskMessageFinished = {
  state: TaskStateFinished["type"];
  id: string;
};

export type TaskMessageErrored = {
  state: TaskStateErrored["type"];
  id: string;
  reason: string;
};

export type TaskMessage =
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
const listenTaskMessages = () => {
  listen<TaskMessage>(TASK_MESSAGE_EVENT, (event) => {
    const { tasks, updateTask, startTask } = useTaskStore.getState();

    const message = event.payload;

    const task = tasks.find((task) => task.id === message.id);
    if (!task) return;

    // updates task state
    switch (message.state) {
      case "Pausing": {
        let lastRunningMessage: TaskMessageRunning | undefined;
        if (task.state.type === "Commanding" && task.state.prevState.type === "Running") {
          lastRunningMessage = task.state.prevState.message;
        }

        updateTask(message.id, {
          state: {
            type: "Pausing",
            lastRunningMessage,
          },
        });
        break;
      }
      case "Errored":
        console.error(message.reason);
        updateTask(message.id, { state: { type: message.state, reason: message.reason } });
        break;
      case "Running":
        updateTask(message.id, { state: { type: message.state, message } });
        break;
      case "Stopped":
      case "Finished":
        updateTask(message.id, { state: { type: message.state } });
        break;
    }

    // update work time durations
    switch (message.state) {
      case "Running": {
        // adds a new work time duration if previous state is Idle or Running
        if (
          task.state.type === "Commanding" &&
          (task.state.prevState.type === "Idle" || task.state.prevState.type === "Pausing")
        ) {
          updateTask(message.id, {
            workTimeDurations: [...task.workTimeDurations, [dayjs(), undefined]],
          });
        }
        break;
      }
      case "Pausing":
      case "Stopped":
      case "Finished":
      case "Errored":
        updateTask(message.id, {
          workTimeDurations: task.workTimeDurations.map((duration, index) => {
            if (index !== task.workTimeDurations.length - 1) {
              return duration;
            } else {
              return [duration[0], dayjs()];
            }
          }),
        });
        break;
    }

    // starts next task if some tasks in queueing
    switch (message.state) {
      case "Running":
        break;
      case "Pausing":
      case "Stopped":
      case "Finished":
      case "Errored": {
        const next = tasks.find((task) => task.state.type === "Queueing");
        if (next) startTask(next.id);
        break;
      }
    }
  });
};

// starts listen to task message.
// listener lives until app quits, thus, it is no need to unlisten it
listenTaskMessages();
