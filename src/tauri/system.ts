import { invoke } from "@tauri-apps/api";
import { Configuration } from "../store/app";

export type SystemParticulars = {
  path_separator: string;
  ffmpeg: FFmpegParticulars;
};

export type FFmpegParticulars = {
  banner: FFmpegBanner;
  codecs: FFmpegCodec;
};

export type FFmpegBanner = {
  version?: string;
  copyright?: string;
  compiler?: string;
  build_configurations: string[];
  libraries: Record<string, number[]>;
};

export enum FFmpegCodecType {
  Video = 0,
  Audio = 1,
  Subtitle = 2,
  Data = 3,
  Attachment = 4,
}

export type FFmpegCodec = {
  name: string;
  description: string;
  type: FFmpegCodecType;
  decode: boolean;
  encode: boolean;
  intra: boolean;
  lossy: boolean;
  lossless: boolean;
  decoders: string[];
  encoders: string[];
};

/**
 * Loads configuration into backend via Tauri.
 * @param config Configuration
 * @returns System particulars if success
 */
export const loadConfiguration = async (config: Configuration) => {
  return await invoke<SystemParticulars>("load_configuration", { config });
};

/**
 * Verifies ffmpeg via Tauri.
 * @param ffmpeg FFmpeg program
 */
export const verifyFFmpeg = async (ffmpeg: string) => {
  return await invoke<void>("verify_ffmpeg", { ffmpeg });
};

/**
 * Verifies FFprobe via Tauri.
 * @param ffprobe FFprobe program
 */
export const verifyFFprobe = async (ffprobe: string) => {
  return await invoke<void>("verify_ffprobe", { ffprobe });
};

/**
 * Verifies whether a path exists and points to a directory via Tauri.
 * @param path Path
 */
export const verifyDirectory = async (path: string) => {
  return await invoke<void>("verify_directory", { path });
};
