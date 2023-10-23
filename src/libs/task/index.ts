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
  params: TaskParams;
  creationTime: string;
  durations: [Dayjs, Dayjs | undefined][];
  metadata?: boolean | Metadata[];
};

export type TaskParams = {
  inputs: TaskInputParams[];
  outputs: TaskOutputParams[];
};

export enum TaskParamsSource {
  Auto = 1,
  Custom = 2,
  FromPreset = 3,
}

export type TaskInputParams = {
  id: string;
  path: string;
  source: TaskParamsSource;
  /**
   * - if `source` is {@link TaskParamsSource.Auto}, `undefined`.
   * - if `source` is {@link TaskParamsSource.Custom}, `string`.
   * - if `source` is {@link TaskParamsSource.FromPreset}, a deep copy of preset.
   */
  params?: string[] | Preset;
};

export type TaskOutputParams = {
  id: string;
  path?: string;
  source: TaskParamsSource;
  /**
   * - if `source` is {@link TaskParamsSource.Auto}, `undefined`.
   * - if `source` is {@link TaskParamsSource.Custom}, `string`.
   * - if `source` is {@link TaskParamsSource.FromPreset}, a deep copy of preset.
   */
  params?: string[] | Preset;
};
