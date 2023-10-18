import { ParamsSource } from "../../store/task";

export type TaskParamsModifyingValue = {
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
