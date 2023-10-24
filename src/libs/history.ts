import { TaskData } from "./task";

export type HistoryTask = Pick<TaskData, "args" | "creationTime"> & { id: string };
