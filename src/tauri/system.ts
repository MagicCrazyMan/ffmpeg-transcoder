import { invoke } from "@tauri-apps/api/primitives";
import { Configuration } from "../libs/config";
import { SystemParticulars } from "../libs/particulars";

/**
 * Loads configuration into backend via Tauri.
 * @param config Configuration
 * @returns System particulars if success
 */
export const loadConfiguration = async (config: Configuration) =>
  await invoke<SystemParticulars>("load_configuration", { config });

/**
 * Verifies ffmpeg via Tauri.
 * @param ffmpeg FFmpeg program
 */
export const verifyFFmpeg = async (ffmpeg: string) =>
  await invoke<void>("verify_ffmpeg", { ffmpeg });

/**
 * Verifies FFprobe via Tauri.
 * @param ffprobe FFprobe program
 */
export const verifyFFprobe = async (ffprobe: string) =>
  await invoke<void>("verify_ffprobe", { ffprobe });

/**
 * Verifies whether a path exists and points to a directory via Tauri.
 * @param path Path
 */
export const verifyDirectory = async (path: string) =>
  await invoke<void>("verify_directory", { path });
