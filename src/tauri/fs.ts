import { invoke } from "@tauri-apps/api";

export type TargetFile = {
  filename: string;
  extension?: string; // ensured to be lowercased
  absolute: string;
  relative: string;
  separator: string;
};

/**
 * Finds all files in a directory recursively via Tauri.
 * @returns Flatten files list
 */
export const getFilesFromDirectory = async (dir: string) =>
  await invoke<TargetFile[]>("files_from_directory", { dir });
