import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/api/notification";
import { EOL } from "@tauri-apps/api/os";
import { appWindow } from "@tauri-apps/api/window";
import { Task } from ".";
import { useTaskStore } from "../../store/task";
import { Errored, Finished, Running } from "./state_machine";

export const TASK_MESSAGE_EVENT = "transcoding";

export type TaskMessage = TaskMessageRunning | TaskMessageFinished | TaskMessageErrored;

export type TaskMessageRunning = {
  state: "Running";
  id: string;
  progress_type: TaskProgressType;
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

export type TaskMessageFinished = {
  state: "Finished";
  id: string;
};

export type TaskMessageErrored = {
  state: "Errored";
  id: string;
  reason: string;
};

export type TaskProgressType =
  | TaskProgressTypeUnspecified
  | TaskProgressTypeByDuration
  | TaskProgressTypeByFileSize
  | TaskProgressTypeAuto;

export type TaskProgressTypeByDuration = {
  type: "ByDuration";
  duration: number;
};

export type TaskProgressTypeByFileSize = {
  type: "ByFileSize";
  size: number;
};

export type TaskProgressTypeAuto = {
  type: "Auto";
  duration: number;
  file_size: number;
};

export type TaskProgressTypeUnspecified = {
  type: "Unspecified";
};

const checkNotifyPermission = async () => {
  if (await appWindow.isFocused()) return false;

  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }

  return permissionGranted;
};

const finishNotify = async (task: Task) => {
  // build message body
  const inputs =
    task.data.args.inputs.length > 1
      ? task.data.args.inputs
          .slice(0, 1)
          .map(({ path }) => `- ${path} ... and more`)
          .join(EOL)
      : task.data.args.inputs.map(({ path }) => `- ${path}`).join(EOL);
  const middle = "to";
  const outputs =
    task.data.args.outputs.length > 1
      ? task.data.args.outputs
          .slice(0, 1)
          .map(({ path }) => `- ${path ?? "NULL"} ... and more`)
          .join(EOL)
      : task.data.args.outputs.map(({ path }) => `- ${path ?? "NULL"}`).join(EOL);

  sendNotification({
    title: "Task Finished",
    body: [inputs, middle, outputs].join(EOL),
  });
};

const errorNotify = async (reason: string) => {
  sendNotification({ title: "Task Errored", body: reason });
};

/**
 * Starts listening task messages from backend.
 */
listen<TaskMessage>(TASK_MESSAGE_EVENT, async (event) => {
  const { tasks, updateTask, startNextQueueing } = useTaskStore.getState();

  const message = event.payload;

  const task = tasks.find((task) => task.id === message.id);
  if (!task) return;

  // overwrite frontend state by message from backend
  switch (message.state) {
    case "Running":
      updateTask(message.id, { state: new Running(message) });
      break;
    case "Errored":
      updateTask(message.id, { state: new Errored(message.reason) });
      await startNextQueueing();

      if (await checkNotifyPermission()) {
        await errorNotify(message.reason);
      }
      break;
    case "Finished":
      updateTask(message.id, { state: new Finished() });
      await startNextQueueing();

      if (await checkNotifyPermission()) {
        await finishNotify(task);
      }
      break;
  }
});
