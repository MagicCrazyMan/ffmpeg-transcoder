/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import type { DirectoryNotFoundError } from "./error";

export type TargetFile = {
  filename: string;
  extension?: string; // ensured to be lowercased
  absolute: string;
  relative: string;
  separator: string;
};

/**
 * Finds all files in a directory recursively via Tauri.
 *
 * # Errors
 *
 * - {@link DirectoryNotFoundError} if directory not found
 *
 * @param dir Directory to search in
 * @param maxDepth Max depth should walk in during searching, default for `5`
 * @returns Flatten files list
 */
export const getFilesFromDirectory = async (dir: string, maxDepth?: number) =>
  await invoke<TargetFile[]>("files_from_directory", { dir, maxDepth });
