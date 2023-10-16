import { ParamsSource } from "../../store/task";

export type EditableTaskInputParams = {
  id: string;
  path: string;
  selection: ParamsSource.Auto | ParamsSource.Custom | string;
  custom?: string;
};

export type EditableTaskOutputParams = {
  id: string;
  path?: string;
  selection: ParamsSource.Custom | string;
  custom?: string;
};
