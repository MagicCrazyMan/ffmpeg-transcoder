/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import { Metadata } from "../libs/metadata";
import { Preset } from "../libs/preset";
import { TaskArgs, TaskArgsItem, TaskArgsSource } from "../libs/task";
import type {
  ConfigurationNotLoadedError,
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  FFprobeNotFoundError,
  FFprobeRuntimeError,
  FFprobeUnavailableError,
  TaskExistingError,
  TaskNotFoundError,
} from "./error";

type NormalizedTaskArgs = {
  inputs: NormalizedTaskArgsItem[];
  outputs: NormalizedTaskArgsItem[];
};

type NormalizedTaskArgsItem = {
  path?: string;
  args: string[];
};

const normalizeTaskArgs = ({ source, path, args }: TaskArgsItem): NormalizedTaskArgsItem => {
  switch (source) {
    case TaskArgsSource.Auto:
      return {
        path,
        args: [],
      };
    case TaskArgsSource.Custom:
      return {
        path,
        args: args as string[],
      };
    case TaskArgsSource.FromPreset: {
      return {
        path,
        args: (args as Preset).args,
      };
    }
  }
};

/**
 * Starts a task.
 *
 * # Errors
 *
 * - {@link ConfigurationNotLoadedError} if configuration not loaded yet
 * - {@link TaskExistingError} if task with the same id existing
 * - {@link FFprobeNotFoundError} if ffprobe program not found
 * - {@link FFprobeUnavailableError} if ffprobe program unavailable
 * - {@link FFmpegNotFoundError} if ffmpeg program not found
 * - {@link FFmpegUnavailableError} if ffmpeg program unavailable
 *
 * @param id Task id
 * @param args Task args
 */
export const startTask = async (id: string, args: TaskArgs) => {
  return await invoke<void>("start_task", {
    id,
    args: {
      inputs: args.inputs.map((input) => normalizeTaskArgs(input)),
      outputs: args.outputs.map((input) => normalizeTaskArgs(input)),
    } as NormalizedTaskArgs,
  });
};

/**
 * Stops a task.
 *
 * # Errors
 *
 * - {@link ConfigurationNotLoadedError} if configuration not loaded yet
 * - {@link FFmpegNotFoundError} if ffmpeg program not found
 * - {@link FFmpegUnavailableError} if ffmpeg program unavailable
 * - {@link TaskNotFoundError} if task id not found
 *
 * @param id Task id
 */
export const stopTask = async (id: string) => await invoke<void>("stop_task", { id });

/**
 * Pauses a task.
 *
 * # Errors
 *
 * - {@link ConfigurationNotLoadedError} if configuration not loaded yet
 * - {@link FFmpegNotFoundError} if ffmpeg program not found
 * - {@link FFmpegUnavailableError} if ffmpeg program unavailable
 * - {@link TaskNotFoundError} if task id not found
 *
 * @param id Task id
 */
export const pauseTask = async (id: string) => await invoke<void>("pause_task", { id });

/**
 * Resumes a task.
 *
 * # Errors
 *
 * - {@link ConfigurationNotLoadedError} if configuration not loaded yet
 * - {@link FFmpegNotFoundError} if ffmpeg program not found
 * - {@link FFmpegUnavailableError} if ffmpeg program unavailable
 * - {@link TaskNotFoundError} if task id not found
 *
 * @param id Task id
 */
export const resumeTask = async (id: string) => await invoke<void>("resume_task", { id });

/**
 * Gets metadata of a media
 *
 * # Errors
 *
 * - {@link ConfigurationNotLoadedError} if configuration not loaded yet
 * - {@link FFprobeNotFoundError} if ffprobe program not found
 * - {@link FFprobeUnavailableError} if ffprobe program unavailable
 * - {@link FFprobeRuntimeError} if ffprobe throws a runtime error
 *
 * @param path Path to media file
 */
export const getMediaMetadata = async (path: string) => {
  return await invoke<string>("media_metadata", { path }).then(
    (metadataRaw) => JSON.parse(metadataRaw) as Metadata
  );
};
