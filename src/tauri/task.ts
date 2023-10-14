/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import { Preset } from "../store/preset";
import { ParamsSource, TaskInputParams, TaskOutputParams, TaskParams } from "../store/task";
import type {
  FFprobeNotFoundError,
  FFprobeUnavailableError,
  FFmpegNotFoundError,
  FFmpegUnavailableError,
  TaskNotFoundError,
} from "./error";

export type NormalizedTaskParams = {
  inputs: NormalizedTaskInputParams[];
  outputs: NormalizedTaskOutputParams[];
};

export type NormalizedTaskInputParams = {
  path: string;
  params: string[];
};

export type NormalizedTaskOutputParams = {
  path?: string;
  params: string[];
};

const normalizeTaskParams = ({
  source,
  path,
  params,
}: TaskInputParams | TaskOutputParams): NormalizedTaskInputParams | NormalizedTaskOutputParams => {
  switch (source) {
    case ParamsSource.Auto:
      return {
        path,
        params: [],
      };
    case ParamsSource.Custom:
      return {
        path,
        params: params as string[],
      };
    case ParamsSource.FromPreset: {
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
 * - {@link TaskNotFoundError} if task id not found
 *
 * @param id Task id
 */
export const resumeTask = async (id: string) => await invoke<void>("resume_task", { id });

export type Metadata = {
  streams: (VideoStream | AudioStream)[];
  chapters: Chapter[];
  format: Format;
};

export type Format = {
  filename: string;
  nb_streams: number;
  nb_programs: number;
  format_name: string;
  format_long_name: string;
  start_time: string;
  duration: string;
  size: string;
  bit_rate: string;
  probe_score: number;
  tags: {
    major_brand: string;
    minor_version: string;
    compatible_brands: string;
    encoder: string;
  };
};

export type VideoStream = {
  index: number;
  codec_name: string;
  codec_long_name: string;
  profile: string;
  codec_type: "video";
  codec_tag_string: string;
  codec_tag: string;
  width: number;
  height: number;
  coded_width: number;
  coded_height: number;
  closed_captions: number;
  film_grain: number;
  has_b_frames: number;
  sample_aspect_ratio: string;
  display_aspect_ratio: string;
  pix_fmt: string;
  level: number;
  color_range: string;
  chroma_location: string;
  refs: number;
  r_frame_rate: string;
  avg_frame_rate: string;
  time_base: string;
  start_pts: number;
  start_time: string;
  extradata_size: number;
  disposition: {
    default: 0 | 1;
    dub: 0 | 1;
    original: 0 | 1;
    comment: 0 | 1;
    lyrics: 0 | 1;
    karaoke: 0 | 1;
    forced: 0 | 1;
    hearing_impaired: 0 | 1;
    visual_impaired: 0 | 1;
    clean_effects: 0 | 1;
    attached_pic: 0 | 1;
    timed_thumbnails: 0 | 1;
    captions: 0 | 1;
    descriptions: 0 | 1;
    metadata: 0 | 1;
    dependent: 0 | 1;
    still_image: 0 | 1;
  };
  tags: Record<string, string>;
};

export type AudioStream = {
  index: number;
  codec_name: string;
  codec_long_name: string;
  codec_type: "audio";
  codec_tag_string: string;
  codec_tag: string;
  sample_fmt: string;
  sample_rate: string;
  channels: number;
  channel_layout: string;
  bits_per_sample: number;
  initial_padding: number;
  r_frame_rate: string;
  avg_frame_rate: string;
  time_base: string;
  start_pts: number;
  start_time: string;
  bits_per_raw_sample: string;
  extradata_size: number;
  disposition: {
    default: 0 | 1;
    dub: 0 | 1;
    original: 0 | 1;
    comment: 0 | 1;
    lyrics: 0 | 1;
    karaoke: 0 | 1;
    forced: 0 | 1;
    hearing_impaired: 0 | 1;
    visual_impaired: 0 | 1;
    clean_effects: 0 | 1;
    attached_pic: 0 | 1;
    timed_thumbnails: 0 | 1;
    captions: 0 | 1;
    descriptions: 0 | 1;
    metadata: 0 | 1;
    dependent: 0 | 1;
    still_image: 0 | 1;
  };
  tags: Record<string, string>;
};

export type Chapter = {
  id: number;
  time_base: string;
  start: number;
  start_time: string;
  end: number;
  end_time: string;
  tags: {
    title: string;
  };
};

export const getMediaMetadata = async (path: string) => {
  return await invoke<string>("media_metadata", { path }).then(
    (metadataRaw) => JSON.parse(metadataRaw) as Metadata
  );
};
