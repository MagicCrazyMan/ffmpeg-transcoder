import { Button, InputTag, Space, Table, TableColumnProps } from "@arco-design/web-react";
import { Preset, PresetType, usePresetStore } from "../store/preset";
import { IconDelete } from "@arco-design/web-react/icon";

export default function PresetsPage() {
  const presets = usePresetStore((state) => state.presets);
  const removePreset = usePresetStore((state) => state.removePreset);

  const tableCols: TableColumnProps[] = [
    {
      title: "Name",
      dataIndex: "name",
    },
    {
      title: "Type",
      render: (_, record: Preset) => {
        switch (record.type) {
          case PresetType.Universal:
            return "Universal";
          case PresetType.Decode:
            return "For Decode Only";
          case PresetType.Encode:
            return "For Encode Only";
        }
      },
    },
    {
      title: "Prams",
      render: (_, record: Preset) => {
        return <InputTag size="mini" value={record.params}></InputTag>;
      },
    },
    {
      title: "Operations",
      width: "6rem",
      align: "center",
      render: (_, record: Preset) => {
        return (
          <Button
            shape="circle"
            type="primary"
            status="danger"
            icon={<IconDelete />}
            onClick={() => removePreset(record.name)}
          ></Button>
        );
      },
    },
  ];

  const addPreset = () => {};

  return (
    <Space className="w-full" direction="vertical">
      {/* Add Preset */}
      <Button type="primary" size="small" onClick={addPreset}>
        Add Preset
      </Button>
      {/* Presets Table */}
      <Table stripe pagination={false} size="mini" columns={tableCols} data={presets}></Table>
    </Space>
  );
}
