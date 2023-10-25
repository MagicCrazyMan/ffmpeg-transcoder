import { Button, Popconfirm, Space, Tooltip } from "@arco-design/web-react";
import { IconCopy, IconDelete, IconThumbDown, IconThumbUp } from "@arco-design/web-react/icon";
import { useCallback, useContext, useMemo } from "react";
import { PresetContext, PresetInTable } from ".";
import TableIconPlaceholder from "../../components/TableIconPlaceholder";
import { PresetType } from "../../libs/preset";
import { usePresetStore } from "../../store/preset";

const MarkupButton = ({
  type,
  preset,
}: {
  type: PresetType.Decode | PresetType.Encode;
  preset: PresetInTable;
}) => {
  const { storage, setDefaultDecode, setDefaultEncode } = usePresetStore();

  /**
   * Finds default codec by type
   */
  const defaultCodec = useMemo(
    () => (type === PresetType.Decode ? storage.defaultDecodeId : storage.defaultEncodeId),
    [storage.defaultDecodeId, storage.defaultEncodeId, type]
  );

  /**
   * Determines status and icon by detecting whether this preset is default codec
   */
  const { tooltipContent, status, icon } = useMemo(() => {
    if (defaultCodec && preset.id === defaultCodec) {
      // default codec exists and current preset is default codec
      return type === PresetType.Decode
        ? {
            tooltipContent: "Remove Default Decode Preset",
            status: "danger",
            icon: <IconThumbDown />,
          }
        : {
            tooltipContent: "Remove Default Encode Preset",
            status: "danger",
            icon: <IconThumbDown />,
          };
    } else {
      // otherwise
      return type === PresetType.Decode
        ? { tooltipContent: "Set Default Decode Preset", status: "success", icon: <IconThumbUp /> }
        : { tooltipContent: "Set Default Encode Preset", status: "warning", icon: <IconThumbUp /> };
    }
  }, [defaultCodec, preset.id, type]);

  /**
   * Sets default codec
   */
  const setDefault = useCallback(() => {
    // set current preset as default if current preset is not default codec
    const id = preset.id !== defaultCodec ? preset.id : undefined;
    if (type === PresetType.Decode) {
      setDefaultDecode(id);
    } else {
      setDefaultEncode(id);
    }
  }, [defaultCodec, preset, setDefaultDecode, setDefaultEncode, type]);

  return preset.type === type || preset.type === PresetType.Universal ? (
    <Tooltip position="left" content={tooltipContent}>
      <Button
        shape="circle"
        type="secondary"
        status={status as "warning" | "danger"}
        icon={icon}
        onClick={setDefault}
      ></Button>
    </Tooltip>
  ) : (
    <TableIconPlaceholder />
  );
};

export default function Operations({ preset }: { preset: PresetInTable }) {
  const { duplicatePreset, removePreset } = usePresetStore();
  const { setAddingPreset } = useContext(PresetContext)!;

  if (preset.id) {
    return (
      <Space>
        {/* Set as Default Decode Button */}
        <MarkupButton type={PresetType.Decode} preset={preset} />

        {/* Set as Default Decode Button */}
        <MarkupButton type={PresetType.Encode} preset={preset} />

        {/* Duplicate Button */}
        <Tooltip position="left" content="Copy Preset">
          <Button
            shape="circle"
            type="primary"
            icon={<IconCopy />}
            onClick={() => duplicatePreset(preset.id!)}
          ></Button>
        </Tooltip>

        {/* Delete Button & Double Confirm */}
        <Popconfirm
          focusLock
          title="Confirm"
          content="Click again to delete this preset"
          onOk={() => removePreset(preset.id!)}
        >
          <Tooltip position="left" content="Delete Preset">
            <Button shape="circle" type="primary" status="danger" icon={<IconDelete />}></Button>
          </Tooltip>
        </Popconfirm>
      </Space>
    );
  } else {
    // temporary preset requires no double confirming
    return (
      <Tooltip position="left" content="Delete Preset">
        <Button
          shape="circle"
          type="primary"
          status="danger"
          icon={<IconDelete />}
          onClick={() => setAddingPreset(undefined)}
        ></Button>
      </Tooltip>
    );
  }
}
