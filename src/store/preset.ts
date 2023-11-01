import { v4, validate } from "uuid";
import { create } from "zustand";
import { Preset, PresetType } from "../libs/preset";

export type PresetStoreState = {
  /**
   * Data that persist inside local storage.
   */
  storage: PresetStorage;
  /**
   * Default preset for decoding, sync from default decode id in storage
   */
  defaultDecode?: Preset;
  /**
   * Default preset for encoding, sync from default decode id in storage
   */
  defaultEncode?: Preset;
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
  /**
   * Imports presets from object.
   * Error throws if object is not a valid {@link PresetStorage} object.
   *
   * @param input Object
   * @param override Override or append to current presets
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importPresets: (input: any, override: boolean) => void;
};

type PresetStorage = {
  /**
   * Default preset id for decoding
   */
  defaultDecodeId?: string;
  /**
   * Default preset id for encoding
   */
  defaultEncodeId?: string;
  /**
   * Presets list
   */
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
const loadPresetStorage = (): {
  defaultDecode?: Preset;
  defaultEncode?: Preset;
  storage: PresetStorage;
} => {
  const defaultStorage: PresetStorage = {
    presets: [],
  };

  const raw = localStorage.getItem(PRESETS_LOCALSTORAGE_KEY);
  if (!raw) return { storage: defaultStorage };

  const loaded: PresetStorage = JSON.parse(raw);

  // verifies defaultDecode and defaultEncode id
  let defaultDecode: Preset | undefined, defaultEncode: Preset | undefined;
  if (loaded.defaultDecodeId) {
    defaultDecode = loaded.presets.find((preset) => preset.id === loaded.defaultDecodeId);
  }
  if (loaded.defaultEncodeId) {
    defaultEncode = loaded.presets.find((preset) => preset.id === loaded.defaultEncodeId);
  }

  return {
    defaultDecode,
    defaultEncode,
    storage: {
      ...defaultStorage,
      ...loaded,
    },
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const verify = (input: any, currentPresets?: Preset[]) => {
  const exists = new Set(currentPresets?.map(({ id }) => id));

  const maps = new Map<string, Preset>();
  let defaultDecodeId: string | undefined;
  let defaultEncodeId: string | undefined;
  let presets: Preset[] | undefined;
  for (const [k, v] of Object.entries(input)) {
    switch (k) {
      case "defaultDecodeId": {
        if (typeof v === "string" && validate(v)) {
          defaultDecodeId = v;
          break;
        } else {
          throw new Error(`invalid default decode preset id ${v}`);
        }
      }
      case "defaultEncodeId": {
        if (typeof v === "string" && validate(v)) {
          defaultEncodeId = v;
          break;
        } else {
          throw new Error(`invalid default encode preset id ${v}`);
        }
      }
      case "presets": {
        if (!Array.isArray(v)) throw new Error(`invalid presets list`);
        for (let i = 0; i < v.length; i++) {
          const item = v[i];

          if (typeof item["id"] !== "string" || !validate(item["id"]))
            throw new Error(`invalid id of preset at index ${i}`);

          if (maps.has(item["id"]) || exists.has(item["id"]))
            throw new Error(`duplicated id of preset at index ${i}`);

          if (
            item["type"] !== PresetType.Decode &&
            item["type"] !== PresetType.Encode &&
            item["type"] !== PresetType.Universal
          )
            throw new Error(`invalid type of preset at index ${i}`);

          if (typeof item["id"] !== "string" || !validate(item["id"]))
            throw new Error(`invalid id of preset at index ${i}`);

          if (typeof item["name"] !== "undefined" && typeof item["name"] !== "string")
            throw new Error(`invalid name of preset at index ${i}`);

          if (!Array.isArray(item["args"])) throw new Error(`invalid args of preset at index ${i}`);

          if (typeof item["remark"] !== "undefined" && typeof item["remark"] !== "string")
            throw new Error(`invalid remark of preset at index ${i}`);

          if (typeof item["extension"] !== "undefined" && typeof item["extension"] !== "string")
            throw new Error(`invalid extension of preset at index ${i}`);

          maps.set(item["id"], item);
        }
        presets = v;

        break;
      }
      default:
        console.warn(`unknown field ${k}`);
        break;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {
    storage: {
      presets,
    },
  };

  let defaultDecode: Preset | undefined;
  let defaultEncode: Preset | undefined;
  if (defaultDecodeId) {
    defaultDecode = maps.get(defaultDecodeId);
    if (!defaultDecode)
      throw new Error(`default decode preset with id ${defaultDecodeId} not found in presets list`);

    result.storage.defaultDecodeId = defaultDecodeId;
    result.defaultDecode = defaultDecode;
  }
  if (defaultEncodeId) {
    defaultEncode = maps.get(defaultEncodeId);
    if (!defaultEncode)
      throw new Error(`default encode preset with id ${defaultEncodeId} not found in presets list`);

    result.storage.defaultEncodeId = defaultEncodeId;
    result.defaultEncode = defaultEncode;
  }

  return result as { storage: PresetStorage; defaultDecode?: Preset; defaultEncode?: Preset };
};

export const usePresetStore = create<PresetStoreState>((set, get, api) => {
  const { storage, defaultDecode, defaultEncode } = loadPresetStorage();

  /**
   * Subscribes state change event,
   * stores presets into local storage if presets changed.
   */
  api.subscribe((state, prevState) => {
    if (state.storage !== prevState.storage) storePresetStorage(state.storage);
  });

  return {
    storage,
    defaultDecode,
    defaultEncode,
    setDefaultDecode(id) {
      set(({ storage }) => ({
        storage: { ...storage, defaultDecodeId: id },
        defaultDecode: storage.presets.find((preset) => preset.id === id),
      }));
    },
    setDefaultEncode(id) {
      set(({ storage }) => ({
        storage: { ...storage, defaultEncodeId: id },
        defaultEncode: storage.presets.find((preset) => preset.id === id),
      }));
    },
    addPreset(preset) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          presets: [...storage.presets, preset],
        },
      }));
    },
    duplicatePreset(id) {
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
    movePreset(from, to) {
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
    updatePreset(id, preset) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          presets: storage.presets.map((p) => (p.id === id ? { ...p, ...preset } : p)),
        },
      }));
    },
    removePreset(id) {
      set(({ storage }) => ({
        storage: {
          ...storage,
          presets: storage.presets.filter((p) => p.id !== id),
          defaultDecodeId: storage.defaultDecodeId === id ? undefined : storage.defaultDecodeId,
          defaultEncodeId: storage.defaultEncodeId === id ? undefined : storage.defaultEncodeId,
        },
      }));
    },
    importPresets(input, override) {
      const { storage, defaultDecode, defaultEncode } = verify(
        input,
        override ? undefined : get().storage.presets
      );
      set((state) => ({
        ...state,
        storage: {
          ...state.storage,
          ...storage,
          presets: override ? storage.presets : [...state.storage.presets, ...storage.presets],
        },
        defaultDecode,
        defaultEncode,
      }));
    },
  };
});
