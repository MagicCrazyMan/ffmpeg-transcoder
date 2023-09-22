import { Divider, InputTag, Radio } from "@arco-design/web-react";
import { ExtensionFilterState } from "./constants";

type ExtensionFilterProps = {
  extensions: string[];
  onExtensionsChanged: (extensions: string[]) => void;
  filterState: ExtensionFilterState;
  onFilterStateChanged: (type: ExtensionFilterState) => void;
  className?: string;
};

/**
 * Extension filter
 * @param param0 Extension filter props
 */
export default function ExtensionFilter({
  extensions,
  onExtensionsChanged,
  filterState,
  onFilterStateChanged,
  className,
}: ExtensionFilterProps) {
  const setLowercaseExtensions = (extensions: string[]) => {
    const lowercases = extensions.map((extension) => extension.toLocaleLowerCase());
    const filtered = new Set(lowercases);
    onExtensionsChanged(Array.from(filtered));
  };

  return (
    <div className={className}>
      <Divider style={{ margin: "0 0 0.5rem 0" }} orientation="left">
        Extension Filters
      </Divider>
      <Radio.Group
        type="button"
        className="mb-4"
        value={filterState}
        onChange={onFilterStateChanged}
      >
        <Radio value={ExtensionFilterState.Whitelist}>Whitelist</Radio>
        <Radio value={ExtensionFilterState.Disabled}>Disabled</Radio>
        <Radio value={ExtensionFilterState.Blacklist}>Blacklist</Radio>
      </Radio.Group>
      <InputTag
        allowClear
        saveOnBlur
        placeholder="Extensions"
        value={extensions}
        onChange={setLowercaseExtensions}
        readOnly={filterState === ExtensionFilterState.Disabled}
      ></InputTag>
    </div>
  );
}
