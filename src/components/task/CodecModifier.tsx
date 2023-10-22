import { Button, Input, Select, Tooltip } from "@arco-design/web-react";
import { IconCopy, IconFilter } from "@arco-design/web-react/icon";
import { ReactNode } from "react";
import { TaskParamsModifyingValue } from ".";
import { Preset, PresetType } from "../../libs/preset";
import { usePresetStore } from "../../store/preset";
import { ParamsSource } from "../../store/task";

export type TaskParamsCodecValue = Omit<TaskParamsModifyingValue, "path">;

const DecodePresetOptions: ReactNode[] = [];
const EncodePresetOptions: ReactNode[] = [];

const updatePresetOptions = (presets: Preset[]) => {
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
  record: TaskParamsCodecValue;
  onChange: (id: string, values: Partial<TaskParamsCodecValue>) => void;
  presetType: PresetType.Decode | PresetType.Encode;
  onApplyAll?: (record: TaskParamsCodecValue) => void;
  onConvertCustom?: (record: TaskParamsCodecValue) => void;
  className?: string;
};

export default function CodecModifier({
  record,
  onChange,
  onApplyAll,
  onConvertCustom,
  presetType,
  className,
}: CodecModifierProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <div className="flex gap-2">
        {/* Params Source Selector */}
        <Select
          autoWidth
          size="mini"
          className="flex-1"
          style={{ gridArea: "select" }}
          value={record.selection}
          onChange={(value) => onChange(record.id, { selection: value })}
        >
          <Select.Option value={ParamsSource.Auto}>Auto</Select.Option>
          <Select.Option value={ParamsSource.Custom}>Custom</Select.Option>
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
              style={{ gridArea: "apply" }}
              icon={<IconCopy />}
              onClick={() => onApplyAll(record)}
            ></Button>
          </Tooltip>
        ) : null}

        {/* Convert To Custom Button */}
        {onConvertCustom &&
        record.selection !== ParamsSource.Auto &&
        record.selection !== ParamsSource.Custom ? (
          <Tooltip content="Convert To Custom">
            <Button
              shape="circle"
              size="mini"
              status="warning"
              type="primary"
              className="flex-shrink-0"
              style={{ gridArea: "custom" }}
              icon={<IconFilter />}
              onClick={() => onConvertCustom(record)}
            ></Button>
          </Tooltip>
        ) : null}
      </div>

      {/* Custom Params Input */}
      {record.selection === ParamsSource.Custom ? (
        <Input.TextArea
          autoFocus
          allowClear
          style={{ gridArea: "input" }}
          value={record.custom}
          onChange={(value) => onChange(record.id, { custom: value })}
        ></Input.TextArea>
      ) : null}
    </div>
  );
}
