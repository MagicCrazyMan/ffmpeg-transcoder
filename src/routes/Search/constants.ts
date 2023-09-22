/**
 * Extension filter state
 */
export enum ExtensionFilterState {
  Whitelist = 0,
  Disabled = 1,
  Blacklist = 2,
}

/**
 * Regular filter data
 */
export type RegularFilterData = {
  id: string;
  value?: string;
  enabled: boolean;
  blacklist: boolean;
  regex: boolean;
  applyDirectory: boolean;
  applyFile: boolean;
};
