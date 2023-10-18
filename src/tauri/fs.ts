/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import type { DirectoryNotFoundError } from "./error";

export type SearchEntry = SearchDirectory | SearchFile;

export type SearchDirectory = {
  type: "Directory";
  name: string;
  absolute: string;
  relative: string;
  children: SearchEntry[];
  path: string;
};

export type SearchFile = {
  type: "File";
  name: string;
  extension?: string;
  absolute: string;
  relative: string;
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
 * @returns Search result
 */
export const getFilesFromDirectory = async (dir: string, maxDepth?: number) =>
  await invoke<SearchDirectory>("files_from_directory", { dir, maxDepth });
