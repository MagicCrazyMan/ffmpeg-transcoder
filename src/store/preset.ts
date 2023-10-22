import { v4 } from "uuid";
import { create } from "zustand";
import { Preset } from "../libs/preset";

export type PresetStoreState = {
  /**
   * Data that persisted inside local storage.
   */
  storage: PresetStorage;
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
   * Adds a new preset.
   * @param preset Preset
   */
  addPreset: (preset: Preset) => void;
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
};

type PresetStorage = {
  defaultDecode?: string;
  defaultEncode?: string;
  presets: Preset[];
};

const PRESETS_LOCALSTORAGE_KEY = "presets";

/**
 * Stores presets storage into local storage
 * @param storage Storage data
 */
const storePresetStorage = (storage: PresetStorage) => {
  localStorage.setItem(PRESETS_LOCALSTORAGE_KEY, JSON.stringify(storage));
};

/**
 * Loads presets storage from local storage.
 */
const loadPresetStorage = (): PresetStorage => {
  const defaultStorage = {
    presets: [],
  };

  const raw = localStorage.getItem(PRESETS_LOCALSTORAGE_KEY);
  if (!raw) return defaultStorage;

  const loaded: PresetStorage = JSON.parse(raw);

  // verifies defaultDecode and defaultEncode id
  if (loaded.defaultDecode)
    loaded.defaultDecode = loaded.presets.find((preset) => preset.id === loaded.defaultDecode)
      ? loaded.defaultDecode
      : undefined;
  if (loaded.defaultEncode)
    loaded.defaultEncode = loaded.presets.find((preset) => preset.id === loaded.defaultEncode)
      ? loaded.defaultEncode
      : undefined;

  return {
    ...defaultStorage,
    ...loaded,
  };
};

export const usePresetStore = create<PresetStoreState>((set, _oget, api) => {
  const storage = loadPresetStorage();

  /**
   * Subscribes state change event,
   * stores presets into local storage if presets changed.
   */
  api.subscribe((state, prevState) => {
    if (state.storage !== prevState.storage) storePresetStorage(state.storage);
  });

  return {
    storage,
    setDefaultDecode(defaultDecode?: string) {
      set(({ storage }) => ({ storage: { ...storage, defaultDecode } }));
    },
    setDefaultEncode(defaultEncode?: string) {
      set(({ storage }) => ({ storage: { ...storage, defaultEncode } }));
    },
    addPreset(preset: Preset) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          presets: [...storage.presets, preset],
        },
      }));
    },
    duplicatePreset(id: string) {
      set(({ storage }) => {
        const presets = storage.presets.reduce((nPresets, preset) => {
          nPresets.push(preset);
          // duplicate new preset right next to target preset
          if (preset.id === id) {
            nPresets.push({
              ...preset,
              id: v4(),
              name: preset.name,
            });
          }

          return nPresets;
        }, [] as Preset[]);

        return { storage: { ...storage, presets } };
      });
    },
    movePreset(from: number, to: number) {
      if (from === to) return;

      set(({ storage }) => {
        let presets: Preset[];
        if (from > to) {
          presets = [
            ...storage.presets.slice(0, to),
            storage.presets[from],
            ...storage.presets.slice(to, from),
            ...storage.presets.slice(from + 1),
          ];
        } else {
          presets = [
            ...storage.presets.slice(0, from),
            ...storage.presets.slice(from + 1, to + 1),
            storage.presets[from],
            ...storage.presets.slice(to + 1),
          ];
        }
        return { storage: { ...storage, presets } };
      });
    },
    updatePreset(id: string, preset: Partial<Preset>) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          presets: storage.presets.map((p) => (p.id === id ? { ...p, ...preset } : p)),
        },
      }));
    },
    removePreset(id: string) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          presets: storage.presets.filter((p) => p.id !== id),
          defaultDecode: storage.defaultDecode === id ? undefined : storage.defaultDecode,
          defaultEncode: storage.defaultEncode === id ? undefined : storage.defaultEncode,
        },
      }));
    },
  };
});
