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
   * If it is a string value, it points to a preset id.
   */
  selection: TaskArgsSource.Auto | TaskArgsSource.Custom | string;
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
export function toTaskArgs({ selection, path, custom }: ModifyingTaskArgsItem): TaskArgsItem {
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
      .storage.presets.find((preset) => preset.id === selection);
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
}

/**
 * Converts {@link TaskArgsItem} or {@link ModifyingTaskArgsItem}.
 *
 * @param args {@link TaskArgsItem}
 * @returns a {@link ModifyingTaskArgsItem}
 */
export function fromTaskArgs({ path, source, args }: TaskArgsItem): ModifyingTaskArgsItem {
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
          selection: preset.id,
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
}
