import { Divider, InputTag, Radio } from "@arco-design/web-react";
import { ExtensionFilterState, useSearchStore } from "../../store/search";

/**
 * Extension filter
 * @param param0 Extension filter props
 */
export default function ExtensionFilter() {
  const { extensionFilters, setExtensionFilterState, setExtensionList } = useSearchStore(
    (state) => state
  );

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
        value={extensionFilters.state}
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
        value={extensionFilters.extensions}
        onChange={setExtensionList}
      ></InputTag>
    </div>
  );
}
