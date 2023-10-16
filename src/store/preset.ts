import { v4 } from "uuid";
import { create } from "zustand";

export type PresetStoreState = {
  /**
   * Presets
   */
  presets: Preset[];
  /**
   * Default preset id for decoding
   */
  defaultDecode?: string;
  /**
   * Default preset id for encoding
   */
  defaultEncode?: string;
  /**
   * Sets default preset id for decoding
   * @param id Preset id
   */
  setDefaultDecode: (id?: string) => void;
  /**
   * Sets default preset id for encoding
   * @param id Preset id
   */
  setDefaultEncode: (id?: string) => void;
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
  movePreset: (i1: number, i2: number) => void;
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

type PresetStorage = {
  defaultDecode?: string;
  defaultEncode?: string;
  presets: Preset[];
};

const PRESETS_LOCALSTORAGE_KEY = "presets";

/**
 * Stores presets into local storage
 * @param storage Storage data
 */
const storePresetStorage = (storage: PresetStorage) => {
  localStorage.setItem(PRESETS_LOCALSTORAGE_KEY, JSON.stringify(storage));
};

/**
 * Loads presets from local storage
 */
const loadPresetStorage = (): PresetStorage => {
  const raw = localStorage.getItem(PRESETS_LOCALSTORAGE_KEY);
  if (raw) {
    const storage = JSON.parse(raw) as PresetStorage;
    let changed = false;
    storage.presets.forEach((preset) => {
      if (!preset.id) {
        preset.id = v4();
        changed = true;
      }
    });

    if (changed) {
      storePresetStorage(storage);
    }

    return storage;
  } else {
    return {
      presets: [],
    };
  }
};

export const usePresetStore = create<PresetStoreState>((set, get, api) => {
  const { presets, defaultDecode, defaultEncode } = loadPresetStorage();

  /**
   * Subscribes state change event,
   * stores presets into local storage if presets changed.
   */
  api.subscribe((state, prevState) => {
    if (
      state.presets !== prevState.presets ||
      state.defaultDecode !== prevState.defaultDecode ||
      state.defaultEncode !== prevState.defaultEncode
    ) {
      storePresetStorage({
        presets: state.presets,
        defaultDecode: state.defaultDecode,
        defaultEncode: state.defaultEncode,
      });
    }
  });

  const setDefaultDecode = (id?: string) => {
    set({ defaultDecode: id });
  };
  const setDefaultEncode = (id?: string) => {
    set({ defaultEncode: id });
  };

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

  const movePreset = (from: number, to: number) => {
    if (from === to) return;

    set((state) => {
      let presets: Preset[];
      if (from > to) {
        presets = [
          ...state.presets.slice(0, to),
          state.presets[from],
          ...state.presets.slice(to, from),
          ...state.presets.slice(from + 1),
        ];
      } else {
        presets = [
          ...state.presets.slice(0, from),
          ...state.presets.slice(from + 1, to + 1),
          state.presets[from],
          ...state.presets.slice(to + 1),
        ];
      }
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
      defaultDecode: state.defaultDecode === id ? undefined : state.defaultDecode,
      defaultEncode: state.defaultEncode === id ? undefined : state.defaultEncode,
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

    if (!tempPreset || !tempPreset.name) return;
    set((state) => ({
      presets: [
        ...state.presets,
        {
          id: tempPreset.id,
          name: tempPreset.name,
          type: tempPreset.type,
          params: tempPreset.params,
          remark: tempPreset.remark,
        },
      ],
      tempPreset: undefined,
    }));
  };

  return {
    presets,
    defaultDecode,
    defaultEncode,
    setDefaultDecode,
    setDefaultEncode,
    duplicatePreset,
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
