import { Switch, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDown, IconRight } from "@arco-design/web-react/icon";
import { TaskParamsModifyingValue } from "../../components/task";
import CodecModifier from "../../components/task/CodecModifier";
import { PresetType, usePresetStore } from "../../store/preset";
import { useSearchStore } from "../../store/search";
import { ParamsSource } from "../../store/task";
import { SearchFile } from "../../tauri/fs";

type SearchEntryNode = SearchDirectoryNode | SearchFileNode;

type SearchDirectoryNode = {
  type: "Directory";
  name: string;
  absolute: string;
  relative: string;
  children: SearchEntryNode[];
  path: string;
  parent: SearchDirectoryNode | null;
};

type SearchFileNode = SearchFile & {
  parent: SearchDirectoryNode;
  inputId: string;
  outputId: string;
};

export default function SearchFileTable() {
  const {
    printRelativePath,
    setPrintRelativePath,
    inputDir,
    outputDir,
    isFileLoading,
    root,
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
    const dir = type === "input" ? inputDir : outputDir;
    if (!dir) return "NULL";

    if (printRelativePath) {
      return item.relative;
    } else {
      return `${dir}${item.relative}`;
    }
  };
  const paramsRender = (type: "input" | "output", item: SearchEntryNode) => {
    if (item.type !== "File") return;
    if (!selectedRowKeysSet.has(item.absolute)) return;

    const id = type === "input" ? item.inputId : item.outputId;
    const mapper = type === "input" ? inputParamsMap : outputParamsMap;
    const params = mapper.get(id);
    if (!params) return;

    const presetType = type === "input" ? PresetType.Decode : PresetType.Encode;
    const setter = type === "input" ? setInputParamsMap : setOutputParamsMap;

    const onChange = (id: string, partial: Partial<TaskParamsModifyingValue>) =>
      setter((state) => {
        const mapper = new Map(state);
        mapper.set(id, {
          ...state.get(id)!,
          ...partial,
        });
        return mapper;
      });

    const onApplyAll = (record: TaskParamsModifyingValue) => {
      setter((state) => {
        const mapper = new Map<string, TaskParamsModifyingValue>();

        const entries = state.entries();
        for (let next = entries.next(); !next.done; next = entries.next()) {
          const [id, value] = next.value;
          if (id === record.id) {
            mapper.set(id, value);
          } else {
            mapper.set(id, { ...value, selection: record.selection, custom: record.custom });
          }
        }

        return mapper;
      });
    };

    const onConvertCustom = (record: TaskParamsModifyingValue) => {
      setter((state) => {
        const mapper = new Map<string, TaskParamsModifyingValue>();

        const entries = state.entries();
        for (let next = entries.next(); !next.done; next = entries.next()) {
          const [id, value] = next.value;
          if (id === record.id) {
            mapper.set(id, {
              ...value,
              selection: ParamsSource.Custom,
              custom: presets.find((preset) => preset.id === record.selection)?.params.join(" "),
            });
          } else {
            mapper.set(id, value);
          }
        }

        return mapper;
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
      width: "30%",
      render: (_col, item) => pathRender("input", item),
    },
    {
      title: "Input Params",
      width: "20%",
      render: (_col, item) => paramsRender("input", item),
    },
    {
      title: "Output Files",
      width: "30%",
      render: (_col, item) => pathRender("output", item),
    },
    {
      title: "Output Params",
      width: "20%",
      render: (_col, item) => paramsRender("output", item),
    },
  ];

  return (
    <div>
      <Switch
        className="mb-2"
        checkedText="RELATIVE"
        uncheckedText="ABSOLUTE"
        checked={printRelativePath}
        onChange={setPrintRelativePath}
      />

      <Table
        stripe
        size="mini"
        rowKey="absolute"
        scroll={{ y: "calc(100vh - 181px)" }}
        pagination={false}
        loading={isFileLoading}
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
