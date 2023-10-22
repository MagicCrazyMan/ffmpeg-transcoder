export enum PresetType {
  Universal = 0,
  Decode = 1,
  Encode = 2,
}

export type Preset = {
  id: string;
  type: PresetType;
  name: string;
  params: string[];
  remark?: string;
  extension?: string;
};