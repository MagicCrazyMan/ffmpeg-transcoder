import { Dayjs } from "dayjs";
import { Metadata } from "../metadata";
import { Preset } from "../preset";
import { TaskState } from "./state_machine";

export type Task = {
  id: string;
  data: TaskData;
  state: TaskState;
};

export type TaskData = {
  commanding: boolean;
  args: TaskArgs;
  creationTime: string;
  durations: [Dayjs, Dayjs | undefined][];
  metadata?: boolean | Metadata[];
};

export type TaskArgs = {
  inputs: TaskArgsItem[];
  outputs: TaskArgsItem[];
};

export enum TaskArgsSource {
  Auto = 1,
  Custom = 2,
  FromPreset = 3,
}

export type TaskArgsItem = {
  path: string;
  source: TaskArgsSource;
  /**
   * - if `source` is {@link TaskArgsSource.Auto}, `undefined`.
   * - if `source` is {@link TaskArgsSource.Custom}, `string`.
   * - if `source` is {@link TaskArgsSource.FromPreset}, a deep copy of preset.
   */
  args?: string[] | Preset;
};
