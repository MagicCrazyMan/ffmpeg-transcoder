import { Button, Tooltip, Typography } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { save } from "@tauri-apps/api/dialog";
import { useCallback } from "react";
import { TaskArgsSource } from "../../libs/task";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import { ModifyingTaskArgsItem } from "../../libs/task/modifying";

export default function OutputFileModifier({
  args,
  onChange,
}: {
  args: ModifyingTaskArgsItem;
  onChange: (file: string) => void;
}) {
  const { configuration, saveDialogFilters } = useAppStore();
  const { storage } = usePresetStore();

  /**
   * On select output files vis Tauri
   */
  const onSelectOutputFile = useCallback(async () => {
    const preset =
      args.selection !== TaskArgsSource.Auto && args.selection !== TaskArgsSource.Custom
        ? storage.presets.find((preset) => preset.id === args.selection)
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
  }, [configuration.saveDirectory, onChange, args.selection, saveDialogFilters, storage.presets]);

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
        {args?.path ?? "NULL"}
      </Typography.Text>
    </div>
  );
}
