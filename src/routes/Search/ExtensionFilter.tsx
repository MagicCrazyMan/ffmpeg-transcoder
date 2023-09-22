import { Divider, Radio, InputTag } from "@arco-design/web-react";
import { ExtensionFilterStatus } from "./constants";

type ExtensionFilterProps = {
  extensions: string[];
  onExtensionsChanged: (extensions: string[]) => void;
  filterStatus: ExtensionFilterStatus;
  onFilterStatusChanged: (type: ExtensionFilterStatus) => void;
  className?: string;
};

/**
 * Extension filter
 * @param param0 Extension filter props
 */
export default function ExtensionFilter({
  extensions,
  onExtensionsChanged,
  filterStatus,
  onFilterStatusChanged,
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
        value={filterStatus}
        onChange={onFilterStatusChanged}
      >
        <Radio value={ExtensionFilterStatus.Whitelist}>Whitelist</Radio>
        <Radio value={ExtensionFilterStatus.Disabled}>Disabled</Radio>
        <Radio value={ExtensionFilterStatus.Blacklist}>Blacklist</Radio>
      </Radio.Group>
      <InputTag
        allowClear
        saveOnBlur
        placeholder="Extensions"
        value={extensions}
        onChange={setLowercaseExtensions}
        readOnly={filterStatus === ExtensionFilterStatus.Disabled}
      ></InputTag>
    </div>
  );
}
