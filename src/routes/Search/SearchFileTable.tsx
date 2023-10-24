import { Space, Switch, Table, TableColumnProps, Typography } from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconDown,
  IconFile,
  IconFolder,
  IconRight,
} from "@arco-design/web-react/icon";
import { sep } from "@tauri-apps/api/path";
import CodecModifier from "../../components/task/CodecModifier";
import { PresetType } from "../../libs/preset";
import { TaskArgsSource } from "../../libs/task";
import { ModifyingTaskArgsItem } from "../../libs/task/modifying";
import { usePresetStore } from "../../store/preset";
import { SearchEntryNode, useSearchStore } from "../../store/search";

const Statistic = () => {
  const { filesCount, directoriesCount, selectedRowKeys } = useSearchStore();

  return (
    <Space className="flex items-center justify-center">
      <Typography.Text type="secondary">{filesCount}</Typography.Text>
      <IconFile fontSize={20} />
      <Typography.Text type="secondary">|</Typography.Text>
      <Typography.Text type="secondary">{directoriesCount}</Typography.Text>
      <IconFolder fontSize={20} />
      <Typography.Text type="secondary">|</Typography.Text>
      <Typography.Text type="secondary">{selectedRowKeys.length}</Typography.Text>
      <IconCheckCircle fontSize={20} />
    </Space>
  );
};

export default function SearchFileTable() {
  const {
    printRelativePath,
    setPrintRelativePath,
    inputDir,
    outputDir,
    isSearching,
    root,
    expendedRowKeys,
    setExpandedRowKeys,
    selectedRowKeys,
    selectedRowKeysSet,
    setSelectedRowKeys,
    inputArgsMap,
    setInputArgsMap,
    outputArgsMap,
    setOutputArgsMap,
  } = useSearchStore();
  const presets = usePresetStore((state) => state.storage.presets);

  const pathRender = (type: "input" | "output", item: SearchEntryNode) => {
    if (type === "output" && item.type === "Directory") return;

    const dir = type === "input" ? inputDir : outputDir;
    if (!dir) return "NULL";

    return printRelativePath
      ? [...item.relative, item.name].join(sep)
      : [dir, ...item.relative, item.name].join(sep);
  };
  const argsRender = (type: "input" | "output", item: SearchEntryNode) => {
    if (item.type !== "File") return;
    if (!selectedRowKeysSet.has(item.absolute)) return;

    const id = type === "input" ? item.inputId : item.outputId;
    const map = type === "input" ? inputArgsMap : outputArgsMap;
    const args = map.get(id);
    if (!args) return;

    const presetType = type === "input" ? PresetType.Decode : PresetType.Encode;
    const setter = type === "input" ? setInputArgsMap : setOutputArgsMap;

    const onChange = (id: string, partial: Partial<ModifyingTaskArgsItem>) =>
      setter((state) => {
        const map = new Map(state);
        map.set(id, {
          ...state.get(id)!,
          ...partial,
        });
        return map;
      });

    const onApplyAll = (record: ModifyingTaskArgsItem) => {
      setter((state) => {
        const map = new Map<string, ModifyingTaskArgsItem>();

        const entries = state.entries();
        for (let next = entries.next(); !next.done; next = entries.next()) {
          const [id, value] = next.value;
          if (id === record.id) {
            map.set(id, value);
          } else {
            map.set(id, { ...value, selection: record.selection, custom: record.custom });
          }
        }

        return map;
      });
    };

    const onConvertCustom = (record: ModifyingTaskArgsItem) => {
      setter((state) => {
        const map = new Map<string, ModifyingTaskArgsItem>();

        const entries = state.entries();
        for (let next = entries.next(); !next.done; next = entries.next()) {
          const [id, value] = next.value;
          if (id === record.id) {
            map.set(id, {
              ...value,
              selection: TaskArgsSource.Custom,
              custom: presets.find((preset) => preset.id === record.selection)?.args.join(" "),
            });
          } else {
            map.set(id, value);
          }
        }

        return map;
      });
    };
    return (
      <CodecModifier
        presetType={presetType}
        record={args}
        onChange={onChange}
        onApplyAll={onApplyAll}
        onConvertCustom={onConvertCustom}
      />
    );
  };

  const tableCols: TableColumnProps<SearchEntryNode>[] = [
    {
      title: "Input Files",
      render: (_col, item) => pathRender("input", item),
    },
    {
      title: "Input Arguments",
      render: (_col, item) => argsRender("input", item),
    },
    {
      title: "Output Files",
      render: (_col, item) => pathRender("output", item),
    },
    {
      title: "Output Arguments",
      render: (_col, item) => argsRender("output", item),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center">
        {/* Prints Absolute or Relative Path Button */}
        <Switch
          className="mb-2"
          checkedText="RELATIVE"
          uncheckedText="ABSOLUTE"
          checked={printRelativePath}
          onChange={setPrintRelativePath}
        />

        {/* Files & Directories Statistic */}
        <Statistic />
      </div>

      <Table
        stripe
        size="mini"
        rowKey="absolute"
        scroll={{ x: "1400px", y: "calc(100vh - 181px)" }}
        pagination={false}
        loading={isSearching}
        columns={tableCols}
        expandedRowKeys={expendedRowKeys}
        onExpandedRowsChange={(value) => setExpandedRowKeys(value as string[])}
        expandProps={{
          icon: ({ expanded, ...restProps }) =>
            expanded ? (
              <button {...restProps}>
                <IconDown />
              </button>
            ) : (
              <button {...restProps}>
                <IconRight />
              </button>
            ),
        }}
        rowSelection={{
          type: "checkbox",
          columnWidth: 32,
          renderCell(originNode, _checked, record) {
            if (record.type === "File") {
              return originNode;
            } else {
              return undefined;
            }
          },
          selectedRowKeys,
          onChange(selectedRowKeys) {
            setSelectedRowKeys(selectedRowKeys as string[]);
          },
        }}
        data={root?.children}
      ></Table>
    </div>
  );
}
