import { Button, Tooltip, Typography } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { save } from "@tauri-apps/api/dialog";
import { useCallback } from "react";
import { TaskParamsModifyingValue } from ".";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import { ParamsSource } from "../../store/task";

export default function OutputFileModifier({
  params,
  onChange,
}: {
  params: TaskParamsModifyingValue;
  onChange: (file: string) => void;
}) {
  const { configuration, saveDialogFilters } = useAppStore();
  const { presets } = usePresetStore();

  const preset =
    params.selection !== ParamsSource.Auto && params.selection !== ParamsSource.Custom
      ? presets.find((preset) => preset.id === params.selection)
      : undefined;

  /**
   * On select output files vis Tauri
   */
  const onSelectOutputFile = useCallback(async () => {
    const file = await save({
      title: "Select Output File",
      defaultPath: configuration.saveDirectory,
      filters: preset?.extension
        ? [{ extensions: [preset.extension], name: preset.name }, ...saveDialogFilters]
        : saveDialogFilters,
    });

    if (file) {
      onChange(file);
    }
  }, [configuration.saveDirectory, onChange, preset, saveDialogFilters]);

  return (
    <div className="flex gap-2 items-center">
      {/* Select Output File Button */}
      <Tooltip content="Select Output File">
        <Button
          shape="circle"
          size="mini"
          type="text"
          className="flex-shrink-0"
          icon={<IconFolder />}
          onClick={onSelectOutputFile}
        />
      </Tooltip>

      {/* File Name */}
      <Typography.Text
        editable={{
          onChange,
        }}
        className="flex-1"
        style={{ margin: "0" }}
        onChange={() => console.log(111)}
      >
        {params?.path ?? "NULL"}
      </Typography.Text>
    </div>
  );
}
