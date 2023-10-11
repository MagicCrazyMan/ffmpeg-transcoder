import { v4 } from "uuid";
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
  // Useless since new presets are only created from `persistTempPreset`
  //
  // /**
  //  * Adds a new preset.
  //  * @param type Preset type
  //  * @param name Preset name
  //  * @param params Preset params
  //  * @param remark Preset remark, optional
  //  */
  // addPreset: (type: PresetType, name: string, params: string[], remark?: string) => void;
  /**
   * Moves a preset from old index to new index
   * @param newIndex New index
   * @param oldIndex Old index
   */
  movePreset: (newIndex: number, oldIndex: number) => void;
  /**
   * Updates a existing preset
   * @param index Preset index
   * @param preset Partial preset data that should be updated
   */
  updatePreset: (index: number, preset: Partial<Omit<Preset, "name">>) => void;
  /**
   * Removes a existing preset
   * @param index Preset index
   */
  removePreset: (index: number) => void;
  /**
   * Enables temporary preset
   */
  enableTempPreset: () => void;
  /**
   * Disables temporary preset and discards all values
   */
  disableTempPreset: () => void;
  /**
   * Updates temporary preset
   * @param preset Partial preset values
   */
  updateTempPreset: (preset: Partial<Preset>) => void;
  /**
   * Persists temporary preset and adds it into presets list
   * Values of temporary preset will be cleaned
   */
  persistTempPreset: () => void;
};

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
  isTemp?: true;
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
    const presets = JSON.parse(raw) as Preset[];
    let changed = false;
    presets.forEach((preset) => {
      if (!preset.id) {
        preset.id = v4();
        changed = true;
      }
    });

    if (changed) {
      storePresets(presets);
    }

    return presets;
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

  // const addPreset = (type: PresetType, name: string, params: string[], remark?: string) => {
  //   const newPreset: Preset = {
  //     id: v4(),
  //     type,
  //     name,
  //     params,
  //     remark,
  //   };
  //   set({ presets: [...get().presets, newPreset] });
  // };

  const movePreset = (newIndex: number, oldIndex: number) => {
    const presets = get().presets;
    if (newIndex > presets.length - 1 || oldIndex > presets.length - 1) return;

    const preset = presets[oldIndex];
    presets[oldIndex] = presets[newIndex];
    presets[newIndex] = preset;
    set({ presets: [...presets] });
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
        id: v4(),
        isTemp: true,
        name: "",
        type: PresetType.Universal,
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
    presets.push({
      id: tempPreset.id,
      name: tempPreset.name,
      type: tempPreset.type,
      params: tempPreset.params,
      remark: tempPreset.remark,
    });
    set({ presets: [...presets], tempPreset: undefined });
  };

  return {
    presets,
    // addPreset,
    movePreset,
    updatePreset,
    removePreset,
    tempPreset,
    enableTempPreset,
    disableTempPreset,
    updateTempPreset,
    persistTempPreset,
  };
});
