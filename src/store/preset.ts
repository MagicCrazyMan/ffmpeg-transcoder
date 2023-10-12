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
   * Swaps two presets by ids
   * @param i1 Index of preset 1
   * @param i2 Index of preset 2
   */
  swapPreset: (i1: number, i2: number) => void;
  /**
   * Copies a existing preset, and gives it a new name.
   * @param id Preset id
   */
  duplicatePreset: (id: string) => void;
  /**
   * Updates a existing preset
   * @param id Preset id
   * @param preset Partial preset data that should be updated
   */
  updatePreset: (id: string, preset: Partial<Preset>) => void;
  /**
   * Removes a existing preset
   * @param id Preset id
   */
  removePreset: (id: string) => void;
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

  const duplicatePreset = (id: string) => {
    set((state) => {
      const presets = state.presets.reduce((v, p) => {
        v.push(p);
        // duplicate new preset right next to target preset
        if (p.id === id) {
          v.push({
            ...p,
            id: v4(),
            name: `${p.name} (2)`,
          });
        }

        return v;
      }, [] as Preset[]);

      return { presets };
    });
  };

  const swapPreset = (i1: number, i2: number) => {
    set((state) => {
      const presets = state.presets.map((p, i) => {
        if (i === i1) {
          return state.presets[i2];
        } else if (i === i2) {
          return state.presets[i1];
        } else {
          return p;
        }
      });
      return { presets };
    });
  };

  const updatePreset = (id: string, preset: Partial<Preset>) => {
    set((state) => ({
      presets: state.presets.map((p) => (p.id === id ? { ...p, ...preset } : p)),
    }));
  };

  const removePreset = (id: string) => {
    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
    }));
  };

  const tempPreset = undefined as Preset | undefined;

  const enableTempPreset = () => {
    set({
      tempPreset: {
        id: v4(),
        name: "",
        type: PresetType.Universal,
        params: [],
        isTemp: true,
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
    duplicatePreset,
    swapPreset,
    updatePreset,
    removePreset,
    tempPreset,
    enableTempPreset,
    disableTempPreset,
    updateTempPreset,
    persistTempPreset,
  };
});
