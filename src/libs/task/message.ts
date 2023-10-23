import { TauriError } from "../../tauri/error";

export const TASK_MESSAGE_EVENT = "transcoding";

export type TaskMessage =
  | TaskMessageRunning
  | TaskMessageFinished
  | TaskMessageErrored;

export type TaskMessageRunning = {
  state: "Running";
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

export type TaskMessageFinished = {
  state: "Finished";
  id: string;
};

export type TaskMessageErrored = {
  state: "Errored";
  id: string;
  reason: TauriError;
};
