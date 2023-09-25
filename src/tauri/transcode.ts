import { invoke } from "@tauri-apps/api";

export type TranscodeItem = {
  inputs: InputParams[];
  outputs: OutputParams[];
};

export type InputParams = {
  path: string;
  params?: string[];
};

export type OutputParams = {
  path: string;
  params?: string[];
};

export const startTranscode = async (item: TranscodeItem) => {
  return await invoke<{ id: string }>("start_transcode", { item });
};

export const stopTranscode = async (id: string) => {
  return await invoke<void>("stop_transcode", { id });
};

export const pauseTranscode = async (id: string) => {
  return await invoke<void>("pause_transcode", { id });
};
