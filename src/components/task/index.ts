import { cloneDeep } from "lodash";
import { v4 } from "uuid";
import { Preset } from "../../store/preset";
import { ParamsSource, TaskInputParams, TaskOutputParams } from "../../store/task";

export type EditableTaskParams = {
  id: string;
  path?: string;
  /**
   * Params source selection.
   * If it is a string value, it points to a preset id.
   */
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  /**
   * Custom params input field. If `selection` is not {@link ParamsSource.Custom}, `undefined`.
   */
  custom?: string;
};

/**
 * Converts {@link EditableTaskParams} to {@link TaskInputParams} or {@link TaskOutputParams}
 *
 * @param params {@link EditableTaskParams}
 * @param presets Presets
 * @returns a {@link TaskInputParams} or {@link TaskOutputParams}
 */
export const toTaskParams = (
  { selection, path, custom }: Omit<EditableTaskParams, "id">,
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
 * to {@link EditableTaskParams} or {@link EditableTaskParams}
 * @param params {@link TaskInputParams} or {@link TaskOutputParams}
 * @param presets Presets
 * @returns a {@link EditableTaskParams} or {@link EditableTaskParams}
 */
export const fromTaskParams = (
  { path, source, params }: Omit<TaskInputParams, "id"> | Omit<TaskOutputParams, "id">,
  presets: Preset[]
): EditableTaskParams => {
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
