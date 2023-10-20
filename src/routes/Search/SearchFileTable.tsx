import { Switch, Table, TableColumnProps, Typography } from "@arco-design/web-react";
import { IconDown, IconRight } from "@arco-design/web-react/icon";
import { sep } from "@tauri-apps/api/path";
import { TaskParamsModifyingValue } from "../../components/task";
import CodecModifier from "../../components/task/CodecModifier";
import { PresetType, usePresetStore } from "../../store/preset";
import { SearchEntryNode, useSearchStore } from "../../store/search";
import { ParamsSource } from "../../store/task";

export default function SearchFileTable() {
  const {
    printRelativePath,
    setPrintRelativePath,
    inputDir,
    outputDir,
    isSearching,
    root,
    filesCount,
    directoriesCount,
    expendedRowKeys,
    setExpandedRowKeys,
    selectedRowKeys,
    selectedRowKeysSet,
    setSelectedRowKeys,
    inputParamsMap,
    setInputParamsMap,
    outputParamsMap,
    setOutputParamsMap,
  } = useSearchStore();
  const { presets } = usePresetStore();

  const pathRender = (type: "input" | "output", item: SearchEntryNode) => {
    if (type === "output" && item.type === "Directory") return;

    const dir = type === "input" ? inputDir : outputDir;
    if (!dir) return "NULL";

    return printRelativePath
      ? [...item.relative, item.name].join(sep)
      : [dir, ...item.relative, item.name].join(sep);
  };
  const paramsRender = (type: "input" | "output", item: SearchEntryNode) => {
    if (item.type !== "File") return;
    if (!selectedRowKeysSet.has(item.absolute)) return;

    const id = type === "input" ? item.inputId : item.outputId;
    const map = type === "input" ? inputParamsMap : outputParamsMap;
    const params = map.get(id);
    if (!params) return;

    const presetType = type === "input" ? PresetType.Decode : PresetType.Encode;
    const setter = type === "input" ? setInputParamsMap : setOutputParamsMap;

    const onChange = (id: string, partial: Partial<TaskParamsModifyingValue>) =>
      setter((state) => {
        const map = new Map(state);
        map.set(id, {
          ...state.get(id)!,
          ...partial,
        });
        return map;
      });

    const onApplyAll = (record: TaskParamsModifyingValue) => {
      setter((state) => {
        const map = new Map<string, TaskParamsModifyingValue>();

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

    const onConvertCustom = (record: TaskParamsModifyingValue) => {
      setter((state) => {
        const map = new Map<string, TaskParamsModifyingValue>();

        const entries = state.entries();
        for (let next = entries.next(); !next.done; next = entries.next()) {
          const [id, value] = next.value;
          if (id === record.id) {
            map.set(id, {
              ...value,
              selection: ParamsSource.Custom,
              custom: presets.find((preset) => preset.id === record.selection)?.params.join(" "),
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
        record={params}
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
      title: "Input Params",
      render: (_col, item) => paramsRender("input", item),
    },
    {
      title: "Output Files",
      render: (_col, item) => pathRender("output", item),
    },
    {
      title: "Output Params",
      render: (_col, item) => paramsRender("output", item),
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

        {/* Files & Directories count */}
        {root ? (
          <Typography.Text type="secondary">
            {filesCount} Files | {directoriesCount} Directories | {selectedRowKeys.length} Selected
          </Typography.Text>
        ) : null}
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
