import { Task } from "../store/task";

export type HistoryTask = Pick<Task, "id" | "params" | "creationTime">;
