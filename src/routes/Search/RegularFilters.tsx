import {
  Button,
  Checkbox,
  Divider,
  Input,
  Space,
  Switch,
  Tag,
  Tooltip,
} from "@arco-design/web-react";
import {
  IconCheck,
  IconClose,
  IconDelete,
  IconFile,
  IconFolder,
  IconInfoCircle,
  IconMinusCircle,
  IconPlus,
  IconQuote,
} from "@arco-design/web-react/icon";
import { useMemo } from "react";
import { RegularFilter, useSearchStore } from "../../store/search";

/**
 * Regular filter item
 */
const RegularFilterItem = ({ filter }: { filter: RegularFilter }) => {
  const { updateRegularFilter, removeRegularFilter } = useSearchStore();

  const isRegExpIncorrect = useMemo(() => {
    if (!filter.value || !filter.regex) return false;

    try {
      new RegExp(filter.value);
      return false;
    } catch {
      return true;
    }
  }, [filter]);

  return (
    <div className="mb-4">
      <div className="flex">
        {/* Input Field */}
        <Input
          size="small"
          className="mr-2"
          placeholder={filter.regex ? "Regular Expression" : "Filter Text"}
          status={isRegExpIncorrect ? "error" : undefined}
          suffix={
            isRegExpIncorrect ? (
              <Tooltip color="rgba(var(--danger-6))" content="Incorrect Regular Expression">
                <IconInfoCircle style={{ color: "rgba(var(--danger-6))", cursor: "pointer" }} />
              </Tooltip>
            ) : null
          }
          value={filter.value}
          onChange={(value) => updateRegularFilter(filter.id, { value })}
        ></Input>

        {/* Delete Item Button */}
        <Button
          size="mini"
          className="flex-shrink-0"
          shape="circle"
          type="outline"
          status="danger"
          icon={<IconDelete />}
          onClick={() => removeRegularFilter(filter.id)}
        ></Button>
      </div>

      {/* Controller BUttons */}
      <div className="flex">
        {/* Toggle Enable or Disable Toggler */}
        <Tooltip position="bottom" content="Enabled">
          <Checkbox
            className="p-0 m-0"
            checked={filter.enabled}
            onChange={() => updateRegularFilter(filter.id, { enabled: !filter.enabled })}
          >
            {({ checked }) => <Tag color={checked ? "arcoblue" : ""} icon={<IconCheck />}></Tag>}
          </Checkbox>
        </Tooltip>

        {/* Apply as Regular Expression Toggler */}
        <Tooltip position="bottom" content="Apply as Regular Expression">
          <Checkbox
            className="p-0 m-0"
            checked={filter.regex}
            onChange={() => updateRegularFilter(filter.id, { regex: !filter.regex })}
          >
            {({ checked }) => <Tag color={checked ? "arcoblue" : ""} icon={<IconQuote />}></Tag>}
          </Checkbox>
        </Tooltip>

        {/* Apply as Blacklist Toggler */}
        <Tooltip position="bottom" content="Apply as Blacklist">
          <Checkbox
            className="p-0 m-0"
            checked={filter.blacklist}
            onChange={() => updateRegularFilter(filter.id, { blacklist: !filter.blacklist })}
          >
            {({ checked }) => (
              <Tag color={checked ? "arcoblue" : ""} icon={<IconMinusCircle />}></Tag>
            )}
          </Checkbox>
        </Tooltip>

        {/* Apply on Directory Toggler */}
        <Tooltip position="bottom" content="Apply on Directory">
          <Checkbox
            className="p-0 m-0"
            checked={filter.directory}
            onChange={() => updateRegularFilter(filter.id, { directory: !filter.directory })}
          >
            {({ checked }) => <Tag color={checked ? "arcoblue" : ""} icon={<IconFolder />}></Tag>}
          </Checkbox>
        </Tooltip>

        {/* Apply on File Toggler */}
        <Tooltip position="bottom" content="Apply on File">
          <Checkbox
            className="p-0 m-0"
            checked={filter.file}
            onChange={() => updateRegularFilter(filter.id, { file: !filter.file })}
          >
            {({ checked }) => <Tag color={checked ? "arcoblue" : ""} icon={<IconFile />}></Tag>}
          </Checkbox>
        </Tooltip>
      </div>
    </div>
  );
};

/**
 * Regular filters
 */
export default function RegularFilter() {
  const { regularFilters, toggleRegularFilter, addRegularFilter } = useSearchStore(
    (state) => state
  );

  const items = useMemo(
    () =>
      regularFilters.filters.map((filter) => (
        <RegularFilterItem key={filter.id} filter={filter}></RegularFilterItem>
      )),
    [regularFilters]
  );

  return (
    <div className="h-full flex flex-col">
      <Divider style={{ margin: "0.5rem 0" }} orientation="left">
        Regular Filters
      </Divider>

      <Space className="mb-4">
        {/* Global Regular Filters Enable or Disable Toggler */}
        <Switch
          checkedText={<IconCheck />}
          uncheckedText={<IconClose />}
          checked={regularFilters.enabled}
          onChange={toggleRegularFilter}
        />

        {/* Add New Item Button */}
        <Button
          size="mini"
          shape="circle"
          type="outline"
          icon={<IconPlus />}
          onClick={() => addRegularFilter()}
        />
      </Space>

      {/* Regular Filter Items */}
      <div className="pr-2 overflow-y-auto">{items}</div>
    </div>
  );
}
