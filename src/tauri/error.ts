/**
 * Tauri error kinds.
 */
export enum TauriErrorKind {
  Internal = 0,
  FFmpegNotFound = 1,
  FFprobeNotFound = 2,
  FFmpegUnavailable = 3,
  FFprobeUnavailable = 4,
  DirectoryNotFound = 5,
}

/**
 * Tauri error.
 */
export type TauriError = {
  kind: TauriErrorKind;
  keywords: string[];
};

/**
 * Convert tauri error to short message.
 * A short message ignores keywords and print error reason only.
 * @param error Tauri error.
 * @returns SHort message
 */
export const toShortMessage = (error: TauriError) => {
  switch (error.kind) {
    case TauriErrorKind.Internal:
      return "Interval Error";
    case TauriErrorKind.FFmpegNotFound:
      return "ffmpeg not found";
    case TauriErrorKind.FFprobeNotFound:
      return "ffprobe not found";
    case TauriErrorKind.FFmpegUnavailable:
      return "ffmpeg unavailabled";
    case TauriErrorKind.FFprobeUnavailable:
      return "ffprobe unavailabled";
    case TauriErrorKind.DirectoryNotFound:
      return "directory not found";
  }
};
