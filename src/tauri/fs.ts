/* eslint-disable @typescript-eslint/no-unused-vars */
import { invoke } from "@tauri-apps/api";
import { SearchDirectory } from "../libs/search";
import type { DirectoryNotFoundError } from "./error";

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
export const searchDirectory = async (dir: string, maxDepth?: number) =>
  await invoke<SearchDirectory>("search_directory", { dir, maxDepth });
