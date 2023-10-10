import { create } from "zustand";

export type PresetStoreState = {
  /**
   * Presets
   */
  presets: Preset[];
  /**
   * Temporary preset for add new preset
   */
  tempPreset?: Preset;
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
   * @param index Preset index
   * @param preset Partial preset data that should be updated.
   */
  updatePreset: (index: number, preset: Partial<Omit<Preset, "name">>) => void;
  /**
   * Removes a existing preset
   * @param index Preset index
   */
  removePreset: (index: number) => void;
  enableTempPreset: () => void;
  disableTempPreset: () => void;
  updateTempPreset: (preset: Partial<Preset>) => void;
  persistTempPreset: () => void;
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

const PRESETS_LOCALSTORAGE_KEY = "presets";

/**
 * Stores presets to local storage
 * @param presets Presets
 */
const storePresets = (presets: Preset[]) => {
  localStorage.setItem(PRESETS_LOCALSTORAGE_KEY, JSON.stringify(presets));
};

/**
 * Loads presets from local storage
 */
const loadPresets = (): Preset[] => {
  const raw = localStorage.getItem(PRESETS_LOCALSTORAGE_KEY);
  if (raw) {
    return JSON.parse(raw);
  } else {
    return [];
  }
};

export const usePresetStore = create<PresetStoreState>((set, get, api) => {
  const presets: Preset[] = loadPresets();

  /**
   * Subscribes state change event,
   * stores presets into local storage if presets changed.
   */
  api.subscribe((state, prevState) => {
    if (state.presets !== prevState.presets) {
      storePresets(state.presets);
    }
  });

  const addPreset = (type: PresetType, name: string, params: string[], remark?: string) => {
    const newPreset = {
      type,
      name,
      params,
      remark,
    };
    set({ presets: [...get().presets, newPreset] });
  };

  const updatePreset = (index: number, preset: Partial<Preset>) => {
    const presets = get().presets;
    presets[index] = {
      ...presets[index],
      ...preset,
    };
    set({ presets: [...presets] });
  };

  const removePreset = (index: number) => {
    const presets = get().presets;
    presets.splice(index, 1);
    set({ presets: [...presets] });
  };

  const tempPreset = undefined as Preset | undefined;

  const enableTempPreset = () => {
    set({
      tempPreset: {
        name: "1111",
        type: PresetType.Encode,
        params: [],
      },
    });
  };

  const disableTempPreset = () => {
    set({ tempPreset: undefined });
  };

  const updateTempPreset = (preset: Partial<Preset>) => {
    const tempPreset = get().tempPreset;
    if (tempPreset) {
      set({ tempPreset: { ...tempPreset, ...preset } });
    }
  };

  const persistTempPreset = () => {
    const tempPreset = get().tempPreset;
    if (!tempPreset || !tempPreset.name || tempPreset.params.length === 0) return;

    const presets = get().presets;
    presets.push(tempPreset);
    set({ presets: [...presets], tempPreset: undefined });
  };

  return {
    presets,
    addPreset,
    updatePreset,
    removePreset,
    tempPreset,
    enableTempPreset,
    disableTempPreset,
    updateTempPreset,
    persistTempPreset,
  };
});
