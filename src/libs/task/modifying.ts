import { cloneDeep } from "lodash";
import { v4 } from "uuid";
import { TaskArgsItem, TaskArgsSource } from ".";
import { usePresetStore } from "../../store/preset";
import { Preset } from "../preset";

export type ModifyingTaskArgs = {
  id: string;
  inputArgs: ModifyingTaskArgsItem[];
  outputArgs: ModifyingTaskArgsItem[];
};

export type ModifyingTaskArgsItem = {
  id: string;
  path?: string;
  /**
   * Arguments source selection.
   */
  selection: TaskArgsSource.Auto | TaskArgsSource.Custom | Preset;
  /**
   * Custom args input field. If `selection` is not {@link TaskArgsSource.Custom}, `undefined`.
   */
  custom?: string;
};

/**
 * Converts {@link ModifyingTaskArgsItem} to {@link TaskArgsItem}
 *
 * @param args {@link ModifyingTaskArgsItem}
 * @returns a {@link TaskArgsItem}
 */
export const toTaskArgs = ({ selection, path, custom }: ModifyingTaskArgsItem): TaskArgsItem => {
  let source: TaskArgsSource, args: string[] | Preset | undefined;
  if (selection === TaskArgsSource.Auto) {
    source = TaskArgsSource.Auto;
    args = undefined;
  } else if (selection === TaskArgsSource.Custom) {
    source = TaskArgsSource.Custom;
    args = custom?.split(" ").filter((param) => !!param.trim());
  } else {
    const preset = usePresetStore
      .getState()
      .storage.presets.find((preset) => preset.id === selection.id);
    if (preset) {
      source = TaskArgsSource.FromPreset;
      args = cloneDeep(preset);
    } else {
      source = TaskArgsSource.Auto;
      args = undefined;
    }
  }

  return {
    path,
    source,
    args,
  } as TaskArgsItem;
};

/**
 * Converts {@link TaskArgsItem} or {@link ModifyingTaskArgsItem}.
 *
 * @param args {@link TaskArgsItem}
 * @returns a {@link ModifyingTaskArgsItem}
 */
export const fromTaskArgs = ({ path, source, args }: TaskArgsItem): ModifyingTaskArgsItem => {
  switch (source) {
    case TaskArgsSource.Auto:
      return {
        id: v4(),
        path,
        selection: TaskArgsSource.Auto,
      };
    case TaskArgsSource.Custom:
      return {
        id: v4(),
        path,
        selection: TaskArgsSource.Custom,
        custom: (args as string[]).join(" "),
      };
    case TaskArgsSource.FromPreset: {
      const preset = usePresetStore
        .getState()
        .storage.presets.find((preset) => preset.id === (args as Preset).id);
      if (preset) {
        return {
          id: v4(),
          path,
          selection: preset,
        };
      } else {
        return {
          id: v4(),
          path,
          selection: TaskArgsSource.Custom,
          custom: (args as Preset).args.join(" "),
        };
      }
    }
  }
};

/**
 * Tries to replace extension of a path by preset:
 *
 * - If a path is empty or preset does not specify an extension, returns path;
 * - If a path has no extension, returns a new path with an additional extension
 * - If a path has extension, returns a new path with a replacement extension
 *
 * @param path Path
 * @param preset Preset
 * @returns Path
 */
export const replaceExtension = (path: string, preset: Preset) => {
  if (!path || !preset.extension) return path;

  const splits = path.split(".");
  if (splits.length === 0) {
    return path;
  } else if (splits.length === 1) {
    return `${path}.${preset.extension}`;
  } else {
    splits.pop();
    return `${splits.join(".")}.${preset.extension}`;
  }
};
