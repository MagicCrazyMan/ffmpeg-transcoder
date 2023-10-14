export type TauriError =
  | InternalError
  | FFmpegNotFoundError
  | FFprobeNotFoundError
  | FFmpegUnavailableError
  | FFprobeUnavailableError
  | DirectoryNotFoundError
  | TaskNotFoundError
  | ConfigurationNotLoadedError
  | ConfigurationUnavailableError;

export type InternalError = {
  type: "Internal";
};

export type FFmpegNotFoundError = {
  type: "FFmpegNotFound";
};

export type FFprobeNotFoundError = {
  type: "FFprobeNotFound";
};

export type FFmpegUnavailableError = {
  type: "FFmpegUnavailable";
};

export type FFprobeUnavailableError = {
  type: "FFprobeUnavailable";
};

export type DirectoryNotFoundError = {
  type: "DirectoryNotFound";
  path: string;
};

export type TaskNotFoundError = {
  type: "TaskNotFound";
  id: string;
};

export type ConfigurationNotLoadedError = {
  type: "ConfigurationNotLoaded";
};

export type ConfigurationUnavailableError = {
  type: "ConfigurationUnavailable";
  reasons: TauriError[];
};

export interface ErrorToMessage {
  (error: TauriError, printKeywords: true): string;
  (error: Pick<TauriError, "type">, printKeywords: false): string;
  (error: Pick<TauriError, "type">): string;
}

/**
 * Converts tauri error to short message.
 *
 * @param error Tauri error.
 * @param printKeywords Prints keywords.
 * @returns SHort message
 */
export const toMessage: ErrorToMessage = (error, printKeywords = false) => {
  switch (error.type) {
    case "Internal":
      return "Interval Error";
    case "FFmpegNotFound":
      return "ffmpeg program not found";
    case "FFprobeNotFound":
      return "ffprobe program not found";
    case "FFmpegUnavailable":
      return "ffmpeg program unavailable";
    case "FFprobeUnavailable":
      return "ffprobe program unavailable";
    case "DirectoryNotFound":
      return printKeywords
        ? `directory ${(error as DirectoryNotFoundError).path} not found`
        : "directory not found";
    case "TaskNotFound":
      return printKeywords ? `task ${(error as TaskNotFoundError).id} not found` : "task not found";
    case "ConfigurationNotLoaded":
      return "configuration not loaded";
    case "ConfigurationUnavailable":
      return "configuration unavailable";
  }
};
