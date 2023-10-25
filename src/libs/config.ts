import { DialogFilter } from "@tauri-apps/api/dialog";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TaskArgsSource } from "./task";

/**
 * Theme color mode.
 */
export enum Theme {
  /**
   * Follows system theme.
   */
  FollowSystem = "0",
  /**
   * Uses dark theme and saves to local storage.
   */
  Light = "1",
  /**
   * Uses light theme and saves to local storage.
   */
  Dark = "2",
}

/**
 * File filters by media types
 */
export type OpenFileFilters = {
  videos: string[];
  audios: string[];
  images: string[];
  subtitles: string[];
  text: string[];
};

export enum LogLevel {
  Off = "OFF",
  Error = "ERROR",
  Warn = "WARN",
  Info = "INFO",
  Debug = "DEBUG",
  Trace = "TRACE",
}

/**
 * App configuration
 */
export type Configuration = {
  /**
   * FFmpeg binary program
   */
  loglevel: LogLevel;
  /**
   * FFmpeg binary program
   */
  ffmpeg: string;
  /**
   * FFprobe binary program
   */
  ffprobe: string;
  /**
   * Hardware acceleration for {@link TaskArgsSource.Auto} codec
   */
  hwaccel?: string;
  /**
   * Theme
   */
  theme: Theme;
  /**
   * Maximum running tasks
   */
  maxRunning: number;
  /**
   * Default save directory, optional
   */
  saveDirectory?: string;
  /**
   * File filters for open dialog
   */
  openFileFilters: OpenFileFilters;
  /**
   * File filters for save dialog
   */
  saveFileFilters: DialogFilter[];
};
