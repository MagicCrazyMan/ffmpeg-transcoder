import { cloneDeep } from "lodash";
import { Preset } from "../../store/preset";
import { ParamsSource, TaskInputParams, TaskOutputParams } from "../../store/task";

export type EditableTaskInputParams = {
  id: string;
  path: string;
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string;
};

export type EditableTaskOutputParams = {
  id: string;
  path?: string;
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string;
};

/**
 * Converts {@link EditableTaskInputParams} or {@link EditableTaskOutputParams}
 * to {@link TaskInputParams} or {@link TaskOutputParams}
 * @param params {@link EditableTaskInputParams} or {@link EditableTaskOutputParams}
 * @param presets Presets
 * @returns a {@link TaskInputParams} or {@link TaskOutputParams}
 */
export const toTaskParams = (
  { selection, path, custom }: EditableTaskInputParams | EditableTaskOutputParams,
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
