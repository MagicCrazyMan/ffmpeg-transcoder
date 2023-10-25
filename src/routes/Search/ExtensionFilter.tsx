import { Divider, InputTag, Radio } from "@arco-design/web-react";
import { ExtensionFilterState } from "../../libs/search/extension_filter";
import { useSearchStore } from "../../store/search";

/**
 * Extension filter
 */
export default function ExtensionFilter() {
  const { storage, setExtensionFilterState, setExtensionList } = useSearchStore((state) => state);

  return (
    <div>
      <Divider style={{ margin: "0 0 0.5rem 0" }} orientation="left">
        Extension Filter
      </Divider>

      {/* Toggle Extension Filter State */}
      <Radio.Group
        className="mb-4"
        size="mini"
        type="button"
        value={storage.extensionFilters.state}
        onChange={setExtensionFilterState}
      >
        <Radio value={ExtensionFilterState.Whitelist}>Whitelist</Radio>
        <Radio value={ExtensionFilterState.Disabled}>Disabled</Radio>
        <Radio value={ExtensionFilterState.Blacklist}>Blacklist</Radio>
      </Radio.Group>

      {/* Extension Tag Input */}
      <InputTag
        allowClear
        saveOnBlur
        size="mini"
        placeholder="Extensions"
        value={storage.extensionFilters.extensions}
        onChange={setExtensionList}
      ></InputTag>
    </div>
  );
}
