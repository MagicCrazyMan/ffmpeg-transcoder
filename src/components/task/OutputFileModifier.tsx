import { Button, Input } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { save } from "@tauri-apps/api/dialog";
import { useCallback } from "react";
import { TaskArgsSource } from "../../libs/task";
import { ModifyingTaskArgsItem } from "../../libs/task/modifying";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";

export default function OutputFileModifier({
  args,
  onChange,
}: {
  args: ModifyingTaskArgsItem;
  onChange: (file?: string) => void;
}) {
  const { configuration, saveDialogFilters } = useAppStore();
  const { storage } = usePresetStore();

  /**
   * On select output files vis Tauri
   */
  const onSelectOutputFile = useCallback(async () => {
    const { selection } = args;
    const preset =
      selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom
        ? undefined
        : storage.presets.find((preset) => preset.id === selection.id);

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
  }, [args, storage.presets, configuration.saveDirectory, saveDialogFilters, onChange]);

  return (
    <div className="flex gap-2 items-center">
      {/* File Name */}
      <Input
        allowClear
        size="mini"
        style={{ margin: "0" }}
        beforeStyle={{ padding: "0" }}
        addBefore={
          <Button size="mini" type="text" icon={<IconFolder />} onClick={onSelectOutputFile} />
        }
        status={args?.path ? undefined : "warning"}
        value={args?.path ?? "NULL"}
        onChange={(value) => (value ? onChange(value) : onChange(undefined))}
      />
    </div>
  );
}
