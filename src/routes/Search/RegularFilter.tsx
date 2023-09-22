import { Button, Checkbox, Divider, Input, Tag, Tooltip } from "@arco-design/web-react";
import {
  IconCheck,
  IconDelete,
  IconFile,
  IconFolder,
  IconMinusCircle,
  IconPlus,
  IconQuote,
} from "@arco-design/web-react/icon";
import { useMemo } from "react";
import { v4 } from "uuid";
import { RegularFilterData } from "./constants";

type RegularFilterItemProps = {
  filter: RegularFilterData;
  onChanged: (filter: RegularFilterData) => void;
  onDeleted: () => void;
  onAdded: () => void;
};

/**
 * Regular filter item
 */
const RegularFilterItem = ({ filter, onChanged, onAdded, onDeleted }: RegularFilterItemProps) => {
  const checkboxesData = [
    ["enabled", "Enabled", <IconCheck />],
    ["regex", "Use as Regular Expression", <IconQuote />],
    ["blacklist", "Use as Blacklist", <IconMinusCircle />],
    ["directory", "Apply on Directory Name", <IconFolder />],
    ["file", "Apply on Filename", <IconFile />],
  ];
  const checkboxes = checkboxesData.map(([value, tooltip, icon]) => (
    <Tooltip position="bottom" content={tooltip}>
      <Checkbox className="regular-filter-item-checkbox" value={value}>
        {({ checked }) => <Tag color={checked ? "arcoblue" : ""} icon={icon}></Tag>}
      </Checkbox>
    </Tooltip>
  ));

  // input value changed
  const setValue = (value: string) => {
    onChanged({
      ...filter,
      value,
    });
  };

  // checkboxes value changed
  const checkedValue = useMemo(() => {
    return [
      filter.enabled ? "enabled" : undefined,
      filter.blacklist ? "blacklist" : undefined,
      filter.regex ? "regex" : undefined,
      filter.applyDirectory ? "directory" : undefined,
      filter.applyFile ? "file" : undefined,
    ].filter((v) => v) as string[];
  }, [filter]);
  const setChecked = (checks: string[]) => {
    onChanged({
      ...filter,
      enabled: checks.includes("enabled"),
      regex: checks.includes("regex"),
      blacklist: checks.includes("blacklist"),
      applyDirectory: checks.includes("directory"),
      applyFile: checks.includes("file"),
    });
  };

  return (
    <div className="mb-4">
      <div className="flex">
        <Input
          className="mr-2"
          placeholder={filter.regex ? "Filter Text" : "Regular Expression"}
          value={filter.value}
          onChange={setValue}
        ></Input>
        <Tooltip content="Add">
          <Button
            className="flex-shrink-0 mr-2"
            shape="circle"
            type="outline"
            icon={<IconPlus />}
            onClick={onAdded}
          ></Button>
        </Tooltip>
        <Tooltip content="Delete">
          <Button
            className="flex-shrink-0"
            shape="circle"
            type="outline"
            status="danger"
            icon={<IconDelete />}
            onClick={onDeleted}
          ></Button>
        </Tooltip>
      </div>

      <Checkbox.Group className="flex" value={checkedValue} onChange={setChecked}>
        {checkboxes}
      </Checkbox.Group>
    </div>
  );
};

type RegularFilterProps = {
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  filters: RegularFilterData[];
  onChanged: (filters: RegularFilterData[]) => void;
  className?: string;
};

/**
 * Regular filters
 * @param param0 Regular filter props
 */
export default function RegularFilter({
  enabled,
  onEnabled,
  filters,
  onChanged,
  className,
}: RegularFilterProps) {
  const items = useMemo(() => {
    return filters.map((filter, index) => {
      // a function that update filter in current index
      const setFilter = (filter: RegularFilterData) => {
        // new filters list where a target filter had changed
        const changedFilters = filters.map((f) => {
          if (f.id === filter.id) {
            return filter;
          } else {
            return f;
          }
        });

        onChanged(changedFilters);
      };

      // add new filter
      const add = () => {
        const addedFilters: RegularFilterData[] = [
          ...filters.slice(0, index - 1),
          {
            id: v4(),
            value: "",
            enabled: true,
            regex: false,
            applyDirectory: true,
            applyFile: true,
          } as RegularFilterData,
          ...filters.slice(index),
        ];
        onChanged(addedFilters);
      };

      // delete filter
      const del = () => {
        const deletedFilters = filters.filter((f) => f.id !== filter.id);
        onChanged(deletedFilters);
      };

      return (
        <RegularFilterItem
          key={filter.id}
          filter={filter}
          onChanged={setFilter}
          onAdded={add}
          onDeleted={del}
        ></RegularFilterItem>
      );
    });
  }, [filters, onChanged]);

  return (
    <div className={className}>
      <Divider style={{ margin: "0.5rem 0" }} orientation="left">
        Regular Filters
      </Divider>

      <Checkbox checked={enabled} onChange={onEnabled} className="mb-4">
        Enabled
      </Checkbox>

      {items}
    </div>
  );
}
