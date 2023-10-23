import { TaskParamsSource } from "../../libs/task";

export type TaskParamsModifyingValue = {
  id: string;
  path?: string;
  /**
   * Params source selection.
   * If it is a string value, it points to a preset id.
   */
  selection: TaskParamsSource.Auto | TaskParamsSource.Custom | string;
  /**
   * Custom params input field. If `selection` is not {@link TaskParamsSource.Custom}, `undefined`.
   */
  custom?: string;
};
