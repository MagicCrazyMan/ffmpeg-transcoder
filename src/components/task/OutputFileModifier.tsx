import { Button, Tooltip, Typography } from "@arco-design/web-react";
import { IconFolder } from "@arco-design/web-react/icon";
import { save } from "@tauri-apps/api/dialog";
import { useCallback } from "react";
import { useAppStore } from "../../store/app";

export default function OutputFileModifier({
  path,
  onSelectFile,
}: {
  path?: string;
  onSelectFile: (file: string) => void;
}) {
  const { configuration, saveDialogFilters } = useAppStore();

  /**
   * On select output files vis Tauri
   */
  const onSelectOutputFile = useCallback(async () => {
    const file = await save({
      title: "Select Output File",
      defaultPath: configuration.saveDirectory,
      filters: saveDialogFilters,
    });

    if (file) {
      onSelectFile(file);
    }
  }, [configuration.saveDirectory, onSelectFile, saveDialogFilters]);

  return (
    <div className="flex gap-2 items-center">
      {/* Select Output File Button */}
      <Tooltip content="Select Output File">
        <Button
          shape="circle"
          size="mini"
          type="primary"
          className="flex-shrink-0"
          icon={<IconFolder />}
          onClick={onSelectOutputFile}
        />
      </Tooltip>

      {/* File Name */}
      <Typography.Text editable className="flex-1" style={{ margin: "0" }}>
        {path ?? "NULL"}
      </Typography.Text>
    </div>
  );
}
