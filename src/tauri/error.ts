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

/**
 * Convert tauri error to short message.
 * A short message ignores keywords and print error reason only.
 * @param error Tauri error.
 * @returns SHort message
 */
export const toShortMessage = (error: TauriError) => {
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
      return `directory ${error.path} not found`;
    case "TaskNotFound":
      return `task ${error.id} not found`;
    case "ConfigurationNotLoaded":
      return "configuration not loaded";
    case "ConfigurationUnavailable":
      return "configuration unavailable";
  }
};
