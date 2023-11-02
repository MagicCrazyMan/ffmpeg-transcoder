import { Dayjs } from "dayjs";
import { TaskData } from "./task";

export type HistoryTask = Pick<TaskData, "args"> & { id: string; creationTime: Dayjs };
