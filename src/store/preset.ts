import { create } from "zustand";

export type PresetStoreState = {
  /**
   * Presets
   */
  presets: Preset[];
  /**
   * Adds a new preset.
   * @param type Preset type
   * @param name Preset name
   * @param params Preset params
   * @param remark Preset remark, optional
   */
  addPreset: (type: PresetType, name: string, params: string[], remark?: string) => void;
  /**
   * Updates a existing preset
   * @param name Preset name
   * @param preset Partial preset data that should be updated.
   */
  updatePreset: (name: string, preset: Partial<Omit<Preset, "name">>) => void;
  /**
   * Removes a existing preset
   * @param name Preset name
   */
  removePreset: (name: string) => void;
};

export enum PresetType {
  Universal = 0,
  Decode = 1,
  Encode = 2,
}

export type Preset = {
  type: PresetType;
  name: string;
  params: string[];
  remark?: string;
};

export const usePresetStore = create<PresetStoreState>((set) => {
  const presets: Preset[] = [];

  const addPreset = (type: PresetType, name: string, params: string[], remark?: string) => {
    presets.push({
      type,
      name,
      params,
      remark,
    });
    set({ presets: [...presets] });
  };

  const updatePreset = (name: string, preset: Partial<Omit<Preset, "name">>) => {
    const index = presets.findIndex((preset) => preset.name === name);
    if (index !== -1) {
      presets[index] = {
        ...presets[index],
        ...preset,
        name,
      };
      set({ presets: [...presets] });
    }
  };

  const removePreset = (name: string) => {
    const index = presets.findIndex((preset) => preset.name === name);
    if (index !== -1) {
      presets.splice(index, 1);
      set({ presets: [...presets] });
    }
  };

  return {
    presets,
    addPreset,
    updatePreset,
    removePreset,
  };
});
