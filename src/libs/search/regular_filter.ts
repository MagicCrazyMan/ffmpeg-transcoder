/**
 * Regular filter
 */
export type RegularFilter = {
  /**
   * Regular filter id
   */
  id: string;
  /**
   * Regular filter value
   */
  value?: string;
  /**
   * Enabled
   */
  enabled: boolean;
  /**
   * Filters as blacklist
   */
  blacklist: boolean;
  /**
   * Uses as regex
   */
  regex: boolean;
  /**
   * Apply on directory name
   */
  directory: boolean;
  /**
   * Apply on file name
   */
  file: boolean;
};
