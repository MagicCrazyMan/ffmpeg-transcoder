import { TaskData } from "./task";

export type HistoryTask = Pick<TaskData, "params" | "creationTime"> & { id: string };
