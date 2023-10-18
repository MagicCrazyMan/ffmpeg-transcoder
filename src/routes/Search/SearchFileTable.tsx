import { Switch, Table, TableColumnProps } from "@arco-design/web-react";
import { IconDown, IconRight } from "@arco-design/web-react/icon";
import { sep } from "@tauri-apps/api/path";
import { useEffect, useMemo, useState } from "react";
import { v4 } from "uuid";
import { EditableTaskParams } from "../../components/task";
import ParamsModifier from "../../components/task/ParamsModifier";
import { PresetType, usePresetStore } from "../../store/preset";
import { ExtensionFilterState, useSearchStore } from "../../store/search";
import { ParamsSource } from "../../store/task";
import { SearchDirectory, SearchFile } from "../../tauri/fs";

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
    searchDirectory,
    isFileLoading,
    extensionFilters,
    regularFilters,
  } = useSearchStore();
  const { presets, defaultDecode, defaultEncode } = usePresetStore();

  const [root, setRoot] = useState<SearchDirectoryNode | undefined>(undefined);
  const [nodeMapper, setNodeMapper] = useState<Map<string, SearchEntryNode>>(new Map());
  const [expendedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const selectedRowKeysSet = useMemo(() => new Set(selectedRowKeys), [selectedRowKeys]);
  /**
   * Updates data when search directory or filters change
   */
  useEffect(() => {
    setSelectedRowKeys([]);
    setNodeMapper(new Map());

    if (!searchDirectory) {
      setRoot(undefined);
      setExpandedRowKeys([]);
      return;
    }

    const expendedRowKeys: string[] = [];
    const nodeMapper = new Map<string, SearchFileNode>();
    const root: SearchDirectoryNode = { ...searchDirectory, children: [], parent: null };

    const directories: [SearchDirectory, SearchDirectoryNode][] = [[searchDirectory, root]];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const item = directories.pop();
      if (!item) break;

      const [directory, directoryNode] = item;

      directory.children.forEach((child) => {
        // apply filters
        let shouldDrop = false;
        {
          // apply regular filters
          if (regularFilters.enabled) {
            for (const regularFilter of regularFilters.filters) {
              if (shouldDrop) break;
              if (!regularFilter.value) continue;
              if (!regularFilter.enabled) continue;
              if (!regularFilter.file && child.type === "File") continue;
              if (!regularFilter.directory && child.type === "Directory") continue;

              let included: boolean;
              if (regularFilter.regex) {
                try {
                  included = new RegExp(regularFilter.value).test(child.name);
                } catch (err) {
                  console.error(err);
                  continue;
                }
              } else {
                included = child.name.includes(regularFilter.value);
              }
              shouldDrop = regularFilter.blacklist ? included : !included;
            }
          }

          // apply extension filters for files
          if (!shouldDrop && child.type === "File") {
            if (child.extension) {
              // for file having extension, filter them
              const included = extensionFilters.extensions.includes(child.extension);
              if (extensionFilters.state === ExtensionFilterState.Whitelist) {
                shouldDrop = !included;
              } else if (extensionFilters.state === ExtensionFilterState.Blacklist) {
                shouldDrop = included;
              }
            } else {
              // if file has no extension, drop only when extension filters enabled
              if (extensionFilters.state !== ExtensionFilterState.Disabled) {
                shouldDrop = true;
              }
            }
          }
        }

        if (shouldDrop) return;

        if (child.type === "Directory") {
          const subdirectoryNode = { ...child, children: [], parent: directoryNode };
          expendedRowKeys.push(child.absolute);
          directories.push([child, subdirectoryNode]);

          directoryNode.children.push(subdirectoryNode);
        } else {
          const fileNode: SearchFileNode = {
            ...child,
            parent: directoryNode,
            inputId: v4(),
            outputId: v4(),
          };

          directoryNode.children.push(fileNode);
          nodeMapper.set(fileNode.absolute, fileNode);
        }
      });

      // if directory empty, clean upper directories
      {
        if (directoryNode.children.length === 0) {
          if (directoryNode.parent) {
            // recursively clean empty directories from current node to upper nodes
            let node: SearchDirectoryNode = directoryNode;
            while (node.parent) {
              node.parent.children = node.parent.children.filter((child) => child !== node);

              if (node.parent.children.length === 0) {
                node = node.parent;
              } else {
                break;
              }
            }
          } else {
            // reach root node, if root node has no children, remove undefined directly
            return;
          }
        }
      }
    }

    setRoot(root);
    setExpandedRowKeys(expendedRowKeys);
    setNodeMapper(nodeMapper);
  }, [searchDirectory, extensionFilters, regularFilters, setExpandedRowKeys]);

  /**
   * A hash map mapping inputId and outputId of file node to editable task params
   */
  const [inputParamsMapper, setInputParamsMapper] = useState<Map<string, EditableTaskParams>>(
    new Map()
  );
  const [outputParamsMapper, setOutputParamsMapper] = useState<Map<string, EditableTaskParams>>(
    new Map()
  );
  /**
   * Cleans params only when search directory
   */
  useEffect(() => {
    setInputParamsMapper(new Map());
    setOutputParamsMapper(new Map());
  }, [searchDirectory]);
  /**
   * Updates task params when selected row keys change.
   * Creates new params if one never selected before,
   * but not deletes when unselecting.
   */
  useEffect(() => {
    if (selectedRowKeys.length === 0) return;

    setInputParamsMapper((state) => {
      const mapper = new Map(state);

      selectedRowKeys.forEach((absolute) => {
        const node = nodeMapper.get(absolute);
        if (!node || node.type !== "File") return;

        if (!state.has(node.inputId)) {
          mapper.set(node.inputId, {
            id: node.inputId,
            path: (inputDir!.endsWith(sep) ? inputDir!.slice(0, -1) : inputDir!) + node.relative,
            selection: defaultDecode ?? ParamsSource.Auto,
          });
        }
      });

      return mapper;
    });

    setOutputParamsMapper((state) => {
      const mapper = new Map(state);

      selectedRowKeys.forEach((absolute) => {
        const node = nodeMapper.get(absolute);
        if (!node || node.type !== "File") return;

        if (!state.has(node.outputId)) {
          mapper.set(node.outputId, {
            id: node.outputId,
            path: (outputDir!.endsWith(sep) ? outputDir!.slice(0, -1) : outputDir!) + node.relative,
            selection: defaultEncode ?? ParamsSource.Auto,
          });
        }
      });

      return mapper;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowKeys]);

  const pathRender = (type: "input" | "output", item: SearchEntryNode) => {
    const dir = type === "input" ? inputDir : outputDir;
    if (!dir) return "NULL";

    if (printRelativePath) {
      return item.relative;
    } else {
      return (dir.endsWith(sep) ? dir.slice(0, -1) : dir) + item.relative;
    }
  };
  const paramsRender = (type: "input" | "output", item: SearchEntryNode) => {
    if (item.type !== "File") return;
    if (!selectedRowKeysSet.has(item.absolute)) return;

    const id = type === "input" ? item.inputId : item.outputId;
    const mapper = type === "input" ? inputParamsMapper : outputParamsMapper;
    const params = mapper.get(id);
    if (!params) return;

    const presetType = type === "input" ? PresetType.Decode : PresetType.Encode;
    const setter = type === "input" ? setInputParamsMapper : setOutputParamsMapper;

    const onChange = (id: string, partial: Partial<EditableTaskParams>) =>
      setter((state) => {
        const mapper = new Map(state);
        mapper.set(id, {
          ...state.get(id)!,
          ...partial,
        });
        return mapper;
      });

    const onApplyAll = (record: EditableTaskParams) => {
      setter((state) => {
        const mapper = new Map<string, EditableTaskParams>();

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

    const onConvertCustom = (record: EditableTaskParams) => {
      setter((state) => {
        const mapper = new Map<string, EditableTaskParams>();

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
      <ParamsModifier
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
