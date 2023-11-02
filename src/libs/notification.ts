import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/api/notification";
import { EOL } from "@tauri-apps/api/os";
import { appWindow } from "@tauri-apps/api/window";
import { Task } from "./task";

const checkNotifyPermission = async () => {
  if (await appWindow.isFocused()) return false;

  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === "granted";
  }

  return permissionGranted;
};

/**
 * Notify a finished task.
 * @param task Task
 */
export const notifyFinish = async (task: Task) => {
  if (!(await checkNotifyPermission())) return;

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

/**
 * Notify an errored task.
 * @param reason Error reason
 */
export const notifyError = async (reason: string) => {
  if (!(await checkNotifyPermission())) return;

  sendNotification({ title: "Task Errored", body: reason });
};
