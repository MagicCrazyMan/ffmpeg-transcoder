import { cloneDeep } from "lodash";
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
  { selection, path, custom }: EditableTaskParams,
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
