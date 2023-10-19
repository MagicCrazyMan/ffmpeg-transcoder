/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import type { DirectoryNotFoundError } from "./error";

export type Search = {
  search_dir: string;
  search_dir_components: string[];
  entry: SearchDirectory;
};

export type SearchEntry = SearchDirectory | SearchFile;

export type SearchDirectory = {
  type: "Directory";
  absolute: string;
  relative_components: string[];
  name: string;
  children: SearchEntry[];
};

export type SearchFile = {
  type: "File";
  absolute: string;
  relative_components: string[];
  name: string;
  stem?: string;
  extension?: string;
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
  await invoke<Search>("search_directory", { dir, maxDepth });
