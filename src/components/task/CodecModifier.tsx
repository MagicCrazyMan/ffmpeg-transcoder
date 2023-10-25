import { Button, Input, Select, Tooltip } from "@arco-design/web-react";
import { IconCopy, IconFilter } from "@arco-design/web-react/icon";
import { ReactNode } from "react";
import { Preset, PresetType } from "../../libs/preset";
import { TaskArgsSource } from "../../libs/task";
import { ModifyingTaskArgsItem } from "../../libs/task/modifying";
import { usePresetStore } from "../../store/preset";

const DecodePresetOptions: ReactNode[] = [];
const EncodePresetOptions: ReactNode[] = [];

const updatePresetOptions = (presets: Preset[]) => {
  DecodePresetOptions.length = 0;
  EncodePresetOptions.length = 0;

  presets.forEach((preset) => {
    const node = (
      <Select.Option key={preset.id} value={preset.id}>
        {preset.name}
      </Select.Option>
    );
    if (preset.type === PresetType.Universal) {
      DecodePresetOptions.push(node);
      EncodePresetOptions.push(node);
    } else if (preset.type === PresetType.Encode) {
      EncodePresetOptions.push(node);
    } else {
      DecodePresetOptions.push(node);
    }
  });
};
updatePresetOptions(usePresetStore.getState().storage.presets);

usePresetStore.subscribe((state, prevState) => {
  if (state.storage.presets === prevState.storage.presets) return;
  updatePresetOptions(state.storage.presets);
});

export type CodecModifierProps = {
  record: ModifyingTaskArgsItem;
  presetType: PresetType.Decode | PresetType.Encode;
  onSelectChange: (
    args: ModifyingTaskArgsItem,
    selection: TaskArgsSource.Auto | TaskArgsSource.Custom | Preset
  ) => void;
  onCustomChange: (args: ModifyingTaskArgsItem, custom: string) => void;
  onApplyAll: (args: ModifyingTaskArgsItem) => void;
  onConvertCustom: (args: ModifyingTaskArgsItem) => void;
};

export default function CodecModifier({
  record,
  presetType,
  onSelectChange,
  onCustomChange,
  onApplyAll,
  onConvertCustom,
}: CodecModifierProps) {
  const { storage } = usePresetStore();

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex gap-2">
        {/* Arguments Source Selector */}
        <Select
          autoWidth
          size="mini"
          className="flex-1"
          value={
            record.selection === TaskArgsSource.Auto || record.selection === TaskArgsSource.Custom
              ? record.selection
              : record.selection.id
          }
          onChange={(selection: TaskArgsSource.Auto | TaskArgsSource.Custom | string) => {
            if (selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom) {
              onSelectChange(record, selection);
            } else {
              const preset = storage.presets.find((preset) => preset.id === selection)!;
              onSelectChange(record, preset);
            }
          }}
        >
          <Select.Option value={TaskArgsSource.Auto}>Auto</Select.Option>
          <Select.Option value={TaskArgsSource.Custom}>Custom</Select.Option>
          {presetType === PresetType.Decode ? DecodePresetOptions : EncodePresetOptions}
        </Select>

        {/* Apply All Button */}
        {onApplyAll ? (
          <Tooltip content="Apply To All">
            <Button
              shape="circle"
              size="mini"
              type="primary"
              className="flex-shrink-0"
              icon={<IconCopy />}
              onClick={() => onApplyAll(record)}
            ></Button>
          </Tooltip>
        ) : null}

        {/* Convert To Custom Button */}
        {record.selection !== TaskArgsSource.Auto && record.selection !== TaskArgsSource.Custom ? (
          <Tooltip content="Convert To Custom">
            <Button
              shape="circle"
              size="mini"
              status="warning"
              type="primary"
              className="flex-shrink-0"
              icon={<IconFilter />}
              onClick={() => onConvertCustom(record)}
            ></Button>
          </Tooltip>
        ) : null}
      </div>

      {/* Custom Arguments Input */}
      {record.selection === TaskArgsSource.Custom ? (
        <Input.TextArea
          autoFocus
          allowClear
          value={record.custom}
          onChange={(custom) => onCustomChange(record, custom)}
        ></Input.TextArea>
      ) : null}
    </div>
  );
}
