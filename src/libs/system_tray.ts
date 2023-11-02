import { listen } from "@tauri-apps/api/event";
import { useTaskStore } from "../store/task";

export const START_ALL_TASKS_EVENT = "start_all_tasks";
export const PAUSE_ALL_TASKS_EVENT = "pause_all_tasks";
export const STOP_ALL_TASKS_EVENT = "stop_all_tasks";

/**
 * Starts listening system tray event from backend
 */
listen<void>(START_ALL_TASKS_EVENT, async () => {
  await useTaskStore.getState().startAllTasks();
});
listen<void>(PAUSE_ALL_TASKS_EVENT, async () => {
  await useTaskStore.getState().pauseAllTasks();
});
listen<void>(STOP_ALL_TASKS_EVENT, async () => {
  await useTaskStore.getState().stopAllTasks();
});
