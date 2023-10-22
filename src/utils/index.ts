import dayjs, { Dayjs } from "dayjs";
import { cloneDeep } from "lodash";
import { v4 } from "uuid";
import { TaskParamsModifyingValue } from "../components/task";
import { Preset } from "../libs/preset";
import { ParamsSource, TaskInputParams, TaskOutputParams } from "../store/task";

/**
 * Converts a numerical value in seconds to duration.
 * @param value Numerical value in seconds.
 * @param milliseconds Is show milliseconds
 */
export const toDuration = (value: number | string, milliseconds = true) => {
  const num = typeof value === "number" ? value : parseFloat(value);
  const hours = Math.floor(num / 3600);
  const mins = Math.floor((num / 60) % 60);

  if (milliseconds) {
    const secs = (num % 60).toFixed(3);
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(6, "0")}`;
  } else {
    const secs = (num % 60).toFixed(0);
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
};

/**
 * Converts a numerical value to file size.
 * @param value Numerical value.
 */
export const toFileSize = (value: number | string) => {
  const num = typeof value === "number" ? value : parseInt(value);
  if (num <= 1024) {
    return `${num} Bytes`;
  } else if (num <= 1024 * 1024) {
    return `${(num / 1024).toFixed(2)} KiB`;
  } else if (num <= 1024 * 1024 * 1024) {
    return `${(num / 1024 / 1024).toFixed(2)} MiB`;
  } else {
    return `${(num / 1024 / 1024 / 1024).toFixed(2)} GiB`;
  }
};

/**
 * Converts a numerical value to bitrate.
 * @param value Numerical value.
 */
export const toBitrate = (value: number | string) => {
  const num = typeof value === "number" ? value : parseInt(value);
  if (num <= 1000) {
    return `${num} bits/s`;
  } else if (num <= 1000 * 1000) {
    return `${(num / 1000).toFixed(2)} Kb/s`;
  } else if (num <= 1000 * 1000 * 1000) {
    return `${(num / 1000 / 1000).toFixed(2)} Mb/s`;
  } else {
    return `${(num / 1000 / 1000 / 1000).toFixed(2)} Gb/s`;
  }
};

/**
 * Sums up total cost time (in seconds) from durations range.
 * @param durations Durations range
 * @returns Total cost time in seconds
 */
export const sumCostTime = (durations: [Dayjs, Dayjs | undefined][]) => {
  return durations.reduce((cost, [start, end]) => {
    if (end) {
      return cost + end.diff(start, "seconds");
    } else {
      return cost + dayjs().diff(start, "seconds");
    }
  }, 0);
};

/**
 * Converts {@link TaskParamsModifyingValue} to {@link TaskInputParams} or {@link TaskOutputParams}
 *
 * @param params {@link TaskParamsModifyingValue}
 * @param presets Presets
 * @returns a {@link TaskInputParams} or {@link TaskOutputParams}
 */
export const toTaskParams = (
  { selection, path, custom }: Omit<TaskParamsModifyingValue, "id">,
  presets: Preset[]
) => {
  let source: ParamsSource, params: string[] | Preset | undefined;
  if (selection === ParamsSource.Auto) {
    source = ParamsSource.Auto;
    params = undefined;
  } else if (selection === ParamsSource.Custom) {
    source = ParamsSource.Custom;
    params = custom?.split(" ").filter((param) => !!param.trim());
  } else {
    source = ParamsSource.FromPreset;
    params = cloneDeep(presets.find((preset) => preset.id === selection)!);
  }

  return {
    path,
    source,
    params,
  } as TaskInputParams | TaskOutputParams;
};

/**
 * Converts {@link TaskInputParams} or {@link TaskOutputParams}
 * to {@link TaskParamsModifyingValue} or {@link TaskParamsModifyingValue}
 * @param params {@link TaskInputParams} or {@link TaskOutputParams}
 * @param presets Presets
 * @returns a {@link TaskParamsModifyingValue} or {@link TaskParamsModifyingValue}
 */
export const fromTaskParams = (
  { path, source, params }: Omit<TaskInputParams, "id"> | Omit<TaskOutputParams, "id">,
  presets: Preset[]
): TaskParamsModifyingValue => {
  switch (source) {
    case ParamsSource.Auto:
      return {
        id: v4(),
        path,
        selection: ParamsSource.Auto,
      };
    case ParamsSource.Custom:
      return {
        id: v4(),
        path,
        selection: ParamsSource.Custom,
        custom: (params as string[]).join(" "),
      };
    case ParamsSource.FromPreset: {
      const preset = presets.find((preset) => preset.id === (params as Preset).id);
      if (preset) {
        return {
          id: v4(),
          path,
          selection: preset.id,
        };
      } else {
        return {
          id: v4(),
          path,
          selection: ParamsSource.Custom,
          custom: (params as Preset).params.join(" "),
        };
      }
    }
  }
};
