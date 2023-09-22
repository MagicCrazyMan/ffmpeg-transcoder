/**
 * Extension filter status
 */
export enum ExtensionFilterStatus {
  Whitelist = 0,
  Disabled = 1,
  Blacklist = 2,
}

/**
 * Regular filter
 */
export type RegularFilterValue = {
    id: string;
    value?: string;
    enabled: boolean;
    blacklist: boolean;
    regex: boolean;
    applyDirectory: boolean;
    applyFile: boolean;
  };