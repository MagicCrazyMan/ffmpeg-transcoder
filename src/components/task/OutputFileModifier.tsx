import { Button, Tooltip, Typography } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { save } from "@tauri-apps/api/dialog";
import { useCallback } from "react";
import { TaskParamsModifyingValue } from ".";
import { TaskParamsSource } from "../../libs/task";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";

export default function OutputFileModifier({
  params,
  onChange,
}: {
  params: TaskParamsModifyingValue;
  onChange: (file: string) => void;
}) {
  const { configuration, saveDialogFilters } = useAppStore();
  const { storage } = usePresetStore();

  /**
   * On select output files vis Tauri
   */
  const onSelectOutputFile = useCallback(async () => {
    const preset =
      params.selection !== TaskParamsSource.Auto && params.selection !== TaskParamsSource.Custom
        ? storage.presets.find((preset) => preset.id === params.selection)
        : undefined;

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
  }, [configuration.saveDirectory, onChange, params.selection, saveDialogFilters, storage.presets]);

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
      >
        {params?.path ?? "NULL"}
      </Typography.Text>
    </div>
  );
}
