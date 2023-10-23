/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import { Metadata } from "../libs/metadata";
import { Preset } from "../libs/preset";
import { TaskInputParams, TaskOutputParams, TaskParams, TaskParamsSource } from "../libs/task";
import type {
  ConfigurationNotLoadedError,
  FFprobeRuntimeError,
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  FFprobeNotFoundError,
  FFprobeUnavailableError,
  TaskNotFoundError,
  TaskExistingError
} from "./error";

type NormalizedTaskParams = {
  inputs: NormalizedTaskInputParams[];
  outputs: NormalizedTaskOutputParams[];
};

type NormalizedTaskInputParams = {
  path: string;
  params: string[];
};

type NormalizedTaskOutputParams = {
  path?: string;
  params: string[];
};

const normalizeTaskParams = ({
  source,
  path,
  params,
}: TaskInputParams | TaskOutputParams): NormalizedTaskInputParams | NormalizedTaskOutputParams => {
  switch (source) {
    case TaskParamsSource.Auto:
      return {
        path,
        params: [],
      };
    case TaskParamsSource.Custom:
      return {
        path,
        params: params as string[],
      };
    case TaskParamsSource.FromPreset: {
      return {
        path,
        params: (params as Preset).params,
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
 * @param params Task params
 */
export const startTask = async (id: string, params: TaskParams) => {
  return await invoke<void>("start_task", {
    id,
    params: {
      inputs: params.inputs.map((input) => normalizeTaskParams(input)),
      outputs: params.outputs.map((input) => normalizeTaskParams(input)),
    } as NormalizedTaskParams,
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
