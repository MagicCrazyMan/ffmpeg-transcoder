import { Button, Divider, Message, Space, Tooltip } from "@arco-design/web-react";
import { IconDownload, IconPlus, IconUpload } from "@arco-design/web-react/icon";
import { save } from "@tauri-apps/api/dialog";
import { join } from "@tauri-apps/api/path";
import { useContext, useMemo } from "react";
import { PresetContext } from ".";
import CollapsibleButtonGroup from "../../components/CollapsibleButtonGroup";
import { PresetType } from "../../libs/preset";
import { useAppStore } from "../../store/app";
import { usePresetStore } from "../../store/preset";
import { IoError } from "../../tauri/error";
import { writeTextFile } from "../../tauri/fs";

export default function GlobalOperations() {
  const { configuration } = useAppStore();
  const { storage, importPresets } = usePresetStore();
  const { getAddingPreset, setAddingPreset } = useContext(PresetContext)!;
  const isAdding = useMemo(() => !!getAddingPreset(), [getAddingPreset]);

  /**
   * Adds new preset
   */
  const addPreset = () => {
    setAddingPreset?.({
      type: PresetType.Universal,
      args: [],
    });
  };

  /**
   * Exports presets
   */
  const exports = async () => {
    const defaultPath = configuration.saveDirectory
      ? await join(configuration.saveDirectory, "presets.json")
      : undefined;
    const file = await save({
      title: "Export Presets",
      filters: [{ extensions: ["json"], name: "JSON Object" }],
      defaultPath,
    });

    if (!file) return;

    try {
      await writeTextFile(file, JSON.stringify(storage, null, 2));
      Message.success(`successfully export presets to ${file}`);
    } catch (err) {
      Message.error((err as IoError).reason);
    }
  };

  const imports = (override: boolean) => {
    const fileSelector = document.createElement("input");
    fileSelector.type = "file";
    fileSelector.accept = "application/json";
    fileSelector.addEventListener("change", async () => {
      const file = fileSelector.files?.item(0);
      if (!file) return;

      try {
        importPresets(JSON.parse(await file.text()), override);
        Message.success("successfully import presets");
      } catch (err) {
        Message.error((err as Error).message);
      }
    });
    fileSelector.click();
  };

  return (
    <>
      <Space>
        {/* Add Preset */}
        <Tooltip content="Add New Preset">
          <Button
            shape="circle"
            type="primary"
            icon={<IconPlus />}
            disabled={isAdding}
            onClick={(e) => {
              e.stopPropagation(); // stop propagation to prevent form validation
              addPreset();
            }}
          ></Button>
        </Tooltip>

        <Divider type="vertical" />

        {/* Export Presets */}
        <Tooltip content="Export Presets">
          <Button
            shape="circle"
            type="default"
            status="warning"
            icon={<IconUpload />}
            disabled={isAdding}
            onClick={(e) => {
              e.stopPropagation();
              exports();
            }}
          ></Button>
        </Tooltip>

        {/* Import  Presets */}
        <CollapsibleButtonGroup
          disabled={isAdding}
          buttons={[
            {
              status: "success",
              children: "APPEND",
              icon: <IconDownload />,
              tooltip: {
                content: "Import & Append Presets",
              },
              onClick: () => imports(false),
            },
            {
              status: "danger",
              children: "OVERRIDE",
              tooltip: {
                content: "Import & Override Presets",
              },
              onClick: () => imports(true),
            },
          ]}
        />
      </Space>
    </>
  );
}
