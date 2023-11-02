import { Input, Space, Switch, Table, TableColumnProps, Typography } from "@arco-design/web-react";
import {
  IconCheckCircle,
  IconDown,
  IconFile,
  IconFolder,
  IconRight,
} from "@arco-design/web-react/icon";
import { sep } from "@tauri-apps/api/path";
import { useMemo } from "react";
import CodecModifier from "../../components/task/CodecModifier";
import { Preset, PresetType } from "../../libs/preset";
import { SearchEntryNode, SearchFileNode } from "../../libs/search/table_tree";
import { TaskArgsSource } from "../../libs/task";
import { ModifyingTaskArgsItem, replaceExtension } from "../../libs/task/modifying";
import { usePresetStore } from "../../store/preset";
import { useSearchStore } from "../../store/search";

/**
 * Statistic of files, directories and selection
 */
const Statistic = () => {
  const { filesCount, directoriesCount, selectedRows: selectedRowKeys } = useSearchStore();

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

/**
 * Output cell
 */
const OutputCell = ({ node }: { node: SearchEntryNode }) => {
  const { storage, outputDir, outputArgsMap, setOutputArgsMap, selectedRows, selectedRowKeysSet } =
    useSearchStore();

  if (!outputDir) return;
  if (node.type !== "File") return;

  if (!selectedRowKeysSet.has(node.absolute)) return;

  const args = outputArgsMap.get(node.absolute);
  if (!args) return;

  /**
   * Detects whether any output files having the same name
   */
  const hasSame = selectedRows.some((row) => {
    const outputArgs = outputArgsMap.get(row.absolute);
    if (!outputArgs || !outputArgs.path) return false;
    if (args === outputArgs) return false;
    return outputArgs.path === args.path;
  });

  /**
   * On input value change
   */
  const onChange = (value: string) => {
    let path: string | undefined;

    if (storage.printRelativePath) {
      value = value.startsWith(sep) ? value : sep + value;
      path = outputDir + value;
    } else {
      if (value.startsWith(outputDir)) {
        const relative = value.replace(outputDir, "");
        value = relative.startsWith(sep) ? value : outputDir + sep + relative;
        path = value;
      } else {
        // if value do not starts with output dir, restricts to output dir
        path = outputDir;
      }
    }

    setOutputArgsMap((state) => {
      const map = new Map(state);

      map.set(args.id, {
        ...args,
        path,
      });

      return map;
    });
  };

  if (args.path) {
    return (
      <Input
        size="mini"
        status={hasSame ? "error" : undefined}
        value={storage.printRelativePath ? args.path.replace(outputDir, "") : args.path}
        onChange={onChange}
      />
    );
  }
};

/**
 * Codec cell
 */
const CodecCell = ({ type, node }: { type: "input" | "output"; node: SearchEntryNode }) => {
  const { inputArgsMap, setInputArgsMap, outputArgsMap, setOutputArgsMap, selectedRowKeysSet } =
    useSearchStore();
  const presets = usePresetStore((state) => state.storage.presets);

  if (node.type !== "File") return;
  if (!selectedRowKeysSet.has(node.absolute)) return;

  const { map, presetType, setter } =
    type === "input"
      ? {
          map: inputArgsMap,
          presetType: PresetType.Decode,
          setter: setInputArgsMap,
        }
      : {
          map: outputArgsMap,
          presetType: PresetType.Encode,
          setter: setOutputArgsMap,
        };

  const args = map.get(node.absolute);
  if (!args) return;

  const onSelectChange = (
    args: ModifyingTaskArgsItem,
    selection: TaskArgsSource.Auto | TaskArgsSource.Custom | Preset
  ) => {
    setter((state) => {
      const map = new Map(state);

      if (selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom) {
        map.set(args.id, {
          ...args,
          selection,
        });
      } else {
        map.set(args.id, {
          ...args,
          selection,
          path: args.path ? replaceExtension(args.path, selection) : args.path,
        });
      }

      return map;
    });
  };

  const onCustomChange = ({ id }: ModifyingTaskArgsItem, custom: string) => {
    setter((state) => {
      const map = new Map(state);

      map.set(id, {
        ...state.get(id)!,
        custom,
      });

      return map;
    });
  };

  const onApplyAll = (record: ModifyingTaskArgsItem) => {
    setter((state) => {
      const map = new Map<string, ModifyingTaskArgsItem>();

      const entries = state.entries();
      for (let next = entries.next(); !next.done; next = entries.next()) {
        const [id, value] = next.value;
        if (id === record.id) {
          map.set(id, value);
        } else {
          if (
            record.selection === TaskArgsSource.Auto ||
            record.selection === TaskArgsSource.Custom
          ) {
            map.set(id, { ...value, selection: record.selection, custom: record.custom });
          } else {
            map.set(id, {
              ...value,
              selection: record.selection,
              custom: record.custom,
              path: value.path ? replaceExtension(value.path, record.selection) : value.path,
            });
          }
        }
      }

      return map;
    });
  };

  const onConvertCustom = (record: ModifyingTaskArgsItem) => {
    setter((state) => {
      const map = new Map(state);

      const { id, custom, selection } = record;
      map.set(id, {
        ...record,
        selection: TaskArgsSource.Custom,
        custom:
          selection === TaskArgsSource.Auto || selection === TaskArgsSource.Custom
            ? custom
            : presets.find((preset) => preset.id === selection.id)?.args.join(" "),
      });

      return map;
    });
  };
  return (
    <CodecModifier
      presetType={presetType as PresetType.Decode | PresetType.Encode}
      record={args}
      onSelectChange={onSelectChange}
      onCustomChange={onCustomChange}
      onApplyAll={onApplyAll}
      onConvertCustom={onConvertCustom}
    />
  );
};

export default function SearchFileTable() {
  const {
    storage,
    inputDir,
    setPrintRelativePath,
    isSearching,
    root,
    expendedRowKeys,
    setExpandedRowKeys,
    selectedRows,
    setSelectedRows,
  } = useSearchStore();

  const selectedRowKeys = useMemo(() => selectedRows.map((row) => row.absolute), [selectedRows]);

  const tableCols: TableColumnProps<SearchEntryNode>[] = [
    {
      title: "Input Files",
      render: (_col, node) =>
        storage.printRelativePath ? node.relative : inputDir + node.relative,
    },
    {
      title: "Input Arguments",
      render: (_col, node) => <CodecCell node={node} type="input" />,
    },
    {
      title: "Output Files",
      render: (_col, node) => <OutputCell node={node} />,
    },
    {
      title: "Output Arguments",
      render: (_col, node) => <CodecCell node={node} type="output" />,
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
          checked={storage.printRelativePath}
          onChange={setPrintRelativePath}
        />

        {/* Files & Directories Statistic */}
        <Statistic />
      </div>

      <Table
        stripe
        size="mini"
        rowKey="absolute"
        scroll={{ x: "1500px", y: "calc(100vh - 181px)" }}
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
          selectedRowKeys,
          renderCell(originNode, _checked, record) {
            if (record.type === "File") {
              return originNode;
            } else {
              return undefined;
            }
          },
          onChange(keys, rows) {
            setSelectedRows(keys as string[], rows as SearchFileNode[]);
          },
        }}
        data={root?.children}
      ></Table>
    </div>
  );
}
