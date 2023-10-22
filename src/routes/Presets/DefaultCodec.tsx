import { IconCheckCircleFill } from "@arco-design/web-react/icon";
import { useMemo } from "react";
import { PresetInTable } from ".";
import TableIconPlaceholder from "../../components/TableIconPlaceholder";
import { PresetType } from "../../libs/preset";
import { usePresetStore } from "../../store/preset";

export default function DefaultCodec({
  type,
  preset,
}: {
  type: PresetType.Decode | PresetType.Encode;
  preset: PresetInTable;
}) {
  const { storage } = usePresetStore();

  const defaultCodec = useMemo(
    () => (type === PresetType.Decode ? storage.defaultDecode : storage.defaultEncode),
    [storage.defaultDecode, storage.defaultEncode, type]
  );

  const color = useMemo(
    () => (type === PresetType.Decode ? "rgb(var(--success-6))" : "rgb(var(--warning-6))"),
    [type]
  );

  return defaultCodec && preset.id === defaultCodec ? (
    <IconCheckCircleFill fontSize={24} style={{ color }} />
  ) : (
    <TableIconPlaceholder />
  );
}
